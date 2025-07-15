import { NextFunction, Request, Response } from "express";
import logger from "../utils/logger";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import crypto from "crypto";
import { registration_validation } from "../utils/validation";
import client from "../configs/db-config";
import { getClientDeviceIp } from "../middlewares/deviceIp";
import { publishEmailJob, publishSMSJob } from "../utils/rabbitMQ";
import { generateToken, resetToken } from "../utils/generateToken";
import { getSubject, getUser } from "../helperFunctions/userHelper";
import APIError from "../utils/APIError";

dotenv.config();

export const Registration = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    logger.info(`Registration endpoint hit...`);

    const { error } = registration_validation(req.body);
    if (error) {
      logger.warn(`Validation error ${error.details[0].message}`);
      return next(
        new APIError(`Validation error: ${error.details[0].message}`, 400)
      );
    }

    let {
      username,
      firstName,
      lastName,
      email,
      password,
      passwordConfirm,
      phoneNumber,
      isEmailVerified = false,
      isPhoneVerified = false,
      twoFactorEnabled = false,
      kycStatus = "pending",
      nationalID,
      dateOfBirth,
      walletBalance = 0,
      currency = "KES",
      role = "user",
      notification_preference = "email",
    } = req.body;

    const loginIp = req.ip;
    const deviceIp = getClientDeviceIp(req);

    // Required fields check
    if (
      !username ||
      !firstName ||
      !lastName ||
      !email ||
      !password ||
      !passwordConfirm ||
      !phoneNumber ||
      !dateOfBirth
    ) {
      return next(new APIError(`Please fill all the required details`, 422));
    }

    if (password !== passwordConfirm) {
      return next(new APIError(`Passwords do not match`, 400));
    }

    // Check if the user already exists
    const checkQuery = {
      text: "SELECT id, email, phone_number FROM users WHERE email = $1 OR phone_number = $2",
      values: [email, phoneNumber],
    };
    const existingUser: any = await client.query(checkQuery);

    if (existingUser.rows.length > 0) {
      const user = existingUser.rows[0];

      if (user.email === email) {
        return next(new APIError(`A user with that email already exists`, 409));
      }

      if (user.phone_number === phoneNumber) {
        return next(
          new APIError(`A user with that phone number already exists`, 409)
        );
      }
    }

    // Hash sensitive fields
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new user
    const insertQuery = {
      text: `
                INSERT INTO users (
                    username, first_name, last_name, email, password, phone_number,
                    is_email_verified, is_phone_verified, two_factor_enabled, kyc_status,
                    national_id, date_of_birth, wallet_balance, currency, role,
                    login_ip, device_ip, notification_preference
                ) VALUES (
                    $1, $2, $3, $4, $5, $6,
                    $7, $8, $9, $10,
                    $11, $12, $13, $14, $15,
                    $16, $17, $18
                ) RETURNING *;
            `,
      values: [
        username,
        firstName,
        lastName,
        email,
        hashedPassword,
        phoneNumber,
        isEmailVerified,
        isPhoneVerified,
        twoFactorEnabled,
        kycStatus,
        nationalID,
        dateOfBirth,
        walletBalance,
        currency,
        role,
        loginIp,
        deviceIp,
        notification_preference,
      ],
    };

    const newUser = await client.query(insertQuery);

    res.status(201).json({
      status: "success",
      data: newUser.rows[0],
    });
  } catch (error: any) {
    logger.error(`Internal server error`, error);
    return next(new APIError(`Internal server error ${error.message}`, 500));
  }
};

export const sendEmailToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    logger.info(`Email verification endpoint hit...`);

    const { email } = req.body;

    if (!email) {
      return next(new APIError(`Please provide you email`, 400));
    }

    const userData = {
      name: "fetch-user",
      text: "SELECT id, username FROM users WHERE email = $1",
      values: [email],
    };

    const user = await client.query(userData);
    if (!user.rows.length) {
      return next(new APIError(`User does not exist`, 404));
    }

    const { token, hashedToken, expiresAt } = resetToken();

    // send Token(add to queue)
    await publishEmailJob({
      email: email,
      name: user.rows[0].username,
      userId: user.rows[0].id,
      subject: getSubject("welcome"),
      message: `Please verify your email address by using the One-Time Password (OTP) provided below.`,
      otp: token,
      hashedToken,
      expiresAt,
    });

    res.status(200).json({
      status: "success",
      message: "Otp email verification sent successfully",
    });
  } catch (error) {
    logger.error(`Internal server error`, error);
    return next(new APIError(`Internal server error`, 500));
  }
};

export const sendSMSToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    logger.info(`SMS verification endpoint hit...`);

    const { phone_number } = req.body;

    if (!phone_number) {
      return next(new APIError(`Please provide you phonenumber`, 400));
    }

    const userData = {
      name: "fetch-single-user",
      text: "SELECT id, username FROM users WHERE phone_number = $1",
      values: [phone_number],
    };

    const user = await client.query(userData);

    if (!user.rows.length) {
      return next(new APIError(`User does not exist`, 404));
    }

    const { token, hashedToken, expiresAt } = resetToken();

    // send Token
    await publishSMSJob({
      phone_number: phone_number,
      name: user.rows[0].username,
      userId: user.rows[0].id,
      message: `Please verify your Phonenumber by using the One-Time Password (OTP) provided below. ${token}`,
      hashedToken: hashedToken,
      expiresAt: expiresAt,
    });

    res.status(200).json({
      status: "success",
      message: "Otp SMS verification sent successfully",
    });
  } catch (error) {
    logger.error(`Internal server error`, error);
    return next(new APIError(`Internal server error`, 500));
  }
};

export const verifyEmailToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.params.token;

    if (!token) {
      return next(new APIError("Email token is required", 400));
    }

    const hashedToken = crypto
      .createHash("sha256")
      .update(token.toString())
      .digest("hex");

    const selectQuery = {
      text: `SELECT * FROM email_verification WHERE email_token = $1`,
      values: [hashedToken],
    };

    const result = await client.query(selectQuery);
    const record = result.rows[0];

    if (!record) {
      return next(new APIError("Invalid or expired email token", 404));
    }

    const expiry = new Date(record.email_expires_at);

    if (expiry < new Date()) {
      return next(new APIError("Email token has expired", 400));
    }

    const updateQuery = {
      text: `UPDATE email_verification SET email_token = NULL WHERE email_token = $1`,
      values: [hashedToken],
    };

    await client.query(updateQuery);

    // update user data (phone_verification)
    const text = `UPDATE users SET is_email_verified = $1 WHERE id=$2`;
    const values = [true, record.user_id];

    await client.query(text, values);

    res.status(200).json({
      status: "success",
      message: "Email verified successfully",
    });
  } catch (error: any) {
    logger.error(`Error verifying email token: ${error.message}`);
    return next(new APIError("Internal server error", 500));
  }
};

export const verifySmsToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.params.token;

    if (!token) {
      return next(new APIError("SMS token is required", 400));
    }

    const hashedToken = crypto
      .createHash("sha256")
      .update(token.toString())
      .digest("hex");

    const selectQuery = {
      text: `SELECT * FROM sms_verification WHERE phone_token = $1`,
      values: [hashedToken],
    };

    const result = await client.query(selectQuery);
    const record = result.rows[0];

    if (!record) {
      return next(new APIError("Invalid or expired SMS token", 404));
    }

    const expiry = new Date(record.phone_expires_at);

    if (expiry < new Date()) {
      return next(new APIError("SMS token has expired", 400));
    }

    const updateQuery = {
      text: `UPDATE sms_verification SET phone_token = NULL WHERE phone_token = $1`,
      values: [hashedToken],
    };

    await client.query(updateQuery);

    // update user data (phone_verification)
    const text = `UPDATE users SET is_phone_verified = $1 WHERE id=$2`;
    const values = [true, record.user_id];

    await client.query(text, values);
    res.status(200).json({
      status: "success",
      message: "SMS verified successfully",
    });
  } catch (error: any) {
    logger.error(`Error verifying SMS token: ${error.message}`);
    return next(new APIError("Internal server error", 500));
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    logger.info(`Login endpoint hit...`);

    const { email, currentPassword } = req.body;

    if (!email || !currentPassword) {
      return next(new APIError(`Please provide you email or password`, 401));
    }

    const query = {
      text: "SELECT id, username, email, password, role FROM users WHERE email = $1",
      values: [email],
    };

    const result = await client.query(query);

    if (!result) {
      return next(new APIError(`This user does not exist`, 400));
    }

    const user = result.rows[0];

    //compare passwords
    const isMatch = await bcrypt.compare(currentPassword, user.password);

    if (!isMatch) {
      return next(new APIError(`Password do not match`, 400));
    }

    // generate accessToken and refreshToken
    const { access_token, refresh_token } = await generateToken({
      id: user.id,
      username: user.username,
      email: user.email,
    });

    // send response
    res.status(200).json({
      status: "LoggedIn successfully",
      access_token: access_token,
      refresh_token: refresh_token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error: any) {
    logger.error(`Internal server error: ${error.message}`);
    return next(new APIError(`Internal server error`, 500));
  }
};

export const protectRoute = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeaders = req.headers.authorization;

    if (!authHeaders || !authHeaders?.includes("Bearer")) {
      return next(new APIError(`You are not logged In (Authorizations).`, 403));
    }

    const token = authHeaders.split(" ")[1];
    const decodedToken = jwt.verify(
      token,
      process.env.JWT_SECRET as string
    ) as { userId: number };

    if (!decodedToken || !decodedToken.userId) {
      return next(new APIError("Token expired or invalid.", 400));
    }

    const userId = decodedToken.userId;

    if (!userId) {
      return next(new APIError(`Invalid token`, 403));
    }

    const text = `SELECT id, username, email, role FROM users WHERE id = $1`;
    const values = [userId];

    const result = await client.query(text, values);

    if (result.rows.length === 0) {
      return next(new APIError(`User not found`, 404));
    }

    req.user = result.rows[0];

    next();
  } catch (error: any) {
    if (error.name === "JsonWebTokenError") {
      return next(new APIError(`Invalid token. Please log in again! 😊`, 401));
    } else if (error.name === "TokenExpiredError") {
      return next(new APIError(`Token expired. Please log in again! 😊`, 401))
    }else{
      logger.error(`Internal server error : ${error}`);
      return next(new APIError(`Internal server error`, 500));
    }
  }
};

export const restrictTo = (...role: string[]) => {
  return (req: any, res: Response, next: NextFunction) => {
    if (!role.includes(req.user.role)) {
      return next(
        new APIError(`You are not authorized to perform this action`, 403)
      );
    }
    next();
  };
};

export const forgotPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email } = req.body;

    if (!email) {
      return next(new APIError(`Please input your email`, 400));
    }

    const userQuery = `SELECT id, username, email FROM users WHERE email = $1`;
    const { rows } = await client.query(userQuery, [email]);

    if (rows.length === 0) {
      return next(new APIError(`User with email ${email} does not exist`, 404));
    }

    const userData = rows[0];

    const { token, hashedToken, expiresAt } = resetToken();

    // Delete existing token if present
    const deleteQuery = `DELETE FROM password_resets WHERE user_id = $1`;
    await client.query(deleteQuery, [userData.id]);

    // Insert new token
    const insertQuery = `
      INSERT INTO password_resets (user_id, reset_token, expires_at)
      VALUES ($1, $2, $3)
    `;
    await client.query(insertQuery, [userData.id, hashedToken, expiresAt]);

    await publishEmailJob({
      email: userData.email,
      name: userData.username,
      userId: userData.id,
      message: `We received a request to reset your password. Use the OTP below to proceed.`,
      subject: getSubject("reset"),
      otp: token,
      hashedToken,
      expiresAt,
    });

    res.status(200).json({
      status: "success",
      message: `OTP sent to ${email}`,
    });
  } catch (error) {
    logger.error(`Forgot Password Error: ${error}`);
    return next(new APIError(`Internal server error`, 500));
  }
};

export const resetPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return next(new APIError("Token and new password are required", 400));
    }

    const hashedToken = crypto
      .createHash("sha256")
      .update(token.toString())
      .digest("hex");

    const resetQuery = `SELECT * FROM password_resets WHERE reset_token = $1`;
    const resetResult = await client.query(resetQuery, [hashedToken]);

    if (resetResult.rows.length === 0) {
      return next(new APIError("Invalid or expired reset token", 400));
    }

    const tokenRow = resetResult.rows[0];
    const expiry = new Date(tokenRow.expires_at);
    logger.info(
      `🕓 NOW: ${new Date().toISOString()} | 📅 EXPIRES AT: ${expiry.toISOString()}`
    );

    if (expiry < new Date()) {
      return next(new APIError("Reset token has expired", 400));
    }

    const userQuery = `SELECT * FROM users WHERE id = $1`;
    const userResult = await client.query(userQuery, [tokenRow.user_id]);

    if (userResult.rows.length === 0) {
      return next(
        new APIError("User associated with this token does not exist", 404)
      );
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    const updateQuery = `UPDATE users SET password = $1 WHERE id = $2`;
    await client.query(updateQuery, [hashedNewPassword, tokenRow.user_id]);

    await client.query(`DELETE FROM password_resets WHERE reset_token = $1`, [
      hashedToken,
    ]);

    res.status(200).json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    logger.error(`Reset password error: ${error}`);
    return next(new APIError("Internal server error", 500));
  }
};

export const updatePassword = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, currentPassword, newPassword } = req.body;

    if (!email || !currentPassword || !newPassword) {
      return next(
        new APIError(
          "Email, current password, and new password are required.",
          400
        )
      );
    }

    if (
      typeof email !== "string" ||
      typeof currentPassword !== "string" ||
      typeof newPassword !== "string"
    ) {
      return next(new APIError("All fields must be strings.", 400));
    }

    const trimmedEmail = email.trim().toLowerCase();

    const userData = await getUser({ email: trimmedEmail });

    if (!userData) {
      return next(new APIError("User not found.", 404));
    }

    const isMatch = await bcrypt.compare(currentPassword, userData.password);

    if (!isMatch) {
      return next(new APIError("Current password is incorrect.", 400));
    }

    const isSamePassword = await bcrypt.compare(newPassword, userData.password);
    if (isSamePassword) {
      return next(
        new APIError(
          "New password must be different from the old password.",
          400
        )
      );
    }

    if (newPassword.length < 8) {
      return next(
        new APIError("New password must be at least 8 characters long.", 400)
      );
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    const updateQuery = `UPDATE users SET password = $1 WHERE id = $2`;
    await client.query(updateQuery, [hashedNewPassword, userData.id]);

    res.status(200).json({
      status: "success",
      message: "Password updated successfully 😀",
    });
  } catch (error) {
    logger.error("Error updating user password:", error);
    return next(new APIError("Internal server error.", 500));
  }
};
