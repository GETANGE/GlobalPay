import express, { NextFunction, type Request, type Response} from "express"
import helmet from "helmet"
import dotenv from "dotenv"
import { Redis } from "ioredis"
import logger from "./utils/logger"
import APIError from "./controllers/errorHandler"

dotenv.config()

const PORT =process.env.AUTH_PORT as string || 3001

const app = express()

app.use(helmet());
app.use(express.json())

const redisClient = new Redis(process.env.REDIS_URL as string)

redisClient.on('error', (error)=>{
    logger.warn(`Error connecting to redis`, error)
})

redisClient.on('connect', ()=>{
    logger.info(`Redis connected successfully`)
})

// rate limiting



app.get('/', (req:Request, res:Response) => {
    res.status(200).json({
        status:'success',
        message: 'Authentication-service health-check'
    })
})

// handling unhandled routes
app.use((req: Request, res: Response, next: NextFunction) => {
    return next(new APIError(`This route ${req.originalUrl} is not yet defined...`, 401));
});

app.listen(PORT, ()=>{
    logger.info(`Server is running on port : ${PORT}`)
})