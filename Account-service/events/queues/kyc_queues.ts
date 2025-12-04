import logger from "../../utils/logger";
import { getRabbitMQChannel } from "../../configs/rabbitMQ-config";
import { QUEUES } from "../../utils/queue";

export const kyc_job = async (data: any, queue: string) => {
  try {
    const channel = await getRabbitMQChannel();

    await channel.assertQueue(queue, { durable: true });

    const messageBuffer = Buffer.from(JSON.stringify(data));

    channel.sendToQueue(queue, messageBuffer, {
      persistent: true,
    });

    logger.info(`KYC job added to queue: ${queue}`);
  } catch (error: any) {
    logger.error(`Error adding KYC job to queue: ${queue} - ${error.message}`);
  }
};

export const publish_kyc_job_id = (data: any) => kyc_job(data, QUEUES.identity);
export const publish_kyc_job_passport = (data: any) => kyc_job(data, QUEUES.passport);
export const publish_kyc_job_banking = (data: any) => kyc_job(data, QUEUES.banking);
export const publish_kyc_job_kra = (data: any) => kyc_job(data, QUEUES.kra);