import { NextFunction, Request, Response } from "express";
import logger from "../utils/logger";
import APIError from "../utils/APIError";
import redisClient from "../configs/redis-config";
import { getFCM_Tokens, getFCM_Token } from "../services/fcm.service";
import { DeviceTokensQueue } from "../events/queues/notification.queue";

export const saveDeviceToken = async (
  req: any,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { token, device_type } = req.body;
    const userId = req.user.id;

    if (!token || !device_type) {
      return next(new APIError("token and device_type are required", 400));
    }

    await DeviceTokensQueue({ action: "save", userId, token, device_type });

    res.status(200).json({
      status: "success",
      message: "Device token queued for saving",
    });
  } catch (error) {
    logger.error(error);
    next(new APIError("Internal Server Error", 500));
  }
};

export const deleteDeviceToken = async (
  req: any,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { token } = req.body;
    const userId = req.user.id;

    if (!token) {
      return next(new APIError("token is required", 400));
    }

    await DeviceTokensQueue({ action: "delete", userId, token });

    res.status(200).json({
      status: "success",
      message: "Device token queued for deletion",
    });
  } catch (error) {
    logger.error(error);
    next(new APIError("Internal Server Error", 500));
  }
};

export const updateDeviceToken = async (
  req: any,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { token, device_type } = req.body;
    const userId = req.user.id;

    if (!token || !device_type) {
      return next(new APIError("token and device_type are required", 400));
    }

    await DeviceTokensQueue({ action: "update", userId, token, device_type });

    res.status(200).json({
      status: "success",
      message: "Device token queued for update",
    });
  } catch (error) {
    logger.error(error);
    next(new APIError("Internal Server Error", 500));
  }
};

export const getDeviceTokens = async (
  req: any,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user.id;

    const cacheKey = `device_tokens_${userId}`;

    const cachedTokens = await redisClient.get(cacheKey);
    if (cachedTokens) {
      const tokens = JSON.parse(cachedTokens);
      return res.status(200).json({
        status: "success",
        data: tokens,
      });
    }

    const tokens = await getFCM_Tokens(userId);

    await redisClient.set(cacheKey, JSON.stringify(tokens), "EX", 60 * 60 * 24);

    res.status(200).json({
      status: "success",
      data: tokens,
    });
  } catch (error: any) {
    logger.error(error);
    return next(new APIError("Internal Server Error", 500));
  }
};

export const getSingleDeviceToken = async (
  req: any,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user.id;
    const token = req.params.token;

    const cacheKey = `device_tokens_${userId}_${token}`;

    const cachedToken = await redisClient.get(cacheKey);
    if (cachedToken) {
      const deviceToken = JSON.parse(cachedToken);
      return res.status(200).json({
        status: "success",
        data: deviceToken,
      });
    }

    const deviceToken = await getFCM_Token(userId, token);

    await redisClient.set(
      cacheKey,
      JSON.stringify(deviceToken),
      "EX",
      60 * 60 * 24,
    );

    res.status(200).json({
      status: "success",
      data: deviceToken,
    });
  } catch (error: any) {
    logger.error(error);
    return next(new APIError("Internal Server Error", 500));
  }
};
