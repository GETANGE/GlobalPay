import jwt from "jsonwebtoken";
import APIError from "../controllers/errorHandler";
import logger from "../utils/logger";
import type { Request, Response, NextFunction } from "express";

export const validateToken = (req: any, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    logger.warn("Missing or malformed Authorization header");
    return next(new APIError("Authentication required", 401));
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    logger.warn("Access attempt without token");
    return next(new APIError("Authentication required", 401));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string);
    req.user = decoded;
    next();
  } catch (err: any) {
    logger.warn(`Invalid Token: ${err.message}`);
    return next(new APIError("Invalid or expired token", 401));
  }
};
