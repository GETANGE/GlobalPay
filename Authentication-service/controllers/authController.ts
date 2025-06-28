import { NextFunction, Request, Response } from "express";
import APIError from "./errorHandler";
import logger from "../utils/logger";
import bcrypt from "bcrypt"
import { registration_validation } from "../utils/validation";
import client from "../configs/db-config";
import { getClientDeviceIp } from "../middlewares/deviceIp";
import { publishEmailJob, publishSMSJob } from "../utils/rabbitMQ";
import { resetToken } from "../utils/generateToken";

export const Registration = async (req: Request, res: Response, next: NextFunction) => {
    try {
        logger.info(`Registration endpoint hit...`);

        const { error } = registration_validation(req.body);
        if (error) {
            logger.warn(`Validation error ${error.details[0].message}`);
            return next(new APIError(`Validation error: ${error.details[0].message}`, 400));
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
            kycStatus = 'pending',
            nationalID,
            dateOfBirth,
            walletBalance = 0,
            currency = 'KES',
            role = 'user',
            notification_preference = 'email'
        } = req.body;

        const loginIp = req.ip;
        const deviceIp = getClientDeviceIp(req);

        // Required fields check
        if (!username || !firstName || !lastName || !email || !password || !passwordConfirm || !phoneNumber || !dateOfBirth) {
            return next(new APIError(`Please fill all the required details`, 422));
        }

        if (password !== passwordConfirm) {
            return next(new APIError(`Passwords do not match`, 400));
        }

        // Check if the user already exists
        const checkQuery = {
            text: 'SELECT id, email, phone_number FROM users WHERE email = $1 OR phone_number = $2',
            values: [email, phoneNumber]
        };
        const existingUser: any = await client.query(checkQuery);

        if (existingUser.rows.length > 0) {
            const user = existingUser.rows[0];

            if (user.email === email) {
                return next(new APIError(`A user with that email already exists`, 409));
            }

            if (user.phone_number === phoneNumber) {
                return next(new APIError(`A user with that phone number already exists`, 409));
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
                username, firstName, lastName, email, hashedPassword, phoneNumber,
                isEmailVerified, isPhoneVerified, twoFactorEnabled, kycStatus,
                nationalID, dateOfBirth, walletBalance, currency, role,
                loginIp, deviceIp, notification_preference
            ]
        };

        const newUser = await client.query(insertQuery);

        res.status(201).json({
            status: "success",
            data: newUser.rows[0]
        });

    } catch (error: any) {
        logger.error(`Internal server error`, error);
        return next(new APIError(`Internal server error ${error.message}`, 500));
    }
};

export const sendEmailToken = async(req:Request, res:Response, next:NextFunction) =>{
    try {
        logger.info(`Email verification endpoint hit...`);

        const { email } = req.body;

        if(!email){
            return next(new APIError(`Please provide you email`, 400))
        }

        const userData = {
            name: 'fetch-user',
            text: 'SELECT id, username FROM users WHERE email = $1',
            values: [email]
        }

        const user = await client.query(userData)
        if(!user.rows.length){
            return next(new APIError(`User does not exist`, 404))
        }

        const { token } = resetToken();

        // send Token(add to queue)
        await publishEmailJob({
            email: email,
            name: user.rows[0].username,
            userId: user.rows[0].id,
            subject: "GlobalPay Email Verification",
            message: `Please verify your email address by using the One-Time Password (OTP) provided below.`,
            otp: token
        });

        res.status(200).json({
            status:"success",
            message: "Otp email verification sent successfully"
        })

    } catch (error) {
        logger.error(`Internal server error`, error);
        return next(new APIError(`Internal server error`, 500))
    }
}

export const verifySMS = async(req:Request, res:Response, next:NextFunction) =>{
    try {
        logger.info(`SMS verification endpoint hit...`);

        const { phone_number } = req.body;

        if(!phone_number){
            return next(new APIError(`Please provide you phonenumber`, 400))
        }

        const userData = {
            name: 'fetch-user',
            text: 'SELECT id, username FROM users WHERE phone_number = $1',
            values: [phone_number]
        }

        const user = await client.query(userData);

        if(!user.rows.length){
            return next(new APIError(`User does not exist`, 404))
        }

        const { token } = resetToken();

        // send Token
        await publishSMSJob({
            phone_number: phone_number,
            name: user.rows[0].username,
            userId: user.rows[0].id,
            message: `Please verify your Phonenumber by using the One-Time Password (OTP) provided below. ${token}`,
        });

        res.status(200).json({
            status:"success",
            message: "Otp SMS verification sent successfully"
        })

    } catch (error) {
        logger.error(`Internal server error`, error);
        return next(new APIError(`Internal server error`, 500))
    }
<<<<<<< Updated upstream
}
=======
}

export const verifyEmailToken = async ( req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.params.token;

    if (!token) {
      return next(new APIError("Email token is required", 400));
    }

    const hashedToken = crypto
      .createHash("sha256")
      .update(token.toString())
      .digest("hex");

    logger.info(`🔐 Hashed Email Token: ${hashedToken}`);

    const selectQuery = {
      text: `SELECT * FROM email_verification WHERE email_token = $1`,
      values: [hashedToken],
    };

    const result = await client.query(selectQuery);
    const record = result.rows[0];

    console.log(result.rows[0])

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

    res.status(200).json({
      status: "success",
      message: "✅ Email verified successfully",
    });
  } catch (error: any) {
    logger.error(`❌ Error verifying email token: ${error.message}`);
    return next(new APIError("Internal server error", 500));
  }
};

export const verifySmsToken = async ( req: Request, res: Response, next: NextFunction ) => {
  try {
    const token = req.params.token;

    if (!token) {
      return next(new APIError("SMS token is required", 400));
    }

    const hashedToken = crypto
      .createHash("sha256")
      .update(token.toString())
      .digest("hex");

    logger.info(`🔐 Hashed SMS Token: ${hashedToken}`);

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

    res.status(200).json({
      status: "success",
      message: "✅ SMS verified successfully",
    });
  } catch (error: any) {
    logger.error(`❌ Error verifying SMS token: ${error.message}`);
    return next(new APIError("Internal server error", 500));
  }
};
>>>>>>> Stashed changes
