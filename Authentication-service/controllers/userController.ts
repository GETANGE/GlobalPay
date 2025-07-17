import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken"
import dotenv from "dotenv"
import logger from "../utils/logger";
import APIError from "../utils/APIError";
import client from "../configs/db-config";
import { getUser } from "../helperFunctions/userHelper";

dotenv.config()

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
    await req.redisClient.setex(cachedKey, 3600, JSON.stringify(result)); // TTL: 1 hr
  
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
        await req.redisClient.setex(cachedKey, 3600, JSON.stringify(user)); // TTL: 1 hr

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

export const deleteUser = async(req:any, res:Response, next:NextFunction)=>{
  try {
    const id = req.params;
    
    const user = await getUser({ id: id});

    if(!user){
      return next(new APIError(`User not found`, 500))
    }

    const userQuery = `DELETE FROM users WHERE id = $1`
    const values = [id]

    await client.query(userQuery, values)

    //invalidate cache
    await invalidateUserCache(req, id)

    res.status(200).json({
      status: "success",
      message: `User ${user.username} deleted successfully`
    })
  } catch (error) {
    logger.error(`Error deleting user account: ${error}`)
    return next(new APIError(`Internal server error`, 500))
  }
}

export const deactivateUser = async (req: any, res: Response, next: NextFunction) => {
  try {
    const requester = req.user; // Comes from protect middleware
    const targetUserId = parseInt(req.params.userId);

    if (isNaN(targetUserId)) {
      return next(new APIError("Invalid user ID provided.", 400));
    }

    // Only the user themself or an admin can deactivate
    if (requester.role !== "admin" && requester.id !== targetUserId) {
      return next(new APIError("Unauthorized to deactivate this account.", 403));
    }

    const query = `
      UPDATE users 
      SET 
        active = $3, 
        deleted_at = CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Nairobi',
        deleted_by = $2
      WHERE id = $1
    `;

    await client.query(query, [targetUserId, requester.username, false]); 

    res.status(200).json({ 
      status: "success",
      message: "User deactivated successfully."
    });
  } catch (error) {
    logger.error(`Error deactivating user: ${error}`);
    return next(new APIError("Internal server error", 500));
  }
};

export const activateUser = async(req:Request, res:Response, next:NextFunction)=>{
  try {
    const { userId } = req.params;

    if(!userId){
      return next(new APIError(`Invalid user ID provided.`, 400))
    }

    const query = `
      UPDATE users 
      SET 
        active = $3, 
        deleted_at = null,
        deleted_by = $2
      WHERE id = $1
    `;

    await client.query(query, [userId, null, true]); 

    res.status(200).json({ 
      status: "success",
      message: "User activated successfully."
    });
  } catch (error) {
    logger.error(`Error activating user: ${error}`)
    return next(new APIError(`Internal server error`, 500))
  }
}