import client from "../configs/db-config";
import logger from "../utils/logger";
import { SmsData } from "../types/express";

export const sms_consumer = async (data: SmsData ) => {
  try{
    const { userId, hashedToken, expiresAt } = data;
    
    // Insert or update sms_verification table
    const checkQuery = {
      text: `SELECT id FROM sms_verification WHERE user_id = $1`,
      values: [userId],
    };

    const existing = await client.query(checkQuery);
    
    if (existing.rows.length > 0) {
      const updateQuery = {
        text: `
                UPDATE sms_verification
                SET phone_token = $2,
                    phone_expires_at = $3,
                    created_at = CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Nairobi'
                    WHERE user_id = $1
                    `,
        values: [userId, hashedToken, expiresAt],
      };
      await client.query(updateQuery);
    } else {
      const insertQuery = {
        text: `
              INSERT INTO sms_verification (user_id, phone_token, phone_expires_at) 
              VALUES ($1, $2, $3) 
                    `,
        values: [userId, hashedToken, expiresAt],
      };

      await client.query(insertQuery);
    }
    
    logger.info(`💌 SMS verification record updated for user ${userId}`);
  }catch(error:any){
    logger.error("Error sending SMS:", error);
    throw error;
  }
}