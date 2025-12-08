import redisClient from "../configs/redis-config";
import logger from "./logger";

export const invalidateNotificationsCache = async () => {
  try {
    const keys = await redisClient.keys("notifications*");
    if (keys.length > 0) {
      await redisClient.del(...keys);
      logger.info(`🧹 Cache invalidated for ${keys.length} notification keys`);
    } else {
      logger.info(`⚠️ No notification cache keys found to invalidate`);
    }
  } catch (error: any) {
    logger.error(`❌ Failed to invalidate notification cache: ${error.message}`);
  }
};

export const invalidateDeviceTokensCache = async (userId: string) => {
  try {
    const cacheKey = `device_tokens_${userId}`;
    await redisClient.del(cacheKey);
    logger.info(`🧹 Cache invalidated for device tokens of user ${userId}`);
  } catch (error: any) {
    logger.error(`❌ Failed to invalidate device tokens cache for user ${userId}: ${error.message}`);
  }
};