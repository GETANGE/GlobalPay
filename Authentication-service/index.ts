import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import helmet from "helmet";
import dotenv from "dotenv";
import morgan from "morgan";
import passport from "passport";
import cors from "cors";
import { Redis } from "ioredis";
import rateLimit from "express-rate-limit";
import { RateLimiterMemory } from "rate-limiter-flexible";
import { githubStrategy, googleStrategy } from "./helperFunctions/passport";
import RedisStore from "rate-limit-redis";
import logger from "./utils/logger";
import { connectDatabase } from "./configs/db-config";
import { corsOptions } from "./configs/cors-config";

import userRoutes from "./routes/userRoute";
import { connectToRabbitMQ } from "./utils/rabbitMQ";
import "./utils/sms"; //Triggers processor
import "./utils/email";
import APIError from "./utils/APIError";
import { Errorhandlers } from "./controllers/errorHandlingController";

dotenv.config();

const PORT = (process.env.AUTH_PORT as string) || 3001;

githubStrategy();
googleStrategy();

const app = express();

app.use(helmet());
app.use(passport.initialize());
app.use(express.json());
app.use(morgan("dev"));
app.use(cors(corsOptions));

const redisClient = new Redis(process.env.REDIS_URL as string);

redisClient.on("error", (error) => {
  logger.warn(`Error connecting to redis`, error);
});

redisClient.on("connect", () => {
  logger.info(`🍃 Redis connected successfully`);
});

// Prevent DDoS aatacks
const rateLimiter = new RateLimiterMemory({
  keyPrefix: "middleware",
  points: 10,
  duration: 1,
});

app.use((req: any, res: Response, next: NextFunction) => {
  rateLimiter
    .consume(req.ip)
    .then(() => next())
    .catch(() => {
      logger.warn(`Global rate limit exceeded for IP:${req.ip}`);
      return next(new APIError(`Too many requests`, 429));
    });
});

//IP-based rate limiting
const SensitiveEndopointRatelimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response, next: NextFunction) => {
    logger.warn(`⛔ Sensitive endpoint rate limit exceeded for IP: ${req.ip}`);
    return next(new APIError(`Too many requests`, 429));
  },
  store: new RedisStore({
    sendCommand: (...args: [string, ...string[]]): Promise<any> => {
      return redisClient.call(...args);
    },
  }),
  skip: () => !redisClient.status,
});

app.use(SensitiveEndopointRatelimit);

app.use("/auth", userRoutes);

app.get("/", (req: Request, res: Response) => {
  res.status(200).json({
    status: "success",
    message: "Authentication-service health-check",
  });
});

// Handling unhandled routes
app.use((req: Request, res: Response, next: NextFunction) => {
  next(
    new APIError(`This route ${req.originalUrl} is not yet defined...`, 404)
  );
});

app.use(Errorhandlers);

async function startServer() {
  await connectDatabase();
  app.listen(PORT, () => {
    logger.info(`🔐 Auth server is running on port : ${PORT}`);
  });
}
startServer();

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  process.exit(1); // Exit to prevent an unstable state
});

process.on("unhandledRejection", (err: any) => {
  console.error("Unhandled Promise Rejection:", err);
  process.exit(1);
});
