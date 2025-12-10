import { messaging } from "../configs/firebase-config";
import client from "../configs/db-config";
import logger from "../utils/logger";
import APIError from "../utils/APIError";
import { baseMessage } from "../types/express";
import { invalidateAllBroadcastCaches } from "../utils/invalidateCache";

interface SendOptions {
  data: Record<string, string>;
  notification: { title?: string; body?: string };
  device_type?: "android" | "ios" | "web" | "all";
}

export const sendBroadCast = async (
  broadcast_topic: string,
  priority: string,
  options: SendOptions
) => {
  const { data, notification, device_type = "all" } = options;

  logger.info(`📩 Broadcast to topic "${broadcast_topic}" started`);

  let android = undefined;
  let apns = undefined;
  let webpush = undefined;

  if (device_type === "android" || device_type === "all") {
    android = { priority };
  }

  if (device_type === "ios" || device_type === "all") {
    apns = { payload: { aps: { contentAvailable: true } } };
  }

  if (device_type === "web" || device_type === "all") {
    webpush = { headers: { Urgency: priority } };
  }

  const message: baseMessage = {
    data,
    notification,
    android,
    apns,
    webpush,
  };

  await messaging.send({ topic: broadcast_topic, ...message });

  logger.info(`📩 Broadcast to topic "${broadcast_topic}" completed successfully`);
};

export const createBroadcastTopic_service = async (
  topic: string,
  description: string
) => {
  const query = `
    INSERT INTO notification_broadcasts (topic, description)
    VALUES ($1, $2)
    ON CONFLICT (topic) DO NOTHING
    RETURNING *
  `;
  
  try {
    await client.query("BEGIN");
    
    const result = await client.query(query, [topic, description || null]);
    
    if (result.rowCount === 0) {
      throw new APIError("Failed to create notification broadcast", 500);
    }
    
    await client.query("COMMIT")
    
    await invalidateAllBroadcastCaches();
  } catch (error) {
    await client.query("ROLLBACK")
    throw error;
  }
};

export const getAllBroadcastTopics_service = async () => {
  const query = `
    SELECT topic, description
    FROM notification_broadcasts
  `;

  try {
    const result = await client.query(query);

    return result.rows;
  } catch (error) {
    throw error;
  }
};

export const updateBroadcastTopic_service = async (
  id: string,
  topic: string,
  description: string
) => {
  const query = `
    UPDATE notification_broadcasts
    SET topic = $2, description = $3
    WHERE id = $1
    RETURNING *
  `;

  try {
    await client.query("BEGIN");
    
    const result = await client.query(query, [id, topic, description || null]);
    
    if (result.rowCount === 0) {
      throw new APIError("Failed to update notification broadcast", 500);
    }
    
    await client.query("COMMIT")
    
    await invalidateAllBroadcastCaches();
  } catch (error) {
    await client.query("ROLLBACK")
    throw error;
  }
};

export const getBroadcastById_service = async (
  id: string
) => {
  const query = `
    SELECT id, topic, description
    FROM notification_broadcasts
    WHERE id = $1
  `;

  try {
    const result = await client.query(query, [id]);

    if (result.rowCount === 0) {
      throw new APIError("Broadcast not found", 404);
    }

    return result.rows[0];
  } catch (error) {
    throw error;
  }
};

export const deleteBroadcastById_service = async (
  id: string
) => {
  const query = `
    DELETE FROM notification_broadcasts
    WHERE id = $1
    RETURNING *
  `;

  try {
    await client.query("BEGIN");
    
    const result = await client.query(query, [id]);
    
    if (result.rowCount === 0) {
      throw new APIError("Failed to delete notification broadcast", 500);
    }
    
    await client.query("COMMIT");
    
    await invalidateAllBroadcastCaches();
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
};
