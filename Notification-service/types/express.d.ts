import { Redis } from "ioredis";

declare global {
  namespace Express {
    interface Request {
      redisClient: Redis;
    }
  }
}

export interface EmailData{
    email: string;
    name: string;
    userId: number;
    subject: string;
    message: string;
    otp: number,
    hashedToken: string;
    expiresAt: string;
}

export interface SmsData{
    phone_number: string;
    name: string;
    message: string;
    userId: number;
    hashedToken: string;
    expiresAt: string
}

export interface NotificationPayload {
    notificationId?: string;
    userId: string;
    status: string;
    action: string;
}

export interface DeviceTokenPayload {
    userId: string;
    token: string;
    action: string;
    device_type?: string;
}

export interface PushNotificationPayload {
    title: string;
    message: string;
}

export interface AuthenticatedRequest {
    user: string;
    email: string;
    role: string;
}

export interface baseMessage {
    data: any;
    notification: any;
    android: any;
    webpush: any;
    apns: any;
}

export {};
