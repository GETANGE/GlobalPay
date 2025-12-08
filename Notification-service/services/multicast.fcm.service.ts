import admin from "firebase-admin";
import logger from "../utils/logger";
import { baseMessage } from "../types/express";
import { getFCM_Tokens } from "./fcm.service";

interface SendOptions {
  data?: Record<string, string>;
  notification?: { title?: string; body?: string };
  device_type?: "android" | "ios" | "web" | "all";
  priority?: "high" | "normal" | "low";
}

const chunk = <T,>(arr: T[], size = 500): T[][] => {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
};

export const sendMulticast = async (userId: string, options: SendOptions) => {
  const { data, notification, priority, device_type = "all" } = options;
  
  const tokenRows = await getFCM_Tokens(userId);
  
  let filteredTokens: string[]; // based on requested device_type.
  
  if (device_type === "all") {
    filteredTokens = tokenRows.map((t) => t.token);
  } else {
    filteredTokens = tokenRows
      .filter((t) => t.device_type === device_type)
      .map((t) => t.token);
  }
  
  if (filteredTokens.length === 0) {
    logger.warn(`No tokens match device_type=${device_type} for user ${userId}`);
    return;
  }
  
  let android = undefined;
  let apns = undefined;
  let webpush = undefined;
  
  if (device_type === "android" || device_type === "all") {
    android = { priority: priority || "high" };
  }

  if (device_type === "ios" || device_type === "all") {
    apns = { payload: { aps: { contentAvailable: true } } };
  }

  if (device_type === "web" || device_type === "all") {
    webpush = { headers: { Urgency: priority || "high" } };
  }
  
  const baseMessage: baseMessage = {
    data,
    notification,
    android,
    apns,
    webpush,
  };

  const batches = chunk(filteredTokens, 500);
  
  for (const batch of batches) {
    const response = await admin.messaging().sendEachForMulticast({
      tokens: batch,
      ...baseMessage,
    });
    
    logger.info(`Sent ${batch.length} notifications to ${device_type} devices`);
    
    response.responses.forEach((resp, index) => {
      if (resp.error) {
        logger.error(`Failed to send notification to token ${batch[index]}: ${resp.error}`);
      } else {
        logger.info(`Successfully sent notification to token ${batch[index]}`);
      }
    });
  }
};