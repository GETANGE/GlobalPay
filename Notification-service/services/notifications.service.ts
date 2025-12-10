import client from "../configs/db-config";
import APIError from "../utils/APIError";
import redisClient from "../configs/redis-config";
import { sendMulticast } from "./multicast.fcm.service";
import { sendBroadCast } from "./broadcast.fcm.service";
import { emitNotification } from "../configs/socket";
import { invalidateNotificationsCache } from "../utils/invalidateCache";

export const getUserNotifications = async (
  userId: string,
  page: number ,
  limit: number
) => {
  const offset = (page - 1) * limit;

  const cacheKey = `notifications:${userId}:p${page}:l${limit}`;

  const cached = await redisClient.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  // 1. Count all notifications for accurate pagination metadata
  const countQuery = `
    SELECT 
      (SELECT COUNT(*) 
       FROM notifications 
       WHERE user_id = $1 AND status <> 'DELETED') AS direct_count,

      (SELECT COUNT(*)
       FROM notification_recipients nr
       WHERE nr.user_id = $1) AS multi_count
  `;
  const countRes = await client.query(countQuery, [userId]);

  const total =
    Number(countRes.rows[0].direct_count) +
    Number(countRes.rows[0].multi_count);

  // 2. Fetch paginated direct notifications
  const directQuery = `
    SELECT id, title, message, type, user_id, created_at, status
    FROM notifications
    WHERE user_id = $1 AND status <> 'DELETED'
    ORDER BY created_at DESC
    LIMIT $2 OFFSET $3
  `;

  const directRes = await client.query(directQuery, [
    userId,
    limit,
    offset,
  ]);

  // 3. Fetch paginated multi-user notifications
  const multiQuery = `
    SELECT 
      nr.status AS recipient_status,
      n.*
    FROM notification_recipients nr
    JOIN notifications n
      ON nr.notification_id = n.id
    WHERE nr.user_id = $1
    ORDER BY n.created_at DESC
    LIMIT $2 OFFSET $3
  `;

  const multiRes = await client.query(multiQuery, [
    userId,
    limit,
    offset,
  ]);

  const combined = [...directRes.rows, ...multiRes.rows].sort(
    (a, b) =>
      new Date(b.created_at).getTime() -
      new Date(a.created_at).getTime()
  );

  const totalPages = Math.ceil(total / limit);

  const response = {
    page,
    limit,
    total,
    totalPages,
    notifications: combined,
  };

  await redisClient.set(cacheKey, JSON.stringify(response), "EX", 90);

  return response;
};


export const markNotificationRead = async (notificationId: string, userId: string) => {
  const query = `
    UPDATE notifications
    SET status = '$3'
    WHERE id = $1 AND user_id = $2
  `;

  try{
    await client.query("BEGIN");
    
    const result = await client.query(query, [notificationId, userId, "READ"]);
    
    if (result.rowCount === 0) {
      throw new APIError("Notification not found", 404);
    }
    
    // invalidate cache
    await invalidateNotificationsCache();
    
    await client.query("COMMIT");
  }catch(error){
    await client.query("ROLLBACK");
    throw error;
  }
};

export const markAllNotificationsRead = async (userId: string) => {
  const query = `
    UPDATE notifications
    SET status = '$3'
    WHERE user_id = $1
  `;
  
  try{
    await client.query("BEGIN");
    
    const result = await client.query(query, [userId, "READ"]);
    
    if (result.rowCount === 0) {
      throw new APIError("No notifications found", 404);
    }
    
    // invalidate cache
    await invalidateNotificationsCache();
    
    await client.query("COMMIT");
  }catch(error){
    await client.query("ROLLBACK");
    throw error;
  }
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
  
  try{
    await client.query("BEGIN");
    
    const result = await client.query(query, [userId]);
    
    if (result.rowCount === 0) {
      throw new APIError("No notifications found", 404);
    }
    
    // invalidate cache
    await invalidateNotificationsCache();
    
    await client.query("COMMIT");
  }catch(error){
    await client.query("ROLLBACK");
    throw error;
  }
};

export const sendNotification_service = async (
  title: string,
  body: string,
  data: Record<string, any>,
  device_type: "android" | "ios" | "web" | "all",
  priority: "high" | "normal" | "low",
  userId: string
) => {
  try {
    await client.query("BEGIN");

    const query = `
      INSERT INTO notifications (title, body, data, device_type, user_id, status)
      VALUES ($1, $2, $3, $4, $5, 'SENT')
      RETURNING *
    `;
    const result = await client.query(query, [title, body, data, device_type, userId]);

    if (result.rowCount === 0) {
      throw new APIError("Notification not created", 500);
    }

    const notification = result.rows[0];

    // Send FCM Push Notification
    await sendMulticast(userId, priority, {
      notification: { title, body },
      data,
      device_type,
    });

    // Emit WebSocket Notification
    await emitNotification(userId, {
      title,
      body,
      data,
      device_type,
      createdAt: new Date().toISOString(),
    });

    await client.query("COMMIT");

    await invalidateNotificationsCache();

    return notification;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
};

export const sendNotification_broadcast_service = async (
  title: string,
  body: string,
  data: Record<string, any>,
  device_type: "android" | "ios" | "web" | "all",
  priority: "high" | "normal" | "low",
  broadcast_topic: string,
  userId: string
) => {
  try {
    await client.query("BEGIN");

    const query = `
      INSERT INTO notifications (title, body, data, device_type, status)
      VALUES ($1, $2, $3, $4, 'SENT')
      RETURNING *
    `;
    const result = await client.query(query, [title, body, data, device_type]);

    if (result.rowCount === 0) {
      throw new APIError("Notification not created", 500);
    }

    const notification = result.rows[0];

    // Send FCM Push Notification to broadcast topic
    await sendBroadCast(broadcast_topic, priority, {
      notification: { title, body },
      data,
      device_type,
    });

    // Emit WebSocket Notification
    await emitNotification(userId, {
      title,
      body,
      data,
      device_type,
      createdAt: new Date().toISOString(),
    });

    await client.query("COMMIT");

    await invalidateNotificationsCache();

    return notification;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
};
