import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";
import { decryptData, encryptData } from "../helpers/cryptoHelper";
import client from "../configs/db-config";
import logger from "../utils/logger";
import type { VaultAdapter } from "../types/vault-adapter";

dotenv.config();

const VAULT_KEY = process.env.VAULT_SECRET_KEY as string;

if (!VAULT_KEY) {
    throw new Error("VAULT_SECRET_KEY is not configured in environment variables");
}

export const selfHostedVault: VaultAdapter = {
    async tokenizeCard(
      cardData: string | Record<string, unknown>,
      userId?: string,
      type?: string
    ) {
      if (!cardData) throw new Error("No card data provided");
    
      const payload = typeof cardData === "string" ? cardData : JSON.stringify(cardData);
      const { encrypted, iv, tag } = await encryptData(payload, VAULT_KEY);
      const encryptedPayload = JSON.stringify({ encrypted, iv, tag });
    
      try {
        await client.query("BEGIN");
    
        // Fetch linked account
        const { rows: linkedRows } = await client.query(
          `SELECT * FROM linked_accounts WHERE user_id = $1`,
          [userId]
        );
    
        let tokenId: string;
    
        if (linkedRows.length === 0) {
          // No linked account → create new token + link
          tokenId = `vault_${uuidv4()}`;
    
          await client.query(
            `INSERT INTO vault_tokens (token_id, encrypted_data) VALUES ($1, $2)`,
            [tokenId, encryptedPayload]
          );
    
          await client.query(
            `INSERT INTO linked_accounts (user_id, token_id, type, status, provider)
            VALUES ($1, $2, $3, $4, $5)`,
            [userId, tokenId, type, "ACTIVE", "self_vault"]
          );
        } else {
          // Linked account exists
          tokenId = linkedRows[0].token_id;
    
          const { rows: vaultRows } = await client.query(
            `SELECT * FROM vault_tokens WHERE token_id = $1`,
            [tokenId]
          );
    
          if (vaultRows.length > 0) {
            // Update existing vault token
            await client.query(
              `UPDATE vault_tokens SET encrypted_data = $1 WHERE token_id = $2`,
              [encryptedPayload, tokenId]
            );
          } else {
            // No vault token → create new and update linked account
            const newTokenId = `vault_${uuidv4()}`;
    
            await client.query(
              `INSERT INTO vault_tokens (token_id, encrypted_data) VALUES ($1, $2)`,
              [newTokenId, encryptedPayload]
            );
    
            await client.query(
              `UPDATE linked_accounts SET token_id = $1 WHERE user_id = $2`,
              [newTokenId, userId]
            );
    
            tokenId = newTokenId;
          }
        }
    
        await client.query("COMMIT");
        return tokenId;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        logger.error(`Tokenization failed: ${error}`);
        throw new Error("Failed to tokenize card data");
      }
    },

    async chargeToken(tokenId: string, amount: number, currency: string) {
        // decrypt card data and process payment transaction
        if (!tokenId) throw new Error("Token ID is required");

        if (typeof amount !== 'number' || amount <= 0) throw new Error("Invalid amount");

        if (!currency) throw new Error("Currency is required");

        try {
            const result = await client.query(
                `SELECT encrypted_data FROM vault_tokens WHERE token_id = $1`,
                [tokenId]
            );

            if (result.rowCount === 0) {
                throw new Error("Token not found");
            }

            const { encrypted, iv, tag } = JSON.parse(result.rows[0].encrypted_data);
            const decryptedData = await decryptData(encrypted, iv, tag, VAULT_KEY);
            const cardData = JSON.parse(decryptedData);

            // send response to the real payment processing function
            return { 
                success: true, 
                charged: { 
                    amount, 
                    currency, 
                    card: cardData 
                }
            };
        } catch (error) {
            logger.error(`Charge failed for token ${tokenId}: ${error}`);
            throw new Error("Payment processing failed");
        }
    }
};