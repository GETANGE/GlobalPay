import {
  AuthenticatorTransportFuture,
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import { NextFunction, Request, Response } from "express";
import logger from "../utils/logger";

import { getUser } from "../helperFunctions/userHelper";
import client from "../configs/db-config";
import {
  getChallenge,
  getCurrentRegistrationOptions,
  getUserPasskeys,
  updatePasskeyCounter,
} from "../utils/passkey";
import { generateToken } from "../utils/generateToken";
import APIError from "../utils/APIError";

dotenv.config();

const rpName = "GlobalPay";
const rpID = process.env.WEBAUTHN_RP_ID || "localhost";
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
  deviceType: "singleDevice" | "multiDevice";
  backedUp: boolean;
  transports?: string[];
}

// Registration Options Endpoint
export const passkeyRegister = async ( req: Request, res: Response,
  next: NextFunction
) => {
  try {
    // Extract and verify JWT token
    const authHeaders = req.headers.authorization;
    if (!authHeaders) return next(new APIError("No authorization header", 401));

    const token = authHeaders.split(" ")[1];
    const decodedToken = jwt.verify(
      token,
      process.env.JWT_SECRET as string
    ) as { userId: number };

    // Get user data
    const userData = await getUser({ id: decodedToken.userId });
    if (!userData) return next(new APIError("User not found", 404));

    const userPasskeys: Passkey[] = await getUserPasskeys(userData);

    const allowedTransports: AuthenticatorTransportFuture[] = [
      "usb",
      "ble",
      "nfc",
      "internal",
      "cable",
      "hybrid",
      "smart-card",
    ];

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: userData.userId,
      userName: userData.username,
      attestationType: "none",
      excludeCredentials: userPasskeys.map((passkey) => ({
        id: passkey.id,
        transports: passkey.transports?.filter(
          (t): t is AuthenticatorTransportFuture =>
            allowedTransports.includes(t as AuthenticatorTransportFuture)
        ),
      })),
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
        authenticatorAttachment: "platform",
      },
    });

    // Store challenge temporarily in DB or memory (keyed by userID or session)
    const storeChallengeQuery = `
      UPDATE users SET current_challange = $1, updated_at = NOW() WHERE id = $2
    `;
    await client.query(storeChallengeQuery, [options.challenge, userData.id]);

    res.status(200).json({
      status: "success",
      options,
    });
  } catch (error) {
    logger.error(`Error registering passkey: ${error}`);
    return next(new APIError("Internal server error", 500));
  }
};

export const verifyPasskey = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { body } = req;

  try {
    // Extract and verify JWT token
    const authHeaders = req.headers.authorization;
    if (!authHeaders) return next(new APIError("No authorization header", 401));

    const token = authHeaders.split(" ")[1];
    const decodedToken = jwt.verify(
      token,
      process.env.JWT_SECRET as string
    ) as { userId: number };

    // Get user data
    const userData = await getUser({ id: decodedToken.userId });
    if (!userData) return next(new APIError("User not found", 404));

    // Retrive challenge options
    const currentOptions = await getCurrentRegistrationOptions(userData.userId);
    if (!currentOptions) {
      return next(new APIError(`Challenge not found`, 400));
    }

    // verify the registration response
    const verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge: currentOptions.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    const { verified, registrationInfo } = verification;
    if (!verified || !registrationInfo) {
      return next(
        new APIError(`Passkey registration verification failed`, 400)
      );
    }

    // Extract passkey data from registrationInfo
    const {
      credential: { id: credentialID, publicKey: credentialPublicKey, counter },
      credentialDeviceType,
      credentialBackedUp,
    } = registrationInfo;

    const transports = body.response.transports;

    // Save passkey to DB
    const insertQuery = {
      text: `
            INSERT INTO passkeys (
              id,
              public_key,
              user_id,
              webauthn_user_id,
              counter,
              device_type,
              backed_up,
              transports
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
        transports.join(",") || null,
      ],
    };

    await client.query(insertQuery);

    logger.info(`Registered passkey for user: ${userData.username}`);
    res.status(201).json({
      status: "success",
      verified: true,
    });
  } catch (error) {
    logger.error(`Error verifying passkey: ${error}`);
    return next(new APIError(`Internal Server Error`, 500));
  }
};

export const getLoginOptions = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email } = req.body;

    if (!email) {
      return next(new APIError(`Please provide your email`, 400));
    }

    const user = await getUser({ email: email });
    if (!user) {
      return next(new APIError(`User not found`, 400));
    }

    const passkeys: Passkey[] = await getUserPasskeys(user);

    const options = await generateAuthenticationOptions({
      rpID: rpID,
      timeout: 60000,
      allowCredentials: passkeys.map((key) => ({
        id: key.id,
        type: "public-key",
        transports: (key.transports as AuthenticatorTransportFuture[]) || [],
      })),
      userVerification: "preferred",
    });

    // save the challenge in DB
    const storeChallengeQuery = `
      UPDATE users SET login_challange = $1, updated_at = NOW() WHERE id = $2
    `;
    await client.query(storeChallengeQuery, [options.challenge, user.id]);

    res.status(200).json({
      status: "success",
      options,
    });
  } catch (error) {
    logger.error(`Error getting loginOptions ${error}`);
    return next(new APIError(`Internal server error`, 500));
  }
};

export const verifyPasskeyLogin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { body } = req;

    // get credentialID and match it to a stored passkey
    const credentialID = body.rawId;
    const dbPasskey = await getUserPasskeys(credentialID);

    if (!dbPasskey) {
      return next(new APIError(`Passkey not found`, 400));
    }

    //Load expected challenge
    const expectedChallenge = await getChallenge(dbPasskey[0].id);

    const verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: dbPasskey[0].id,
        publicKey: dbPasskey[0].publicKey,
        counter: dbPasskey[0].counter,
        transports: dbPasskey[0].transports,
      },
    });

    const { verified, authenticationInfo } = verification;

    if (!verified) {
      return next(new APIError(`Authentication failed!`, 401));
    }

    // update counter in DB to prevent replay attacks
    await updatePasskeyCounter(dbPasskey[0].id, authenticationInfo.newCounter);

    // generate JWT token
    const userData = await getUser({ id: dbPasskey[0].user.id });

    const { access_token, refresh_token } = await generateToken({
      id: userData.id,
      username: userData.username,
      email: userData.email,
    });

    res.status(200).json({
      status: "LoggedIn successfully",
      access_token: access_token,
      refresh_token: refresh_token,
      user: {
        id: userData.id,
        username: userData.username,
        email: userData.email,
        role: userData.role,
      },
    });
  } catch (error) {
    logger.error(`Errror logging passkey ${error}`);
    return next(new APIError(`Internal server error`, 500));
  }
};
