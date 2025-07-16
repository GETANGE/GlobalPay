import { NextFunction, Request, Response } from "express";
import logger from "../utils/logger";
import APIError from "../utils/APIError";
import client from "../configs/db-config";

// cache validation
const invalidateUserCache = async (req: Request, userId: string | number) => {
    const userKey = `user:${userId}`;
    await req.redisClient.del(userKey);
  
    // Delete all paginated users cache
    const keys = await req.redisClient.keys("users:*");
    if (keys.length > 0) {
      await req.redisClient.del(...keys);
    }
  };

// get all users
export const getAllUsers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = (page - 1) * limit;
  
      const cachedKey = `users:${page}:${limit}`;
      const cachedUsers = await req.redisClient.get(cachedKey);
  
      try {
        if (cachedUsers) {
            const parsed = JSON.parse(cachedUsers);
             return res.status(200).json({
              status: "success",
              data: parsed,
              fromCache: true,
            });
          }
      } catch (error) {
        logger.warn(`Failed to parse cached data: ${error}`)
      }
  
      const usersQuery = `SELECT * FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2`;
      const { rows } = await client.query(usersQuery, [limit, offset]);
  
      const countQuery = `SELECT COUNT(*) AS total_items FROM users`;
      const countResult = await client.query(countQuery);
      const total_users = parseInt(countResult.rows[0].total_items);
  
      const result = {
        data: rows,
        currentPage: page,
        totalPages: Math.ceil(total_users / limit),
        totalUsers: total_users,
      };
  
    // Cache the result
    await req.redisClient.setex(cachedKey, 60, JSON.stringify(result)); // TTL: 60 seconds
  
    res.status(200).json({
        status: "success",
        data: result,
        fromCache: false,
      });
    } catch (error) {
      logger.error(`Error getting all users: ${error}`);
      return next(new APIError("Internal server error", 500));
    }
  };

export const getSingleUser = async(req:Request, res:Response, next:NextFunction)=>{
    try {
        const { userId } = req.params
        const cachedKey = `user:${userId}`;
        const cachedUser = await req.redisClient.get(cachedKey);

        if(cachedUser){
            return res.status(200).json({
                status:"success",
                data: JSON.parse(cachedUser),
                fromCache: true
            })
        }

        const userQuery = `SELECT * FROM users WHERE id = $1`
        const result = await client.query(userQuery, [userId])

        if(result.rows.length === 0){
            return next(new APIError(`User not found`, 404))
        }

        const user = result.rows[0]

        // Cache the result
        await req.redisClient.setex(cachedKey, 60, JSON.stringify(user)); // TTL: 60 seconds

        res.status(200).json({
            status:"success",
            data: user,
            fromCache: false
        })
    } catch (error) {
        logger.error(`Error getting a single user`);
        return next(new APIError(`Internal server error`, 500))
    }
}