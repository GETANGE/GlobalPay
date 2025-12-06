import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import helmet from "helmet";
import dotenv from "dotenv";
import morgan from "morgan";
import cors from "cors";
import redisClient from "./configs/redis-config";
import rateLimit from "express-rate-limit";
import { RateLimiterMemory } from "rate-limiter-flexible";
import RedisStore from "rate-limit-redis";
import logger from "./utils/logger";
import { connectDatabase } from "./configs/db-config";
import { corsOptions } from "./configs/cors-config";

import APIError from "./utils/APIError";
import { Errorhandlers } from "./controllers/errorHandlingController";
import { attachRedis } from "./middlewares/attachRedis";
import notificationRoute from "./routes/notification.routes";

import {
  processEmailJobConsumer,
  processSMSJobConsumer,
} from "./events/consumers/auth_consumer";
import { deadLetterQueue } from "./events/queues/DLQ.queue";
import { initSocket } from "./configs/socket";
import { processNotificationConsumer } from "./events/consumers/notif_consumer";

dotenv.config();

const app = express();
const PORT = Number(process.env.AUTH_PORT) || 3006;

app.use(helmet());
app.use(express.json());
app.use(morgan("dev"));
app.use(cors(corsOptions));

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

app.use("/notification", attachRedis(redisClient), notificationRoute);

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

// Initialize WebSocket
const server = app.listen(PORT, () => {
  logger.info(`🔔 Notification server running at port ${PORT}`);
});

initSocket(server);

async function startServer() {
  try {
    // 1. Connect to Database
    await connectDatabase();

    // 2. Start Consumers / Workers
    await processEmailJobConsumer();
    await processSMSJobConsumer();
    await processNotificationConsumer();

    // 3. Start Dead Letter Queue consumer
    await deadLetterQueue();

    logger.info(`🔔 Notification service fully initialized on port ${PORT}`);
  } catch (error: any) {
    logger.error("🔥 Failed to initialize notification service:", error);
    process.exit(1);
  }
}

// Handle uncaught exceptions/rejections
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

startServer();