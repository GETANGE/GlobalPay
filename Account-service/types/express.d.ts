import { Redis } from "ioredis";

declare global {
  namespace Express {
    interface Request {
      redisClient: Redis;
    }
  }
}

export interface PublishNotificationPayload {
  action: "notification" | "broadcast-notification";
  title: string;
  body: string;
  extraData?: Record<string, any>;
  device_type: "android" | "ios" | "web" | "all";
  priority: "high" | "normal" | "low";
  userId?: string;          // for direct notifications
  broadcast_topic?: string; // for broadcasts
}

export {};
