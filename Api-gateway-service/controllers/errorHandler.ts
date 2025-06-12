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

export const errorHandler = (
  err: Error | APIError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const statusCode = err instanceof APIError ? err.statusCode : 500;
  const status = err instanceof APIError ? err.status : 'error';

  res.status(statusCode).json({
    status,
    message: err.message || 'Internal server error',
  });
};

export default APIError;