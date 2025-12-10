import { getRabbitMQChannel } from "../../configs/rabbitMQ";
import logger from "../../utils/logger";
import {
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification_service,
  deleteAllNotifications_service,
  sendNotification_service,
  sendNotification_broadcast_service
} from "../../services/notifications.service";
import { sendToDLQ } from "../../helpers/sendTo_DLQ.helper";
import {
  createBroadcastTopic_service,
  deleteBroadcastById_service,
  updateBroadcastTopic_service,
} from "../../services/broadcast.fcm.service";

const NOTIFICATION_QUEUE = "notification_queue";

export const processNotificationConsumer = async () => {
  logger.info("✅ Starting notification consumer");

  const channel = await getRabbitMQChannel();
  await channel.assertQueue(NOTIFICATION_QUEUE, { durable: true });

  channel.consume(NOTIFICATION_QUEUE, async (msg: any) => {
    if (!msg) return;

    const data = JSON.parse(msg.content.toString());

    try {
      const {
        action,
        notificationId,
        userId,
        status,
        title,
        priority,
        body,
        data: extraData,
        broadcast_topic,
        device_type,
        topic,
        description,
        broadcastId,
      } = data;

      switch (action) {
        case "read":
          await markNotificationRead(notificationId, userId);
          logger.info(
            `💫 Notification ${notificationId} updated to status ${status}`,
          );
          break;

        case "bulkRead":
          await markAllNotificationsRead(userId);
          logger.info(
            `💫 All notifications for user ${userId} updated to status ${status}`,
          );
          break;

        case "bulkDelete":
          await deleteAllNotifications_service(userId);
          logger.info(`💫 All notifications for user ${userId} deleted`);
          break;

        case "delete":
          await deleteNotification_service(notificationId, userId);
          logger.info(`💫 Notification ${notificationId} deleted`);
          break;

        case "notification":
          await sendNotification_service(
            title,
            body,
            extraData,
            device_type,
            priority,
            userId,
          );
          logger.info(`💫 Notification(FCM) sent to user ${userId}`);
          break;
          
        case "broadcast-notification":
          await sendNotification_broadcast_service(
            title,
            body,
            extraData,
            device_type,
            priority,
            broadcast_topic,
            userId,
          );
          logger.info(`💫 Notification(FCM) sent to broadcast`);
          break;

        case "broadcast":
          await createBroadcastTopic_service(topic, description);
          logger.info(`💫 Broadcast created successfully`);
          break;

        case "delete-broadcast":
          await deleteBroadcastById_service(broadcastId);
          logger.info(`💫 Broadcast ${broadcastId} deleted`);
          break;

        case "update-broadcast":
          await updateBroadcastTopic_service(broadcastId, topic, description);
          logger.info(`💫 Broadcast ${broadcastId} updated`);
          break;

        default:
          throw new Error(`Invalid action ${action} for notification queue`);
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