import type {Request, Response, NextFunction } from "express";
import logger from "../utils/logger";
import APIError from "../utils/APIError";
import { selfHostedVault } from "../services/selfHostedVault";
import { linkAccount, validateCardNumber, validateCVV, validateExpirationDate } from "../helpers/cryptoHelper";
import client from "../configs/db-config";

const cacheInvalidation = async (req: Request, tokenId: string) => {
    const tokenKey = `token:${tokenId}`;
    await req.redisClient.del(tokenKey);

    const keys = await req.redisClient.keys("token:*"); // singular to match your naming
    if (keys.length > 0) {
        await req.redisClient.del(...keys);
    }
};

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

export const linkAccount_token = async (req: any, res: Response, next: NextFunction) => {
    try {
        const { number, exp, cvv, type } = req.body;

        const user_id = req.user

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

        const cardData = {
            number: number.replace(/\s+/g, ''), // Remove spaces
            exp,
            cvv
        }

        // Tokenize if validation passes
        const tokenId = await selfHostedVault.tokenizeCard(cardData);

        // Insert into linked_accounts table
        await linkAccount(user_id.id, type, tokenId)

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
        const { accountId } = req.params;

        if(!accountId){
            return next(new APIError(`AccountId is required`, 400))
        }

        const cachedKey = `token:${accountId}`;
        const cachedToken = await req.redisClient.get(cachedKey);

        if(cachedToken){
            try {
                const parsed = JSON.parse(cachedToken);

                return res.status(200).json({
                    status:"success",
                    data: parsed,
                    fromCache: true
                })
            } catch (error) {
                logger.error(`Error fetching from cache`)
                return next(new APIError(`Error fetching from the cache`, 400))
            }
        }

        const tokenQuery= `SELECT * FROM linked_accounts WHERE id=$1`
        const values = [accountId]

        const result = await client.query(tokenQuery, values)

        if(result.rows.length === 0){
            return next(new APIError(`Linked account not found`, 404))
        }

        // cache the result
        await req.redisClient.setex(cachedKey, 3600, JSON.stringify(result.rows[0]))
        // send response

        res.status(200).json({
            status:"success",
            data: result,
            fromCache: false
        })

    } catch (error) {
        logger.error(`Error occured while getting a single account`, error)
        return next(new APIError(`Internal server error`, 500))
    }
}

export const updateLinkedAccounts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { accountId } = req.params;
    const { number, exp, cvv } = req.body;

    if (!accountId) {
      return next(new APIError(`AccountId is required`, 400));
    }

    if (!number && !exp && !cvv) {
      return next(new APIError(`At least one field (number, exp, cvv) is required to update`, 400));
    }


    // invalidate cache
    const cachedKey = `token:${accountId}`;
    await req.redisClient.del(cachedKey);

    return res.status(200).json({
      status: "success"
    });

  } catch (error) {
    logger.error(`Error occurred while updating linked account`, error);
    return next(new APIError(`Internal server error`, 500));
  }
};
