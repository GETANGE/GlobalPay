import type { NextFunction, Response, Request } from "express";
import logger from "../utils/logger";
import APIError from "../utils/APIError";
import client from "../configs/db-config";
import { sendRPCRequest } from "../messaging/rpcClient";

const cacheInvalidation = async(req:Request, accountId: string | number)=>{
    const accountKey = `account:${accountId}`;
    await req.redisClient.del(accountKey)

    const keys = await req.redisClient.keys("accounts:*");
    if(keys.length > 0){
        await req.redisClient.del(accountKey)
    }
}

export const getAllAccounts = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const offset = (page - 1) * limit;

        const cachedKey = `accounts:${page}:${limit}`;
        const cachedAccounts = await req.redisClient.get(cachedKey);

        if (cachedAccounts) {
            try {
                const parsed = JSON.parse(cachedAccounts);
                return res.status(200).json({
                    status: "success",
                    data: parsed,
                    fromCache: true,
                });
            } catch (error) {
                logger.error(`Failed to parse cached data: ${error}`);
            }
        }

        const walletQuery = `SELECT * FROM wallets ORDER BY created_at DESC LIMIT $1 OFFSET $2`;
        const { rows: wallets } = await client.query(walletQuery, [limit, offset]);

        // Get all user IDs from wallets
        const userIds = wallets.map((wallet) => wallet.user_id);

        // Fetch user data from Auth Service via RPC
        let users: any = {};
        try {
            const userDataResponse = await sendRPCRequest("auth-service.get-users-by-ids", { userIds }, 5000);

            // Convert array of users into a map for quick lookup
            users = userDataResponse.data.reduce((acc: Record<string, any>, user: any) => {
                acc[user.id] = user;
                return acc;
            }, {});
        } catch (error) {
            logger.error(`Failed to fetch user data from Auth Service: ${error}`);
            return next(new APIError(`Failed to fetch user data from Auth Service`, 400))
        }

        // Merge wallet data with user data
        const enrichedWallets = wallets.map((wallet) => ({
            ...wallet,
            user: users[wallet.user_id] || null,
        }));

        const countQuery = `SELECT COUNT(*) AS total_accounts FROM wallets`;
        const counterResult = await client.query(countQuery);
        const total_accounts = parseInt(counterResult.rows[0].total_accounts);

        const result = {
            data: enrichedWallets,
            currentPage: page,
            totalPages: Math.ceil(total_accounts / limit),
            totalAccounts: total_accounts,
        };

        await req.redisClient.setex(cachedKey, 3600, JSON.stringify(result));

        res.status(200).json({
            status: "success",
            data: result,
            fromCache: false,
        });
    } catch (error) {
        logger.error(`Error getting all user accounts: ${error}`);
        return next(new APIError("Internal server error", 500));
    }
};

export const getSingleAccount = async(req:Request, res:Response, next:NextFunction) =>{
    try {
        const { account_id } = req.params;

        const cachedKey = `account:${account_id}`
        const cachedAccount = await req.redisClient.get(cachedKey)

        if(cachedAccount){
            try {
                const parsed = JSON.parse(cachedAccount)

                return res.status(200).json({
                    status: "success",
                    data: parsed,
                    fromCache: true,
                });
            } catch (error) {
                logger.error(`Error fetching from cache`)
                return next(new APIError(`Error fetching from cache`, 400))
            }
        }

        const userQuery = `SELECT * FROM wallets WHERE wallet_id = $1`
        const values = [account_id]

        const userData = await client.query(userQuery, values)

        // Request User data from Auth service(via RPC)
        let user: any;

        const userId = userData.rows[0].user_id

        try {
            const userDataResponse = await sendRPCRequest("auth-service.get-user-by-id", { userId }, 5000)
            user = userDataResponse
        } catch (error) {
            logger.error(`Failed to fetch user data from Auth Service: ${error}`);
            return next(new APIError(`Failed to fetch user data from Auth Service`, 400))
        }

        const results = {
            ...userData.rows[0],
            user
        }

        await req.redisClient.setex(cachedKey, 3600, JSON.stringify(results))

        res.status(200).json({
            status:"success",
            data: results,
            fromCache: false
        })
    } catch (error) {
        logger.error(`Error getting single account: ${error}`)
        return next(new APIError(`Internal server error`, 500))
    }
}

export const updateAccount = async(req:Request, res:Response, next:NextFunction) =>{
    try {
        
    } catch (error) {
        
    }
}

export const deleteAccount = async(req:Request, res:Response, next:NextFunction) =>{
    try {
        
    } catch (error) {
        
    }
}