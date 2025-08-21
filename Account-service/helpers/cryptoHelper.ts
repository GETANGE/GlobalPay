import crypto from "crypto";
import dotenv from "dotenv";
import logger from "../utils/logger";
import client from "../configs/db-config";

dotenv.config()

const ALGO = "aes-256-gcm";
const VAULT_KEY = process.env.VAULT_SECRET_KEY as string

export const encryptData = async (data: string, key: string): Promise<{ encrypted: string; iv: string; tag: string }> => {
    try {
        const iv = crypto.randomBytes(16);
        const cipher: crypto.CipherGCM = crypto.createCipheriv(
            ALGO,
            Buffer.from(key, "hex"), 
            iv
        ) as crypto.CipherGCM;

        let encrypted = cipher.update(data, "utf8", "hex");
        encrypted += cipher.final("hex");
        const tag = cipher.getAuthTag().toString("hex");

        return { encrypted, iv: iv.toString("hex"), tag };
    } catch (error) {
        logger.error(`Encryption failed: ${error}`);
        throw new Error("Encryption failed");
    }
};

export const decryptData = async(encrypted: string, iv: string, tag:string, VAULT_KEY:string)=>{
    try {
        const decipher: crypto.DecipherGCM = crypto.createDecipheriv(
            ALGO, 
            Buffer.from(VAULT_KEY, "hex"), 
            Buffer.from(iv, "hex")
        ) as crypto.DecipherGCM;
        
        decipher.setAuthTag(Buffer.from(tag, "hex"));

        let decrypted = decipher.update(encrypted, "hex", "utf8");
        decrypted += decipher.final("utf8");

        return decrypted;
    } catch (error) {
        logger.error(`Decryption failed: ${error}`);
        throw new Error("Failed to decrypt data");
    }
}

export const linkAccount = async ( userId: string, type: "CARD" | "BANK", tokenId: string ) => {
    try {
        await client.query("BEGIN");

        // check if account already linked
        const linkedAccountQuery = {
            text: `SELECT * FROM linked_accounts WHERE user_id = $1`,
            values: [userId],
        };
        const linked_account_result = await client.query(linkedAccountQuery);

        if (linked_account_result.rows.length > 0) {
            // update existing
            await client.query({
                text: `UPDATE linked_accounts 
                       SET token_id = $1, type = $2, status = 'ACTIVE', provider = 'self_vault'
                       WHERE user_id = $3`,
                values: [tokenId, type, userId],
            });
        } else {
            // insert new
            await client.query({
                text: `INSERT INTO linked_accounts (user_id, token_id, type, status, provider)
                       VALUES ($1, $2, $3, 'ACTIVE', 'self_vault')`,
                values: [userId, tokenId, type],
            });
        }

        await client.query("COMMIT");
        return tokenId;
    } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        logger.error(`Linking accounts failed: ${error}`);
        throw new Error("Failed to link account");
    }
};

export const validateCardNumber = (number: string): boolean => {
    // Remove all non-digit characters
    const cleaned = number.replace(/\D+/g, '');
    
    // Basic length check (13-19 digits)
    if (!/^\d{13,19}$/.test(cleaned)) {
        return false;
    }

    // Luhn algorithm validation
    let sum = 0;
    for (let i = 0; i < cleaned.length; i++) {
        let digit = parseInt(cleaned[i]);
        if ((cleaned.length - i) % 2 === 0) {
            digit *= 2;
            if (digit > 9) digit -= 9;
        }
        sum += digit;
    }

    return sum % 10 === 0;
}

export const  validateExpirationDate =function (exp: string): boolean {
    if (!/^\d{2}\/\d{2}$/.test(exp)) {
        return false;
    }

    // Validate expiration date (MM/YY format and not expired)
    const [month, year] = exp.split('/').map(Number);
    if (month < 1 || month > 12) {
        return false;
    }

    // Get current date
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear() % 100;
    const currentMonth = currentDate.getMonth() + 1;

    // Check if card is expired
    if (year < currentYear || (year === currentYear && month < currentMonth)) {
        return false;
    }

    return true;
}

export const validateCVV = function(cvv: string, cardNumber: string): boolean {
    // American Express (34, 37) have 4-digit CVV, others have 3
    const isAmex = /^3[47]/.test(cardNumber);
    const expectedLength = isAmex ? 4 : 3;
    
    return new RegExp(`^\\d{${expectedLength}}$`).test(cvv);
}