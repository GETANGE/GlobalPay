import type{ Request, Response, NextFunction } from "express";
import APIError from "../utils/APIError";
import logger from "../utils/logger";
import { publish_kyc_job_banking, publish_kyc_job_id, publish_kyc_job_kra, publish_kyc_job_passport } from "../utils/RabbitMQ";

export const national_id = async (req: any, res: Response, next: NextFunction) => {
  try {
    const file = req.file;
    const user = req.user;

    if (!file) {
      return next(new APIError(`Please provide your national ID`, 400));
    }

    let data = { file, user };

    try {
      await publish_kyc_job_id(data);
    } catch (error) {
        logger.error("Failed to push to queue", error);
        console.log(error)
        return next(new APIError("Failed to push to queue", 500));
    }

    res.status(200).json({
        status: "success",
        message: "National ID received and queued for verification"
    });

  } catch (error) {
    logger.error(`Error processing National ID: ${error}`);
    return next(new APIError(`Internal server error`, 500));
  }
};

export const passport = async (req: any, res: Response, next: NextFunction) => {
  try {
    const file = req.file;
    const user = req.user;

    if (!file) {
      return next(new APIError(`Please provide your passport`, 400));
    }

    let data = { file, user };

    try {
      await publish_kyc_job_passport(data);
    } catch (error) {
        logger.error("Failed to push to queue", error);
        console.log(error)
        return next(new APIError("Failed to push to queue", 500));
    }

    res.status(200).json({
        status: "success",
        message: "Passport docs received and queued for verification"
    });

  } catch (error) {
    logger.error(`Error processing passport docs: ${error}`);
    return next(new APIError(`Internal server error`, 500));
  }
};

export const kra = async (req: any, res: Response, next: NextFunction) => {
  try {
    const file = req.file;
    const user = req.user;

    if (!file) {
      return next(new APIError(`Please provide your kra pin docs`, 400));
    }

    let data = { file, user };

    try {
      await publish_kyc_job_kra(data);
    } catch (error) {
        logger.error("Failed to push to queue", error);
        console.log(error)
        return next(new APIError("Failed to push to queue", 500));
    }

    res.status(200).json({
        status: "success",
        message: "KRA docs received and queued for verification"
    });

  } catch (error) {
    logger.error(`Error processing KRA docs: ${error}`);
    return next(new APIError(`Internal server error`, 500));
  }
};

export const banking = async (req: any, res: Response, next: NextFunction) => {
  try {
    const file = req.file;
    const user = req.user;

    if (!file) {
      return next(new APIError(`Please provide your proof of banking docs`, 400));
    }

    let data = { file, user };

    try {
      await publish_kyc_job_banking(data);
    } catch (error) {
        logger.error("Failed to push to queue", error);
        console.log(error)
        return next(new APIError("Failed to push to queue", 500));
    }

    res.status(200).json({
        status: "success",
        message: "Banking docs received and queued for verification"
    });

  } catch (error) {
    logger.error(`Error processing Banking docs: ${error}`);
    return next(new APIError(`Internal server error`, 500));
  }
};