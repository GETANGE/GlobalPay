import { getRabbitMQChannel } from "../configs/rabbitMQ";
import logger from "../utils/logger";


const NOTIFICATION_QUEUE = "notification_queue";

export const sendNotificationEvent = async (payload: {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  device_type?: "android" | "ios" | "web" | "all";
}) => {
  try {
    const channel = await getRabbitMQChannel();

    const message = {
      action: "notification",
      userId: payload.userId,
      title: payload.title,
      body: payload.body,
      data: payload.data || {},
      device_type: payload.device_type || "all",
    };

    channel.sendToQueue(
      NOTIFICATION_QUEUE,
      Buffer.from(JSON.stringify(message)),
      { persistent: true }
    );

    logger.info(`📨 Notification event published for user ${payload.userId}`);
  } catch (err: any) {
    logger.error(`❌ Failed to publish notification event: ${err.message}`);
  }
};
