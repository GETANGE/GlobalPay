import client from "../configs/db-config";
import APIError from "../utils/APIError";
import redisClient from "../configs/redis-config";
import { invalidateNotificationsCache } from "../utils/invalidateCache";

export const getUserNotifications = async (userId: string, page: number = 1, limit: number = 20
) => {
  const offset = (page - 1) * limit;
  const cacheKey = `notifications:${userId}:page:${page}:limit:${limit}`;

  // 1. Try Redis cache
  const cached = await redisClient.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  // 2. Fetch direct notifications
  const directQuery = `
    SELECT id, title, message, type, user_id, created_at, status
    FROM notifications
    WHERE user_id = $1
  `;

  const directRes = await client.query(directQuery, [userId]);
  const direct = directRes.rows;

  // 3. Fetch multi-recipient notifications
  const multiQuery = `
    SELECT 
      nr.status AS recipient_status,
      n.*
    FROM notification_recipients nr
    JOIN notifications n
      ON nr.notification_id = n.id
    WHERE nr.user_id = $1
  `;

  const multiRes = await client.query(multiQuery, [userId]);
  const multi = multiRes.rows;

  // 4. Combine all
  const combined = [...direct, ...multi].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  // 5. Paginate
  const paginated = combined.slice(offset, offset + limit);

  // 6. Save to Redis cache (small TTL to avoid stale data)
  await redisClient.set(cacheKey, JSON.stringify(paginated), "EX", 90); // 90 sec TTL

  return paginated;
};


// MUST BE SENT TO A QUEUE FIRST.

export const markNotificationRead = async (notificationId: string, userId: string) => {
  const query = `
    UPDATE notifications
    SET status = '$3'
    WHERE id = $1 AND user_id = $2
  `;

  const result = await client.query(query, [notificationId, userId, "READ"]);

  if (result.rowCount === 0) {
    throw new APIError("Notification not found", 404);
  }
  
  // invalidate cache
  await invalidateNotificationsCache();
};

export const markAllNotificationsRead = async (userId: string) => {
  const query = `
    UPDATE notifications
    SET status = '$3'
    WHERE user_id = $1
  `;

  const result = await client.query(query, [userId, "READ"]);

  if (result.rowCount === 0) {
    throw new APIError("No notifications found", 404);
  }
  
  // invalidate cache
  await invalidateNotificationsCache();
};