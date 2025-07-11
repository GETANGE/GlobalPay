import { AuthenticatorTransportFuture, generateRegistrationOptions ,verifyRegistrationResponse} from '@simplewebauthn/server';
import dotenv from "dotenv"
import jwt from 'jsonwebtoken'
import { NextFunction, Request, Response } from 'express';
import logger from '../utils/logger';
import APIError from './errorHandler';
import { getUser } from '../helperFunctions/userHelper';
import client from '../configs/db-config';

dotenv.config()

const rpName = 'GlobalPay';
const rpID = process.env.WEBAUTHN_RP_ID || 'localhost';
const origin = process.env.WEBAUTHN_ORIGIN || `http://${rpID}:3001`;

interface Passkey {
  id: string;
  publicKey: Uint8Array;
  user: {
    id: number;
    username: string;
  };
  webauthnUserID: string;
  counter: number;
  deviceType: 'singleDevice' | 'multiDevice';
  backedUp: boolean;
  transports?: string[];
}

// Get user's previously registered passkeys
export const getUserPasskeys = async (user: { id?: number }) => {
  const text = `SELECT * FROM passkeys WHERE user_id = $1`;
  const values = [user.id];

  try {
    const result = await client.query(text, values);

    return result.rows.map((row) => ({
        id: row.id,
        publicKey: new Uint8Array(row.public_key),
        user: {
            id: row.user_id,
            username: '', // optional
        },
        webauthnUserID: row.webauthn_user_id,
        counter: row.counter,
        deviceType: row.device_type,
        backedUp: row.backed_up,
        transports: row.transports?.split(',') as AuthenticatorTransportFuture[] | undefined,
    }));
  } catch (err) {
    console.error('Error fetching passkeys:', err);
    throw err;
  }
};

export const getCurrentRegistrationOptions = async (userId: number) => {
  const text = `SELECT current_challange FROM users WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`;
  const result = await client.query(text, [userId]);

  if (result.rows.length === 0) return null;

  return result.rows[0].options;
};


// Registration Options Endpoint
export const passkeyRegister = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Extract and verify JWT token
    const authHeaders = req.headers.authorization;
    if (!authHeaders) return next(new APIError("No authorization header", 401));

    const token = authHeaders.split(" ")[1];
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET as string) as { userId: number };

    // Get user data
    const userData = await getUser({ id: decodedToken.userId });
    if (!userData) return next(new APIError("User not found", 404));

    const userPasskeys: Passkey[] = await getUserPasskeys(userData);

    const allowedTransports: AuthenticatorTransportFuture[] = [
        'usb', 'ble', 'nfc', 'internal', 'cable', 'hybrid', 'smart-card',
    ];

    const options = await generateRegistrationOptions({
        rpName,
        rpID,
        userID: userData.userId,
        userName: userData.username,
        attestationType: 'none',
        excludeCredentials: userPasskeys.map(passkey => ({
            id: passkey.id,
            transports: passkey.transports?.filter((t): t is AuthenticatorTransportFuture =>
            allowedTransports.includes(t as AuthenticatorTransportFuture)
            ),
        })),
        authenticatorSelection: {
            residentKey: 'preferred',
            userVerification: 'preferred',
            authenticatorAttachment: 'platform',
        },
    });

    // Store challenge temporarily in DB or memory (keyed by userID or session)
    const storeChallengeQuery = `
      UPDATE users SET current_challange = $1, updated_at = NOW() WHERE id = $2
    `;
    await client.query(storeChallengeQuery, [options.challenge, userData.id]);

    res.status(200).json({
        status:"success",
        options
    });
  } catch (error) {
    logger.error(`Error registering passkey: ${error}`);
    return next(new APIError("Internal server error", 500));
  }
};

export const verifyPasskey = async(req: Request, res:Response, next:NextFunction)=>{
    const { body } = req;
    
    try {
        // Extract and verify JWT token
        const authHeaders = req.headers.authorization;
        if (!authHeaders) return next(new APIError("No authorization header", 401));

        const token = authHeaders.split(" ")[1];
        const decodedToken = jwt.verify(token, process.env.JWT_SECRET as string) as { userId: number };

        // Get user data
        const userData = await getUser({ id: decodedToken.userId });
        if (!userData) return next(new APIError("User not found", 404))
        
        // Retrive challenge options
        const currentOptions = await getCurrentRegistrationOptions(userData.userId);
        if(!currentOptions){
            return next(new APIError(`Challenge not found`, 400))
        }

        // verify the registration response
        const verification = await verifyRegistrationResponse({
            response: body,
            expectedChallenge: currentOptions.challenge,
            expectedOrigin: origin,
            expectedRPID: rpID
        })

        const { verified, registrationInfo } = verification;
        if(!verified || !registrationInfo){
            return next(new APIError(`Passkey registration verification failed`, 400))
        }

        // Extract passkey data from registrationInfo
        const {
            credential:{
                id: credentialID,
                publicKey: credentialPublicKey,
                counter,
            },
            credentialDeviceType,
            credentialBackedUp
        } = registrationInfo

        // ✅ 5. Save passkey to DB
        const insertQuery = {
            text: `
                INSERT INTO passkeys (
                id,
                public_key,
                user_id,
                webauthn_user_id,
                counter,
                device_type,
                backed_up
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            `,
            values: [
                credentialID,
                credentialPublicKey,
                userData.userId,
                currentOptions.user.id, // this is the webauthnUserID (base64url)
                counter,
                credentialDeviceType,
                credentialBackedUp,
            ],
    };

    await client.query(insertQuery);

    logger.info(`✅ Registered passkey for user: ${userData.username}`);
    } catch (error) {
        logger.error(`Error verifying passkey: ${error}`)
        return next(new APIError(`Internal Server Error`, 500))
    }
}