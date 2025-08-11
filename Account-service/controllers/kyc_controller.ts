

// kra_pin
// national_id
// bank_proof
// passport_photo
//

import type{ Request, Response, NextFunction } from "express";
import sharp from "sharp";
import APIError from "../utils/APIError";
import logger from "../utils/logger";
import { publish_kyc_job } from "../utils/RabbitMQ";

export const national_id = async (req: any, res: Response, next: NextFunction) => {
  try {
    const file = req.file;
    const user = req.user;

    if (!file) {
      return next(new APIError(`Please provide your national ID`, 400));
    }

    // Process image in memory
    const processedImage = await sharp(file.buffer)
      .resize({
        width: 1200,
        height: 800,
        fit: "inside",
        withoutEnlargement: true
      })
      .rotate()
      .toFormat("jpeg", { quality: 80 })
      .toBuffer();

    // Prepare data for the queue
    const kycData = {
      userId: user.id,
      documentType: "NATIONAL_ID",
      fileBuffer: processedImage,
      mimeType: "image/jpeg"
    };

    // Push job to queue for verification + cloudinary upload
    await publish_kyc_job(kycData);

    res.status(200).json({
        status: "success",
        message: "National ID received and queued for verification"
    });

  } catch (error) {
    logger.error(`Error processing National ID: ${error}`);
    return next(new APIError(`Internal server error`, 500));
  }
};

