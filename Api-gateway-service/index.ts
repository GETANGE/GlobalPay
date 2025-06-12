import express, {type NextFunction, type Request, type Response} from "express"
import dotenv from "dotenv"
import helmet from "helmet";
import { Redis } from "ioredis"
import cors from "cors"

import logger from "./utils/logger";
import { corsOptions } from "./configs/cors-config";
import { rateLimit } from "express-rate-limit";
import APIError, { errorHandler } from "./controllers/errorHandler";
import RedisStore from "rate-limit-redis";

dotenv.config()

const app = express();

const PORT = process.env.GATEWAY_PORT as string || 3000;

app.use(helmet())

app.use(express.json());

app.use(cors(corsOptions));

// Rate limiting
const redisClient = new Redis(process.env.REDIS_URL as string)

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
})

app.use(ratelimit)

app.get('/', (req:Request, res:Response) =>{
    res.status(200).json({
        status:"success",
        message:"Welcome to the BaseUrl of GlobalPay"
    })
})

app.use(errorHandler)

app.listen(()=>{
    logger.info(`🦈 Api-gateway is listening on port: ${PORT}`)
})