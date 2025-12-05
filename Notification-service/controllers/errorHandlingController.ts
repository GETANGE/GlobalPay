import type { NextFunction, Request, Response } from "express";
import APIError from "../utils/APIError";
import logger from "../utils/logger";
import dotenv from "dotenv"

dotenv.config();

//handling casting error(converting one data type into another)
const handleCastErrorDB = function (err: { code: string; message: string; }) {
  if (err.code === '22P02') {
    const message = `Invalid input syntax: ${err.message || 'Unable to cast value to expected type.'}`;
    return new APIError(message, 400);
  }
};

// duplicate fields in Postgres
const duplicateFieldDB = function (err: { code: string; detail: string; }) {
  if (err.code === '23505') {
    const detail = err.detail || '';
    const match = detail.match(/\(([^)]+)\)=\(([^)]+)\)/); // extracts field and value

    if (match) {
      const field = match[1];
      const value = match[2];
      const message = `${field} "${value}" already exists. Please use another ${field}! 🍁`;

      return new APIError(message, 400);
    }

    return new APIError('Duplicate value found. Please use a different one! 🍁', 400);
  }
};


const errorProd = function(err: { isOperational: boolean; statusCode: number; status: string; message: string; stack?: any}, res:Response){
    if(err.isOperational){
        res.status(err.statusCode).json({
            status: err.status,
            message: err.message,
            stack: err.stack
        })
    }else{
        logger.error(`💣 Error ${err}`)
        res.status(500).json({
            status: 'error',
            message: 'Something went wrong 😢'
        })
    }
}

const errorDev = function(err: { statusCode: number; status: string; message: string; stack?: any; }, res:Response){
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
  
          if (error.code === '22P02') error = handleCastErrorDB(error);
          if (error.code === '23505') error = duplicateFieldDB(error);
  
          return errorProd(error, res);
      }
  
      // Fallback for unknown environments
      res.status(err.statusCode).json({
          status: err.status,
          message: err.message
      });
  };