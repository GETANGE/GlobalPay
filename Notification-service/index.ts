import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import helmet from "helmet";
import dotenv from "dotenv";
import morgan from "morgan";
import cors from "cors";
import { Redis } from "ioredis";
import rateLimit from "express-rate-limit";
import { RateLimiterMemory } from "rate-limiter-flexible";
import RedisStore from "rate-limit-redis";
import logger from "./utils/logger";
import { connectDatabase } from "./configs/db-config";
import { corsOptions } from "./configs/cors-config";

import APIError from "./utils/APIError";
import { Errorhandlers } from "./controllers/errorHandlingController";
import { attachRedis } from "./middlewares/attachRedis";

import { startRPCServer } from "./messaging/rpcServer";
import { getAllUserData, getSingleUserData } from "./eventHandlers/auth.events";
import {
  processEmailJobConsumer,
  processSMSJobConsumer,
} from "./events/consumers/auth_consumer";

dotenv.config();

const PORT = Number(process.env.AUTH_PORT) || 3001;

const app = express();

app.use(helmet());
app.use(express.json());
app.use(morgan("dev"));
app.use(cors(corsOptions));


const redisUrl =
  process.env.NODE_ENV === "production"
    ? process.env.REDIS_URL_PROD
    : process.env.REDIS_URL_DEV;

const redisClient = new Redis(redisUrl as string);

redisClient.on("connect", () => {
  logger.info(`🍃 Redis connected successfully`);
});

redisClient.on("error", (error) => {
  logger.warn(`⚠️ Redis connection error:`, error);
});

const rateLimiter = new RateLimiterMemory({
  keyPrefix: "global",
  points: 10,
  duration: 1, // 10 requests per second
});

app.use((req: any, res: Response, next: NextFunction) => {
  rateLimiter
    .consume(req.ip)
    .then(() => next())
    .catch(() => {
      logger.warn(`⚠️ Global rate limit exceeded for IP: ${req.ip}`);
      next(new APIError("Too many requests", 429));
    });
});

const SensitiveEndpointRatelimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 mins
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    logger.warn(`⛔ Sensitive endpoint limit exceeded | IP: ${req.ip}`);
    next(new APIError("Too many requests", 429));
  },
  store: new RedisStore({
    sendCommand: (...args: [string, ...string[]]): Promise<any> => {
      return redisClient.call(...args);
    },
  }),
});

// apply only to sensitive routes
app.use(SensitiveEndpointRatelimit as any);

app.use("/auth", attachRedis(redisClient));

app.get("/", (req: Request, res: Response) => {
  res.status(200).json({
    status: "success",
    message: "Auth-Service health-check",
  });
});

app.use((req: Request, res: Response, next: NextFunction) => {
  next(new APIError(`Route ${req.originalUrl} not found`, 404));
});

app.use(Errorhandlers);

async function startServer() {
  try {
    await connectDatabase();

    // Consumers / Workers
    await processEmailJobConsumer();
    await processSMSJobConsumer();

    // RPC (Request-Response) handlers
    await startRPCServer("auth-service.get-users-by-ids", getAllUserData);

    await startRPCServer("auth-service.get-user-by-id", getSingleUserData);

    app.listen(PORT, () => {
      logger.info(`🔐 Auth server running at port ${PORT}`);
    });
  } catch (error) {
    logger.error("🔥 Failed to initialize Auth service:", error);
    process.exit(1);
  }
}

startServer();

process.on("uncaughtException", (err) => {
  logger.error("❌ Uncaught Exception:", err);
  process.exit(1);
});

process.on("unhandledRejection", (err) => {
  logger.error("❌ Unhandled Promise Rejection:", err);
  process.exit(1);
});

process.on("SIGINT", () => {
  logger.info("SIGINT signal received");
  process.exit(0);
});