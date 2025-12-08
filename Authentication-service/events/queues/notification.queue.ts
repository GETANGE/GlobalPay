import { getRabbitMQChannel } from "../../configs/rabbitMQ-config";

const NOTIFICATION_QUEUE = 'notification_queue';

export const publishNotificationEvent = async (payload: any) => {
  try {
    const channel = await getRabbitMQChannel();
    await channel.assertQueue(NOTIFICATION_QUEUE, { durable: true });

    channel.sendToQueue(
      NOTIFICATION_QUEUE,
      Buffer.from(JSON.stringify(payload)), { persistent: true }
    );
  } catch (error) {
    console.error('Error publishing notification event:', error);
  }
};