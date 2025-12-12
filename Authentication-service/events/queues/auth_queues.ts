import { getRabbitMQChannel } from "../../configs/rabbitMQ-config";
import logger from "../../utils/logger";
import { EmailData, SmsData } from "../../types/express";

const EMAIL_QUEUE = "email_queue";
const SMS_QUEUE = "sms_queue";

export const EmailJob_queue = async (data: EmailData) => {
  try {
    const channel = await getRabbitMQChannel();

    await channel.assertQueue(EMAIL_QUEUE, { durable: true });

    channel.sendToQueue(
      EMAIL_QUEUE,
      Buffer.from(JSON.stringify(data)),
      { persistent: true }
    );

    logger.info("Email job added to queue.");
  } catch (error) {
    logger.error("Error adding email job to queue", error);
  }
};

export const SMSJob_queue = async (data: SmsData) => {
  try {
    const channel = await getRabbitMQChannel();

    await channel.assertQueue(SMS_QUEUE, { durable: true });

    channel.sendToQueue(
      SMS_QUEUE,
      Buffer.from(JSON.stringify(data)),
      { persistent: true }
    );

    logger.info("SMS job added to queue.");
  } catch (error) {
    logger.error("Error adding SMS job to queue", error);
  }
};
