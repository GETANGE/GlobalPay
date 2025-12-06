import type { NextFunction, Request, Response} from "express";
import logger from "../utils/logger";
import APIError from "../utils/APIError";

export const authenticateRequest = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  const userId = req.headers["x-user-id"];
  const role = req.headers["x-user-role"];

  if (!userId) {
    logger.warn("Access attempted without userId");
    return next(new APIError("Authentication is required! Please login to continue", 401));
  }

  // Add user info to request for use in other middleware/controllers
  req.user = {
    id: userId,
    role: role || "user", // default role if not present
  };

  next();
};

// configurable middleware
export const authorizeRoles = (...roles: string[]) => {
  return (req: any, res: Response, next: NextFunction) => {
    const user = req.user;

    if (!user || !roles.includes(user.role)) {
      return next(new APIError("Access denied. Insufficient permissions.", 403));
    }

    next();
  };
};
