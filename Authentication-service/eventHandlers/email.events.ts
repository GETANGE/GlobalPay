import client from "../configs/db-config";
import logger from "../utils/logger";
import { EmailData } from "../types/express";

export const email_consumer = async (data: EmailData ) => {
  try{
    
    const { userId, hashedToken, expiresAt } = data;
    
    // insert or update email_verification
    const checkQuery = {
      text: `SELECT id FROM email_verification WHERE user_id = $1`,
      values: [userId],
    };
    
    const existing = await client.query(checkQuery);
    
    if (existing.rows.length > 0) {
      // UPDATE
      const updateQuery = {
        text: `
          UPDATE email_verification
          SET email_token = $2,
              email_expires_at = $3,
              created_at = CURRENT_TIMESTAMP
          WHERE user_id = $1
        `,
        values: [userId, hashedToken, expiresAt],
      };
      
      await client.query(updateQuery);
    } else {
      // INSERT
      const insertQuery = {
        text: `
          INSERT INTO email_verification (user_id, email_token, email_expires_at)
          VALUES ($1, $2, $3)
        `,
        values: [userId, hashedToken, expiresAt],
      };
      await client.query(insertQuery);
    }
    
    logger.info(`💌 Email verification record updated for user ${userId}`);
    
  }catch(error:any){
    logger.error("Error sending Email:", error);
    throw error;
  }
}