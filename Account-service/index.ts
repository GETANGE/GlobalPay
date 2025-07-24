import express, { type Response, type NextFunction, type Request} from "express"
import dotenv from "dotenv"
import helmet from "helmet"
import morgan from "morgan"
import cors from "cors"
import { Redis } from "ioredis"
import rateLimit from "express-rate-limit"
import { RateLimiterMemory } from "rate-limiter-flexible"
import RedisStore from "rate-limit-redis";
import logger from "./utils/logger";
import { corsOptions } from "./configs/cors-config"
import APIError from "./utils/APIError"
import { connectDatabase } from "./configs/db-config"
import { Errorhandlers } from "./controllers/errorHandlingController"
import { connectToRabbitMQ, consumeEvent } from "./utils/RabbitMQ"
import { handleAccountCreation } from "./eventHandlers/wallet.events"
import { attachRedis } from "./middlewares/attatchRedis";

import accountRoute from "./routes/account.routes"

dotenv.config()

const PORT = process.env.PORT || 3002
const app = express();

app.use(express.json())
app.use(helmet())
app.use(morgan("dev"))
app.use(cors(corsOptions))

// initialize redis
const env = process.env.NODE_ENV || "development";

const redis_url =
    env === "production"
    ? process.env.REDIS_URL_PROD
    : process.env.REDIS_URL_DEV;

const redisClient = new Redis( redis_url  as string);

redisClient.on("error", (error) => {
  logger.warn(`Error connecting to redis`, error);
}); 

redisClient.on("connect", () => {
  logger.info(`🍁 Redis connected successfully`);
});

// Prevent DDoS atacks
const rateLimiter = new RateLimiterMemory({
    keyPrefix: 'middleware',
    points: 10,
    duration: 1
})

app.use((req:any , res:Response, next:NextFunction)=>{
    rateLimiter.consume(req.ip).then(() => next()).catch(()=>{
        logger.warn(`Global rate limit exceeded for ip:${req.ip}`)
        return next(new APIError(`Too many requests`, 429))
    })
})

// IP-based rate limiting
const sensitiveEndpointRatelimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req:Request, res:Response, next:NextFunction)=>{
        logger.warn(`Sensitive endpoint ratelimit exceeded for IP:${req.ip}`)
        return next(new APIError(`Too many requests`, 429))
    },
    store: new RedisStore({
        sendCommand:(...args:[ string, ...string[]]): Promise<any> =>{
            return redisClient.call(...args)
        }
    }),
    skip: ()=> !redisClient.status
})

app.use(sensitiveEndpointRatelimit);

app.get('/health', (req:Request, res:Response)=>{
    res.status(200).json({
        status:"success",
        message: "Account-service health-check"
    })
})

app.use('/account', attachRedis(redisClient), accountRoute)

// Handling unhandled routes
app.use((req: Request, res: Response, next: NextFunction) => {
  next(
    new APIError(`This route ${req.originalUrl} is not yet defined...`, 404)
  );
});

async function startServer() {
  await connectDatabase();
  await consumeEvent("account.created", handleAccountCreation);
  app.listen(PORT, () => {
    logger.info(`🏦 Account server is running on port : ${PORT}`);
  });
}
startServer();

// error handling
app.use(Errorhandlers);

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  process.exit(1); // Exit to prevent an unstable state
});

process.on("unhandledRejection", (err: any) => {
  console.error("Unhandled Promise Rejection:", err);
  process.exit(1);
});