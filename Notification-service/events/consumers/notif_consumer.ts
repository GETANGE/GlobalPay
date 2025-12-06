import { getRabbitMQChannel } from "../../configs/rabbitMQ";
import logger from "../../utils/logger";
import { markNotificationRead, markAllNotificationsRead } from "../../services/notifications.service";
import { sendToDLQ } from "../../helpers/sendTo_DLQ.helper";

const NOTIFICATION_QUEUE = "notification_queue";

export const processNotificationConsumer = async () => {
  logger.info("✅ Starting notification consumer");
  const channel = await getRabbitMQChannel();
  await channel.assertQueue(NOTIFICATION_QUEUE, { durable: true });

  channel.consume(NOTIFICATION_QUEUE, async (msg: any) => {
    if (!msg) return;

    const data = JSON.parse(msg.content.toString());

    try {
      const { notificationId, userId, status } = data;

      if (notificationId) {
        // single notification
        await markNotificationRead(notificationId, userId);
        logger.info(`✅ Notification ${notificationId} updated to status ${status}`);
        
      } else if (userId && status) {
        // bulk update for all notifications
        await markAllNotificationsRead(userId);
        logger.info(`✅ All notifications for user ${userId} updated to status ${status}`);
        
      } else {
        throw new Error("Invalid message payload for notification queue");
      }

      channel.ack(msg);
    } catch (err: any) {
      logger.error(`❌ Failed to process notification queue: ${err.message}`);

      // send to DLQ
      await sendToDLQ(data, err.message);

      channel.nack(msg, false, false); // don't requeue
    }
  });
};