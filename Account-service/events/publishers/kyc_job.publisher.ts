import dotenv from "dotenv";
import logger from "../../utils/logger";
import { getRabbitMQChannel } from "../../configs/rabbitMQ-config";
dotenv.config();

const EXCHANGE_NAME = process.env.EXCHANGE_NAME || "global_pay_events";

export const publishEvent = async (routingKey: string, message: any) => {
  try {
    const channel = await getRabbitMQChannel();

    await channel.assertExchange(EXCHANGE_NAME, "topic", { durable: true });

    channel.publish(
      EXCHANGE_NAME,
      routingKey,
      Buffer.from(JSON.stringify(message))
    );

    logger.info(`📤 Event published → ${routingKey}`);
  } catch (error: any) {
    logger.error(`Error publishing event (${routingKey}): ${error.message}`);
  }
};