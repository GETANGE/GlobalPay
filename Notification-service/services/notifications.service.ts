import client from "../configs/db-config";
import APIError from "../utils/APIError";
import redisClient from "../configs/redis-config";
import { sendMulticast } from "./multicast.fcm.service";
import { emitNotification } from "../configs/socket";
import { invalidateNotificationsCache } from "../utils/invalidateCache";

export const getUserNotifications = async (userId: string) => {
  const cacheKey = `notifications:${userId}`;

  const cached = await redisClient.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  const directQuery = `
    SELECT id, title, message, type, user_id, created_at, status
    FROM notifications
    WHERE user_id = $1 AND status <> 'DELETED'
  `;

  const directRes = await client.query(directQuery, [userId]);
  const direct = directRes.rows;

  // Fetch multi-recipient notifications
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

  // Combine all
  const combined = [...direct, ...multi].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  await redisClient.set(cacheKey, JSON.stringify(combined), "EX", 90);

  return combined;
};

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

export const deleteNotification_service = async (notificationId: string, userId: string) => {
  const query = `
    UPDATE notifications
    SET status = 'DELETED'
    WHERE id = $1 AND user_id = $2
  `;

  const result = await client.query(query, [notificationId, userId]);

  if (result.rowCount === 0) {
    throw new APIError("Notification not found", 404);
  }
  
  // invalidate cache
  await invalidateNotificationsCache();
};

export const getSingleNotification = async (notificationId: string, userId: string) => {
  const query = `
    SELECT * FROM notifications
    WHERE id = $1 AND user_id = $2 AND status <> 'DELETED'
  `;

  const result = await client.query(query, [notificationId, userId]);

  if (result.rowCount === 0) {
    throw new APIError("Notification not found", 404);
  }
  
  // invalidate cache
  await invalidateNotificationsCache();
  
  return result.rows[0];
};

export const deleteAllNotifications_service = async (userId: string) => {
  const query = `
    UPDATE notifications
    SET status = 'DELETED'
    WHERE user_id = $1 AND status <> 'DELETED'
  `;

  const result = await client.query(query, [userId]);

  if (result.rowCount === 0) {
    throw new APIError("No notifications found", 404);
  }
  
  // invalidate cache
  await invalidateNotificationsCache();
};

export const sendNotification_service = async (
  title: string,
  body: string,
  data: Record<string, any>,
  device_type: "android" | "ios" | "web" | "all",
  userId: string
) => {

  // 1. Save notification in DB
  const query = `
    INSERT INTO notifications (title, body, data, device_type, user_id, status)
    VALUES ($1, $2, $3, $4, $5, 'SENT')
  `;

  const result = await client.query(query, [ title, body, data, device_type, userId ]);

  if (result.rowCount === 0) {
    throw new APIError("Notification not created", 500);
  }

  // 2. Send FCM Push Notification
  await sendMulticast(userId, {
    notification: { title, body },
    data,
    device_type,
    priority: "high",
  });

  // 3. Emit WebSocket Notification
  await emitNotification(userId, {
    title,
    body,
    data,
    device_type,
    createdAt: new Date().toISOString(),
  });

  // 4. Invalidate Cache
  await invalidateNotificationsCache();
};
