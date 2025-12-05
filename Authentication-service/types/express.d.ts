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

export interface SmsData {
  userId: string;
  hashedToken: string;
  expiresAt: Date;
}

export interface EmailData {
  userId: string;
  hashedToken: string;
  expiresAt: Date;
}

export {};
