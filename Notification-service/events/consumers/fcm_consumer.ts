import { getRabbitMQChannel } from "../../configs/rabbitMQ";
import logger from "../../utils/logger";
import { sendToDLQ } from "../../helpers/sendTo_DLQ.helper";
import { invalidateDeviceTokensCache } from "../../utils/invalidateCache";
import { createFCM_Token, deleteFCM_Token, updateFCM_Token} from "../../services/fcm.service";

const DEVICE_TOKENS_QUEUE = 'device_tokens_queue';

export const processDeviceTokens = async () => {
  logger.info(`🚀 Starting device tokens consumer`);
  
  const channel = await getRabbitMQChannel();
  await channel.assertQueue(DEVICE_TOKENS_QUEUE, { durable: true });

  channel.consume(DEVICE_TOKENS_QUEUE, async (msg) => {
    if (!msg) return;

    const data = JSON.parse(msg.content.toString());
    const { action, userId, token, device_type } = data;

    try {
      switch (action) {
        case "save":
          await createFCM_Token(userId, token, device_type);
          logger.info(`💫 Saved device token for user ${userId}`);
          break;

        case "delete":
          await deleteFCM_Token(userId, token);
          logger.info(`💫 Deleted device token for user ${userId}`);
          break;

        case "update":
          await updateFCM_Token(userId, token, device_type);
          logger.info(`💫 Updated device token for user ${userId}`);
          break;

        default:
          logger.warn(`⚠️ Unknown action "${action}"`);
          break;
      }

      // Invalidate Redis cache
      await invalidateDeviceTokensCache(userId);

      channel.ack(msg);
    } catch (error: any) {
      logger.error("❌ Error processing device token:", error);
      // await sendToDLQ(data, error.message);
      channel.nack(msg, false, false);
    }
  });
};