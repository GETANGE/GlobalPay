import type { Request, Response, NextFunction } from 'express';
class APIError extends Error{
    statusCode: number;
    status: string;

    constructor(message: string , statusCode: number){
        super(message)

        this.statusCode =statusCode;
        this.status =`${statusCode}`.startsWith('4') ? 'fail' : 'error'
        this.name = 'APIError'

        Error.captureStackTrace?.(this, this.constructor);
    }
}

interface CustomError{
  statusCode: number;
  status: string;
  message: string
}

export const errorHandler = (
  err: CustomError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let status = err.status || 'Internal server error'
  let statusCode = err.statusCode || 500

  res.status(statusCode).json({
    status: status,
    message: err.message
  });
};

export const unhandledRoutes = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  return next( new APIError(`This route ${req.originalUrl} is not yet handled...`, 401))
}

export default APIError;