import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
import logger from "../utils/logger";
import type { Channel } from "amqplib";
import { connectToRabbitMQ } from "../utils/RabbitMQ";
import client from "../configs/db-config";
import { QUEUES } from "../utils/queue";

dotenv.config();

let channel: Channel;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME as string,
  api_key: process.env.CLOUDINARY_API_KEY as string,
  api_secret: process.env.CLOUDINARY_API_SECRET as string,
});

const uploadFile = async (file: any, folder: string) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: "auto",
        folder: folder,
      },
      (error, result) => {
        if (error) {
          logger.error(`Error while uploading ID to cloudinary`, error);
          reject(error);
        } else {
          resolve(result);
        }
      }
    );

    uploadStream.end(file.buffer);
  });
};

const database_handling = async (
  queue: string,
  column_name: string,
  folder_name: string
) => {
  channel = await connectToRabbitMQ();

  await channel.assertQueue(queue, { durable: true });

  channel.consume(queue, async (message: any) => {
    if (!message) return;

    try {
      const job_data = JSON.parse(message.content.toString());
      const { user, file } = job_data;

      // Rebuild buffer if serialized
      if (file?.buffer?.type === "Buffer" && Array.isArray(file.buffer.data)) {
        file.buffer = Buffer.from(file.buffer.data);
      }

      const result: any = await uploadFile(file, folder_name);

      const existing = await client.query({
        text: `SELECT id FROM kyc_documents WHERE user_id = $1`,
        values: [user.id],
      });

      if (existing.rows.length > 0) {
        await client.query({
          text: `UPDATE kyc_documents SET ${column_name} = $1 WHERE user_id = $2`,
          values: [result.secure_url, user.id],
        });
      } else {
        await client.query({
          text: `INSERT INTO kyc_documents (user_id, ${column_name}) VALUES ($1, $2)`,
          values: [user.id, result.secure_url],
        });
      }

      logger.info(`${column_name} uploaded awaiting verification`);
      channel.ack(message);
    } catch (error: any) {
      logger.error(`Failed to process KYC job: ${error.message}`);
      channel.nack(message, false, false);
    }
  });
};

Promise.allSettled([
  database_handling(QUEUES.identity, "national_id_url", "identity_cards"),
  database_handling(QUEUES.passport, "passport_photo_url", "kyc_docs_passport"),
  database_handling(QUEUES.banking, "bank_proof_url", "kyc_docs_banking"),
  database_handling(QUEUES.kra, "kra_pin_url", "kyc_docs_kra"),
]).then((results) => {
  results.forEach((result, idx) => {
    if (result.status === "rejected") {
      logger.error(`Consumer ${idx + 1} failed: ${result.reason.message}`);
    } else {
      logger.info(`Consumer ${idx + 1} started successfully`);
    }
  });
});
