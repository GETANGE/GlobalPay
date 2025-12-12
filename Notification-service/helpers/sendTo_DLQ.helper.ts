import { getRabbitMQChannel } from "../configs/rabbitMQ";
import logger from "../utils/logger";
import dotenv from "dotenv";

dotenv.config();

const DLQ_QUEUE = process.env.DLQ_QUEUE || "dead_letter_queue";

export const sendToDLQ = async (message: any, reason?: string) => {
  try {
    const channel = await getRabbitMQChannel();
    await channel.assertQueue(DLQ_QUEUE, { durable: true });

    let parsed = {};

    // Ensure the message is parsed safely
    if (typeof message === "string") {
      try {
        parsed = JSON.parse(message);
      } catch {
        parsed = { raw: message };
      }
    } else {
      parsed = message;
    }

    const payload = {
      ...parsed,
      failedAt: new Date().toISOString(),
      reason: reason || "Unknown",
    };

    channel.sendToQueue(DLQ_QUEUE, Buffer.from(JSON.stringify(payload)), {
      persistent: true,
    });

    logger.warn(`Message sent to Dead Letter Queue: ${JSON.stringify(payload)}`);
  } catch (error: any) {
    logger.error(`Failed to push message to DLQ: ${error.message}`);
  }
};

