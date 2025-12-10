import { getRabbitMQChannel } from "../../configs/rabbitMQ";
import { NotificationPayload, DeviceTokenPayload } from "../../types/express";
import logger from "../../utils/logger";

const NOTIFICATION_QUEUE = 'notification_queue';
const DEVICE_TOKENS_QUEUE = 'device_tokens_queue';

export const DeviceTokensQueue = async (data: DeviceTokenPayload) => {
    try {
      const channel = await getRabbitMQChannel();
      
      channel.assertQueue(DEVICE_TOKENS_QUEUE, { durable: true });
      
      channel.sendToQueue(DEVICE_TOKENS_QUEUE, Buffer.from(JSON.stringify(data)), { persistent: true });
      
      logger.info(`📥 Device tokens added to queue successfully`);
    } catch (error) {
        logger.error(`Failed to send device tokens to queue: ${error}`);
    }
};

export const notificationQueue = async (data: NotificationPayload) => {
    try {
      const channel = await getRabbitMQChannel();
      
      channel.assertQueue(NOTIFICATION_QUEUE, { durable: true });
      
      channel.sendToQueue(NOTIFICATION_QUEUE, Buffer.from(JSON.stringify(data)), { persistent: true });
      
      logger.info(`📤 Published notification to queue: ${NOTIFICATION_QUEUE}`);
    } catch (error) {
        logger.error(`Failed to add notification message to queue: ${error}`);
    }
};