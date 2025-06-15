import express, {type NextFunction, type Request, type Response} from "express"
import dotenv from "dotenv"
import helmet from "helmet";
import { Redis } from "ioredis"
import cors from "cors"

import logger from "./utils/logger";
import { corsOptions } from "./configs/cors-config";
import { rateLimit } from "express-rate-limit";
import APIError from "./controllers/errorHandler";
import RedisStore from "rate-limit-redis";

dotenv.config()

const app = express();

const PORT = process.env.GATEWAY_PORT as string || 3000;

app.use(helmet())

app.use(express.json());

app.use(cors(corsOptions));

// IP-based Rate limiting
const redisClient = new Redis(process.env.REDIS_URL as string);

redisClient.on("error", (err)=>{
    logger.warn(`Redis connections error: ${err.message}`)
})

redisClient.on("connect", ()=>{
    logger.info(`🚀 Redis connected successfully`)
})

const ratelimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req:Request, res:Response, next:NextFunction) => {
        logger.warn(`Sensitive endpoint rate limit exceeded for IP: ${req.ip}`)
        return next(new APIError(`Too many requests`, 429))
    },
    store: new RedisStore({
        sendCommand: (...args: [string, ...string[]]): Promise<any> => {
            return redisClient.call(...args);
        }
    }),
    skip: () => !redisClient.status
})

app.use(ratelimit)

app.get('/', (req:Request, res:Response) =>{
    res.status(200).json({
        status:"success",
        message:"Welcome to the BaseUrl of GlobalPay"
    })
})

// Forward Proxies 

interface CustomError{
  statusCode: number;
  status: string;
  message: string
}

app.use(( err: CustomError, req: Request, res: Response, next: NextFunction ) => {
  let status = err.status || 'Internal server error'
  let statusCode = err.statusCode || 500

  res.status(statusCode).json({
    status: status,
    message: err.message
  });
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err.message);
  process.exit(1); // Exit to prevent an unstable state
});

// Handle unhandled promise rejections (async errors outside Express)
process.on("unhandledRejection", (err: any) => {
  console.error("Unhandled Promise Rejection:", err.message);
  process.exit(1);
});

app.listen(PORT, ()=>{
    logger.info(`🦈 Api-gateway is listening on port: ${PORT}`)
})