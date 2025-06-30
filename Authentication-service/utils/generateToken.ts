import jwt from "jsonwebtoken"
import crypto from 'crypto'
import dotenv from 'dotenv'
import client from '../configs/db-config'
import logger from "./logger"

dotenv.config()

interface userData {
  id: number;
  username: string;
  email: string;
}

export const generateToken = async (user: userData) => {
  const access_token = jwt.sign({ userId: user.id, username: user.username, email: user.email }, process.env.JWT_SECRET as string,
    { expiresIn: '15m' }
  );

  const refresh_token = crypto.randomBytes(40).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

  // Check if refresh token already exists
  const checkQuery = {
    text: `SELECT user_id FROM refreshToken WHERE user_id = $1`,
    values: [user.id]
  };

  const result = await client.query(checkQuery);

  if (result.rows.length > 0) {
    // Update existing token
    const updateQuery = {
      text: `
        UPDATE refreshToken
        SET access_token = $2,
            refresh_token = $3,
            expires_at = $4
        WHERE user_id = $1`,
      values: [user.id, access_token, refresh_token, expiresAt]
    };

    await client.query(updateQuery);

    logger.info(`🔁 Refresh token and access token updated`);

  } else {
    // Insert new token
    const insertQuery = {
      text: `INSERT INTO refreshToken (user_id, access_token, refresh_token, expires_at)
             VALUES ($1, $2, $3, $4)`,
      values: [user.id, access_token, refresh_token, expiresAt]
    };

    await client.query(insertQuery);

    logger.info(`✨ Refresh token and access token created`);
  }

  return { access_token, refresh_token };
};

export const resetToken = () => {
    const token = crypto.randomInt(11111, 99999);

    const hashedToken = crypto.createHash('sha256').update(token.toString()).digest('hex');
    console.log(hashedToken)
    
    const expiresAt = new Date(Date.now()+ 10 * 60 * 1000).toISOString();

  return { token, expiresAt, hashedToken };
};