import { getRabbitMQChannel } from "../../configs/rabbitMQ";
import { NotificationPayload } from "../../types/express";
import logger from "../../utils/logger";

const NOTIFICATION_QUEUE = 'notification_queue';


export const notificationQueue = async (data: NotificationPayload) => {
    try {
      const channel = await getRabbitMQChannel();
      
      channel.assertQueue(NOTIFICATION_QUEUE, { durable: true });
      
      channel.sendToQueue(NOTIFICATION_QUEUE, Buffer.from(JSON.stringify(data)), { persistent: true });
      
      logger.info(`📥 Notification added to queue successfully`);
    } catch (error) {
        logger.error(`Failed to send notification to queue: ${error}`);
    }
};