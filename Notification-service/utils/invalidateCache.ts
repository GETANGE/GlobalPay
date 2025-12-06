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