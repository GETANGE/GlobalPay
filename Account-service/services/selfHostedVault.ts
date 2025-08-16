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
    async tokenizeCard(cardData: string | Record<string, unknown>) {
        // Encrypt card data and store it in the database
        if (!cardData) {
            throw new Error("No card data provided");
        }

        const payload = typeof cardData === 'string' ? cardData : JSON.stringify(cardData);
        
        try {
            const { encrypted, iv, tag } = await encryptData(payload, VAULT_KEY);
            const tokenId = `vault_${uuidv4()}`;
            
            await client.query('BEGIN');
            await client.query({
                text: `INSERT INTO vault_tokens (token_id, encrypted_data) VALUES ($1, $2)`,
                values: [tokenId, JSON.stringify({ encrypted, iv, tag })]
            });
            await client.query('COMMIT');

            return tokenId;
        } catch (error) {
            await client.query('ROLLBACK').catch(() => {});
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