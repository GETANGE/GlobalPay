import { connect } from "amqplib";
import type { Connection, Channel } from "amqplib";
import dotenv from "dotenv";
import logger from "../utils/logger"

dotenv.config();

let connection: Connection | any = null;
let channel: Channel | any = null;

const RECONNECT_INTERVAL = 5000;

const rabbitMQ_url =
  process.env.NODE_ENV === "production"
    ? process.env.RABBITMQ_URL_PROD
    : process.env.RABBITMQ_URL_DEV;

let hasLoggedConnection = false;

export const getRabbitMQChannel = async (): Promise<Channel> => {
  if (channel) return channel;

  if (!connection) {
    await connectToRabbitMQ();
  }

  if (!connection) {
    throw new Error("RabbitMQ connection not available.");
  }

  channel = await connection.createChannel();
  
  return channel;
};

const connectToRabbitMQ = async () => {
  try {
    connection = await connect(rabbitMQ_url as string);

    if (!hasLoggedConnection) {
      logger.info("🐇 RabbitMQ connected successfully...");
      hasLoggedConnection = true;
    }

    connection.on("error", (err: any) => {
      logger.error("RabbitMQ connection error:", err);
    });

    connection.on("close", () => {
      logger.warn("RabbitMQ connection closed. Reconnecting...");
      connection = null;
      channel = null;
      hasLoggedConnection = false;

      setTimeout(connectToRabbitMQ, RECONNECT_INTERVAL);
    });
  } catch (err) {
    logger.error(`RabbitMQ connection error: ${err}`);
    setTimeout(connectToRabbitMQ, RECONNECT_INTERVAL);
  }
};
