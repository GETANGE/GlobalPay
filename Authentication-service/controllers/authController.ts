import { NextFunction, Request, Response } from "express";
import APIError from "./errorHandler";
import logger from "../utils/logger";
import { registration_validation } from "../utils/validation";
import { encrypt } from "../middlewares/hashing";
import client from "../configs/db-config";
import { getClientDeviceIp } from "../middlewares/deviceIp";

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
            text: 'SELECT 1 FROM users WHERE email = $1',
            values: [email]
        };
        const existingUser: any = await client.query(checkQuery);
        if (existingUser.rowCount > 0) {
            return next(new APIError(`A user with that email already exists`, 409));
        }

        // Hash sensitive fields
        const hashedPassword = await encrypt(password);
        const hashedNationalId = await encrypt(nationalID);

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
                hashedNationalId, dateOfBirth, walletBalance, currency, role,
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
        return next(new APIError(`Internal server error`, 500));
    }
};
