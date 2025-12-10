import { type Request, type Response, type NextFunction, text } from "express";
import APIError from "../utils/APIError";
import logger from "../utils/logger";
import {
  publish_kyc_job_banking,
  publish_kyc_job_id,
  publish_kyc_job_kra,
  publish_kyc_job_passport,
} from "../events/queues/kyc_queues";
import client from "../configs/db-config";
import { calculateKycTier } from "../helpers/updateKYC";
import { publishNotification } from "../events/queues/kyc_queues";

export const national_id = async (
  req: any,
  res: Response,
  next: NextFunction,
) => {
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
      console.log(error);
      return next(new APIError("Failed to push to queue", 500));
    }

    res.status(200).json({
      status: "success",
      message: "National ID received and queued for verification",
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
      console.log(error);
      return next(new APIError("Failed to push to queue", 500));
    }

    res.status(200).json({
      status: "success",
      message: "Passport docs received and queued for verification",
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
      console.log(error);
      return next(new APIError("Failed to push to queue", 500));
    }

    res.status(200).json({
      status: "success",
      message: "KRA docs received and queued for verification",
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
      return next(
        new APIError(`Please provide your proof of banking docs`, 400),
      );
    }

    let data = { file, user };

    try {
      await publish_kyc_job_banking(data);
    } catch (error) {
      logger.error("Failed to push to queue", error);
      console.log(error);
      return next(new APIError("Failed to push to queue", 500));
    }

    res.status(200).json({
      status: "success",
      message: "Banking docs received and queued for verification",
    });
  } catch (error) {
    logger.error(`Error processing Banking docs: ${error}`);
    return next(new APIError(`Internal server error`, 500));
  }
};

export const kyc_approval_admin = async (
  req: any,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { docs_id } = req.params;
    const user = req.user;

    // Fetch KYC document
    const query = {
      text: `SELECT * FROM kyc_documents WHERE id = $1`,
      values: [docs_id],
    };
    const result = await client.query(query);

    if (result.rows.length === 0) {
      return next(new APIError(`This KYC document does not exist`, 404));
    }

    const doc = result.rows[0];
    const newTier = calculateKycTier(doc);

    // Update KYC document
    const updateQuery = {
      text: `
        UPDATE kyc_documents
        SET kyc_status = $1, kyc_tier = $2, verified_at = NOW()
        WHERE id = $3
        RETURNING *;
      `,
      values: ["verified", newTier, docs_id],
    };
    const updated = await client.query(updateQuery);

    logger.info(`KYC document ${docs_id} approved with tier ${newTier} by admin ${user.id}`);

    // --- Publish notification to the user ---
    await publishNotification({
      action: "notification",
      title: "KYC Approved",
      body: `Your KYC document has been approved. Your verification tier is ${newTier}.`,
      extraData: { docs_id, kyc_tier: newTier },
      device_type: "all",
      priority: "high",
      userId: doc.user_id,
    });

    res.status(200).json({
      status: "success",
      message: `KYC document approved successfully`,
      document: updated.rows[0],
    });
  } catch (error: any) {
    logger.error(`Error updating KYC status: ${error.message}`);
    return next(new APIError(`Internal server error`, 500));
  }
};

export const kyc_rejection_admin = async (
  req: any,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { docs_id } = req.params;
    const user = req.user;

    const query = {
      text: `SELECT * FROM kyc_documents WHERE id = $1`,
      values: [docs_id],
    };
    const result = await client.query(query);

    if (result.rows.length === 0) {
      return next(new APIError(`This KYC document does not exist`, 404));
    }

    // Update KYC document
    const updateQuery = {
      text: `
        UPDATE kyc_documents
        SET kyc_status = $1, kyc_tier = $2, verified_at = NULL
        WHERE id = $3
        RETURNING *;
      `,
      values: ["failed", 0, docs_id],
    };
    const updated = await client.query(updateQuery);

    logger.warn(`KYC document ${docs_id} rejected by admin ${user.id}`);

    await publishNotification({
      action: "notification",
      title: "KYC Rejected",
      body: "Your KYC document has been rejected. Please review and resubmit the required documents.",
      extraData: { docs_id },
      device_type: "all",
      priority: "high",
      userId: updated.rows[0].user_id,
    });

    res.status(200).json({
      status: "success",
      message: "KYC document rejected successfully",
      document: updated.rows[0],
    });
  } catch (error: any) {
    logger.error(`Error rejecting KYC: ${error.message}`);
    return next(new APIError(`Failed to reject KYC`, 500));
  }
};

