import express, {type NextFunction, type Request, type Response} from "express"
import dotenv from "dotenv"
import helmet from "helmet";
import proxy from "express-http-proxy"
import morgan from "morgan"
import { Redis } from "ioredis"
import cors from "cors"

import logger from "./utils/logger";
import { corsOptions } from "./configs/cors-config";
import { rateLimit } from "express-rate-limit";
import APIError from "./controllers/errorHandler";
import RedisStore from "rate-limit-redis";
import { validateToken } from "./middlewares/authMiddleware";

dotenv.config()

const app = express();

const PORT = process.env.GATEWAY_PORT as string || 3000;

app.use(helmet())

app.use(express.json());

app.use(morgan('dev'))

app.use(cors(corsOptions));

const env = process.env.NODE_ENV || "development";

const redis_url =
    env === "production"
    ? process.env.REDIS_URL_PROD
    : process.env.REDIS_URL_DEV

// IP-based Rate limiting
const redisClient = new Redis( redis_url as string)

redisClient.on('error', (error)=>{
    logger.warn(`Error connecting to redis`, error)
})

redisClient.on('connect', ()=>{
    logger.info(`🍃 Redis connected successfully`)
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

const isProd = process.env.NODE_ENV || "development";

const identity_url =
    isProd === "production"
    ? process.env.IDENTITY_SERVICE_URL_PROD
    : process.env.IDENTITY_SERVICE_URL_DEV

// Forward Proxies 
app.use("/api/v1/auth", proxy(identity_url as string, {
    proxyReqPathResolver: req => `/auth${req.url}`,
    // modify the outgoing request options before the proxy sends it to the target service.
    proxyReqOptDecorator:(proxyReqOpts:any, srcReq:any) =>{
        proxyReqOpts.headers["Content-type"] = "application/json"

        if (srcReq.user) {
            proxyReqOpts.headers["x-user-id"] = srcReq.user.id;
            proxyReqOpts.headers["x-user-role"] = srcReq.user.role;
        }

        return proxyReqOpts
    },
    // handle errors from the proxy itself
    proxyErrorHandler: (err:Error, res:Response, next:NextFunction)=>{
        logger.error(`Proxy error: ${err.message}`)
        return next(new APIError(`Internal server error`, 400))
    },
    //Lets you intercept the response and transform it before it is sent back to the client
    userResDecorator: (proxyRes:any, proxyResData:any, userReq:any, userRes:any) =>{
        logger.info(`Response received from AuthService`)
        return proxyResData
    }
}))

app.use("/api/v1/account", validateToken, proxy(process.env.ACCOUNT_SERVICE_URL_PROD as string, {
  proxyReqPathResolver: req => `/account${req.url}`,
  proxyReqOptDecorator: (proxyReqOpts: any, srcReq: any) => {
    // console.log("Forwarding headers with user:", srcReq.user);
    proxyReqOpts.headers["Content-type"] = "application/json";

    if (srcReq.user) {
      proxyReqOpts.headers["x-user-id"] = srcReq.user.userId;
      proxyReqOpts.headers["x-user-role"] = srcReq.user.role;
    }

    return proxyReqOpts;
  },
  proxyErrorHandler: (err: Error, res: Response, next: NextFunction) => {
    logger.error(`Proxy error: ${err.message}`);
    return next(new APIError(`Internal server error`, 400));
  },
  userResDecorator: (proxyRes: any, proxyResData: any, userReq: any, userRes: any) => {
    logger.info(`Response received from AccountService`);
    return proxyResData;
  }
}));


app.use((req: Request, res: Response, next: NextFunction) => {
  next(new APIError(`This route ${req.originalUrl} is not yet defined...`, 404));
});

interface CustomeError{
    statusCode: number;
    status: string;
    message: string
}

app.use((err: CustomeError, req:Request, res:Response, next:NextFunction)=>{
    let status = err.status || 'Internal server error'
    let statusCode = err.statusCode || 500

    res.status(statusCode).json({
        status: status,
        message: err.message || "Internal server error"
    })
})

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
    logger.info(`🔐 Aunthentification Service URL: ${identity_url}`)
})