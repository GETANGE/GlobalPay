import { NextFunction, Request, Response } from "express";
import APIError from "../utils/APIError";
import redisClient from "../configs/redis-config";
import { notificationQueue } from "../events/queues/notification.queue";
import { getSingleNotification, getUserNotifications } from "../services/notifications.service";
import logger from "../utils/logger";

export const readNotification = async (
  req: any,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { notificationId, status } = req.body;
    const userId = req.user.id;

    if (!notificationId || !status) {
      return next(new APIError("notificationId and status are required", 400));
    }

    await notificationQueue({ action: "read", notificationId, userId, status });

    res.status(200).json({
      status: "success",
      message: `Notification update queued successfully`,
    });
  } catch (error: any) {
    logger.error(error);
    return next(new APIError("Internal Server Error", 500));
  }
};

export const readAllNotifications = async (
  req: any,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user.id;

    if (!userId) {
      return next(new APIError("User ID is required", 400));
    }

    await notificationQueue({ action: "bulkRead", userId, status: "READ" });

    res.status(200).json({
      status: "success",
      message: `Notification update queued successfully`,
    });
  } catch (error: any) {
    logger.error(error);
    return next(new APIError("Internal Server Error", 500));
  }
};

export const deleteNotification = async (
  req: any,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.id;

    if (!notificationId) {
      return next(new APIError("notificationId is required", 400));
    }

    await notificationQueue({
      action: "delete",
      notificationId,
      userId,
      status: "DELETED",
    });

    res.status(200).json({
      status: "success",
      message: `Notification delete queued successfully`,
    });
  } catch (error: any) {
    logger.error(error);
    return next(new APIError("Internal Server Error", 500));
  }
};

export const deleteAllNotifications = async (
  req: any,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user.id;

    if (!userId) {
      return next(new APIError("User ID is required", 400));
    }

    await notificationQueue({
      action: "delete-all",
      userId,
      status: "DELETED",
    });

    res.status(200).json({
      status: "success",
      message: `Notification delete queued successfully`,
    });
  } catch (error: any) {
    logger.error(error);
    return next(new APIError("Internal Server Error", 500));
  }
};

export const getSingleNotificationById = async (
  req: any,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.id;

    if (!notificationId) {
      return next(new APIError("notificationId is required", 400));
    }

    const cachedKey = `notifications:${notificationId}:${userId}`;
    const cachedNotification = await redisClient.get(cachedKey);

    if (cachedNotification) {
      return res.status(200).json({
        status: "success",
        data: JSON.parse(cachedNotification),
      });
    }

    const notification = await getSingleNotification(notificationId, userId);

    if (!notification) {
      return next(new APIError("Notification not found", 404));
    }

    res.status(200).json({
      status: "success",
      data: notification,
    });
  } catch (error: any) {
    logger.error(error);
    return next(new APIError("Internal Server Error", 500));
  }
};

export const getAllNotifications = async (
  req: any,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user.id;
    
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;

    if (!userId) {
      return next(new APIError("User ID is required", 400));
    }

    const notifications = await getUserNotifications(userId, page, limit);

    if (!notifications || notifications.notifications.length === 0) {
      return next(new APIError("No notifications found", 404));
    }
    
    res.status(200).json({
      status: "success",
      data: notifications,
    });
  } catch (error: any) {
    logger.error(error);
    return next(new APIError("Internal Server Error", 500));
  }
};