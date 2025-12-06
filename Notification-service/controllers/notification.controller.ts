import { NextFunction, Request, Response } from "express";
import APIError from "../utils/APIError";
import { notificationQueue } from "../events/queues/notification.queue";
import logger from "../utils/logger";

export const readNotification = async (req: any, res: Response, next: NextFunction) => {
  try {
    const { notificationId, status } = req.body;
    const userId = req.user.id;

    if (!notificationId || !status) {
      return next(new APIError("notificationId and status are required", 400));
    }

    await notificationQueue({ notificationId, userId, status });

    res.status(200).json({
      status: "success",
      message: `Notification update queued successfully`,
    });
  } catch (error: any) {
    logger.error(error);
    return next(new APIError("Internal Server Error", 500));
  }
};

export const readAllNotifications = async (req: any, res: Response, next: NextFunction) => {
  try {
    const userId = req.user.id;
    
    if(!userId) {
      return next(new APIError("User ID is required", 400));
    }

    await notificationQueue({ userId, status: "READ" });

    res.status(200).json({
      status: "success",
      message: `Notification update queued successfully`,
    });
  } catch (error: any) {
    logger.error(error);
    return next(new APIError("Internal Server Error", 500));
  }
};
