import { NextFunction, Request, Response } from "express";
import APIError from "../utils/APIError";
import logger from "../utils/logger";
import { getFCM_Tokens } from "../services/fcm.service";
import redisClient from "../configs/redis-config";
import { messaging } from "../configs/firebase-config";
import {
  getAllBroadcastTopics_service,
  getBroadcastById_service,
} from "../services/broadcast.fcm.service";
import { notificationQueue } from "../events/queues/notification.queue";

const BROADCAST_TOPICS_CACHE_KEY = "broadcast:topics";
const CACHE_EXPIRES_IN_SECONDS = 300;

export const subscribeUserToTopic = async (
  req: any,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { topic } = req.body;
    const user_id = req.user.id;

    if (!user_id || !topic) {
      return next(new APIError("user_id and topic are required", 400));
    }

    const tokens = await getFCM_Tokens(user_id);
    const tokenList = tokens.map((t) => t.token);

    if (tokenList.length === 0) {
      return next(new APIError("User has no FCM tokens to subscribe", 404));
    }

    const response = await messaging.subscribeToTopic(tokenList, topic);

    logger.info(
      `Subscribed user ${user_id} (${tokenList.length} tokens) to topic ${topic}`,
    );

    res.status(200).json({
      message: "User subscribed to topic successfully",
      subscribedTokens: tokenList.length,
      successCount: response.successCount,
      failureCount: response.failureCount,
      errors: response.errors,
    });
  } catch (err) {
    logger.error("Failed to subscribe user to FCM topic" + err);
    return next(new APIError("Internal server error", 500));
  }
};

export const unsubscribeUserFromTopic = async (
  req: any,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { topic } = req.body;
    const user_id = req.user.id;

    if (!user_id || !topic) {
      return next(new APIError("user_id and topic are required", 400));
    }

    const tokens = await getFCM_Tokens(user_id);
    const tokenList = tokens.map((t) => t.token);

    if (tokenList.length === 0) {
      return next(new APIError("User has no FCM tokens to unsubscribe", 404));
    }

    const response = await messaging.unsubscribeFromTopic(tokenList, topic);

    // send to the notification queue
    await notificationQueue({ action: "unsubscribe", userId: user_id, topic });

    logger.info(
      `Unsubscribed user ${user_id} (${tokenList.length} tokens) from topic ${topic}`,
    );

    res.status(200).json({
      message: "User unsubscribed from topic successfully",
      unsubscribedTokens: tokenList.length,
      successCount: response.successCount,
      failureCount: response.failureCount,
      errors: response.errors,
    });
  } catch (err) {
    logger.error("Failed to unsubscribe user from FCM topic", err);
    return next(new APIError("Internal server error", 500));
  }
};

export const createBroadcast = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { userId, topic, description } = req.body;

    if (!userId || !topic) {
      throw new APIError("userId and topic are required", 400);
    }

    // send to the notification queue
    await notificationQueue({
      action: "broadcast",
      userId,
      topic,
      description,
    });

    return res.status(201).json({
      status: "success",
      message: "Broadcast added to queue successfully",
    });
  } catch (err) {
    logger.error(err);
    return next(new APIError("Internal server error", 500));
  }
};

export const getAllBroadcastTopics = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const cached = await redisClient.get(BROADCAST_TOPICS_CACHE_KEY);

    if (cached) {
      return res.status(200).json({
        status: "success",
        source: "cache",
        data: JSON.parse(cached),
      });
    }

    const topics = await getAllBroadcastTopics_service();

    if (topics.length === 0) {
      return next(new APIError("No broadcast topics found", 500));
    }

    await redisClient.setex(
      BROADCAST_TOPICS_CACHE_KEY,
      CACHE_EXPIRES_IN_SECONDS,
      JSON.stringify(topics),
    );

    return res.status(200).json({
      status: "success",
      source: "database",
      data: topics,
    });
  } catch (err) {
    logger.error(err);
    return next(new APIError("Failed to fetch broadcast topics", 500));
  }
};

export const deleteBroadcast = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { broadcastId } = req.params;

    if (!broadcastId) {
      throw new APIError("Broadcast ID is required", 400);
    }

    await notificationQueue({ action: "delete-broadcast", broadcastId });

    return res.status(200).json({
      status: "success",
      message: "Broadcast deletion added to queue successfully",
    });
  } catch (err) {
    logger.error(err);
    return next(new APIError("Internal server error", 500));
  }
};

export const updateBroadcast = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { broadcastId } = req.params;
    const { topic, description } = req.body;

    if (!broadcastId) {
      throw new APIError("Broadcast ID is required", 400);
    }

    await notificationQueue({
      action: "update-broadcast",
      broadcastId,
      topic,
      description,
    });

    return res.status(200).json({
      status: "success",
      message: "Broadcast updated successfully",
    });
  } catch (err) {
    logger.error(err);
    return next(new APIError("Internal server error", 500));
  }
};

export const getBroadcastById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;

    if (!id) {
      throw new APIError("Broadcast ID is required", 400);
    }

    const cacheKey = `${BROADCAST_TOPICS_CACHE_KEY}${id}`;

    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return res.status(200).json({
        status: "success",
        source: "cache",
        data: JSON.parse(cached),
      });
    }

    const broadcast = await getBroadcastById_service(id);

    if (!broadcast) {
      return next(new APIError("Broadcast not found", 404));
    }

    // Cache it
    await redisClient.setex(
      cacheKey,
      CACHE_EXPIRES_IN_SECONDS,
      JSON.stringify(broadcast),
    );

    res.status(200).json({
      status: "success",
      source: "database",
      data: broadcast,
    });
  } catch (err) {
    logger.error(err);
    return next(new APIError("Internal server error", 500));
  }
};
