import type {Request, Response, NextFunction } from "express";
import logger from "../utils/logger";
import APIError from "../utils/APIError";
import { selfHostedVault } from "../services/selfHostedVault";
import { validateCardNumber, validateCVV, validateExpirationDate } from "../helpers/cryptoHelper";
import client from "../configs/db-config";

const cacheInvalidation = async(req:Request, tokenId: string )=>{
    const tokenKey = `token:${tokenId}`
    await req.redisClient.del(tokenKey)

    const keys = await req.redisClient.keys("tokens:*");
    if(keys){
        await req.redisClient.del(...keys)
    }
}

export const getAllLinkedAccounts = async(req:Request, res:Response, next:NextFunction)=>{
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const offset = (page - 1) * limit;

        const cachedKey = `tokens:${page}:${limit}`;
        const cachedLinkedAccount = await req.redisClient.get(cachedKey);

        if(cachedLinkedAccount){
            try {
                const parsed = JSON.parse(cachedLinkedAccount);
                return res.status(200).json({
                    status:"success",
                    data: parsed,
                    fromCache: true
                })
            } catch (error) {
                logger.error(`Failed to parse cached data`)
            }
        }

        const linkedAccount_query = `SELECT * FROM linked_accounts ORDER BY created_at DESC LIMIT $1 OFFSET $2`;
        const linked_accounts = await client.query(linkedAccount_query, [limit, offset])

        const countQuery = `SELECT COUNT(*) AS total_linked_accounts FROM linked_accounts`;
        const counterResult = await client.query(countQuery)
        const total_linked_accounts = parseInt(counterResult.rows[0].total_linked_accounts);

        const result ={
            data: linked_accounts.rows,
            currentPage: page,
            totalPages: Math.ceil(total_linked_accounts / limit),
            totalLinkendAccounts: total_linked_accounts
        }

        await req.redisClient.setex(cachedKey, 3600, JSON.stringify(result))

        res.status(200).json({
            status:"succcess",
            data: result,
            fromCache: false
        })
    } catch (error) {
        logger.error(`Error getting all linked Accounts`, error)
        return next(new APIError(`Internal server error`, 500))
    }
}

export const linkAccount_token = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { number, exp, cvv } = req.body;

        if (!number || !exp || !cvv) {
            return next(new APIError('Card number, expiration date and CVV are required', 400));
        }

        const validationErrors: string[] = [];

        if (!validateCardNumber(number)) {
            validationErrors.push('Invalid card number');
        }

        if (!validateExpirationDate(exp)) {
            validationErrors.push('Invalid or expired card');
        }

        if (!validateCVV(cvv, number)) {
            validationErrors.push('Invalid security code');
        }

        if (validationErrors.length > 0) {
            return next(new APIError(`Validation failed: ${validationErrors.join(', ')}`, 400));
        }

        // Tokenize if validation passes
        const tokenId = await selfHostedVault.tokenizeCard({
            number: number.replace(/\s+/g, ''), // Remove spaces
            exp,
            cvv
        });

        // invalidate the cache
        await cacheInvalidation(req, tokenId)

        res.status(200).json({
            status: "success",
            token: tokenId
        });

    } catch (error) {
        logger.error('Error occurred while tokenizing card:', error);
        return next(new APIError('Internal server error', 500));
    }
};

export const getSingleLinkedAccount = async(req:Request, res:Response, next:NextFunction)=>{
    try {
        
    } catch (error) {
        logger.error(`Error occured while getting a single account`, error)
        return next(new APIError(`Internal server error`, 500))
    }
}