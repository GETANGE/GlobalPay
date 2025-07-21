import { type Response, type NextFunction, type Request} from "express"
import dotenv from "dotenv";
import APIError from "../utils/APIError";
import logger from "../utils/logger";

dotenv.config();

type castingError={
    code: string,
    message: string
}
//casting errors
const handlingCastingErrorDB = function( err: castingError){
    if(err.code === '22P02'){
        const message = `Invalid input syntax: ${err.message}`
        return new APIError(message, 400)
    }
}

type duplicateError = {
    code: string,
    detail: string
}
// duplicate fields in postres
const duplicateFieldDB = function( err: duplicateError){
    if(err.code === '23505'){
        const detail = err.detail || '';
        const match = detail.match(/\(([^)]+)\)=\(([^)]+)\)/)

        if(match){
            const field = match[1]
            const value = match[2]
            const message = `${field} "${value}" already exists. Please use another ${field} 🍁`;

            return new APIError(message, 400)
        }

        return new APIError('Duplicate value found. Please use a different one! 🍁', 400);
    }
}

interface Errors{
    isOperational?: boolean,
    statusCode: number,
    status: string,
    message: string,
    stack?: any,
}

const errorProd = function( err: Errors , res:Response){
    if(err.isOperational){
        res.status(err.statusCode).json({
            status: err.status,
            message: err.message,
        })
    }else{
        logger.error(`Error ${err}`)
        res.status(500).json({
            status: 'error',
            message: 'Something went wrong 😢'
        })
    }
}

const errorDev = function(err: Errors, res:Response){
    // send a detailed JSON response including error details, stack trace
    res.status(err.statusCode).json({
        status: err.status,
        error: err,
        message: err.message
    })
}

interface CustomError {
    statusCode: number;
    status: string;
    message: string;
    isOperational?: boolean;
    code?: string;
    name?: string;
  }
  
export const Errorhandlers = function (err: CustomError, req: Request, res: Response, next: NextFunction) {
      err.statusCode = err.statusCode || 500;
      err.status = err.status || "error";
  
      if (process.env.NODE_ENV === 'development') {
          return errorDev(err, res);
      } 
      
      if (process.env.NODE_ENV === 'production') {
          let error: any = { ...err, message: err.message };
  
          if (error.code === '22P02') error = handlingCastingErrorDB(error);
          if (error.code === '23505') error = duplicateFieldDB(error);
  
          return errorProd(error, res);
      }
  
      // Fallback for unknown environments
      res.status(err.statusCode).json({
          status: err.status,
          message: err.message
      });
  };