import amqp from "amqplib"
import dotenv from "dotenv"
import logger from "./logger";
import { QUEUES } from "./queue";

dotenv.config();

let connection: any;
let channel: any;

const EXCHANGE_NAME: string ='global_pay_events'
const RECONNECT_INTERVAL = 5000;

const rabbitMQ_url =
    process.env.NODE_ENV === "production"
        ? process.env.RABBITMQ_URL_PROD
        : process.env.RABBITMQ_URL_DEV;


export const connectToRabbitMQ = async()=>{
    try {
        connection = await amqp.connect(rabbitMQ_url as string);

        connection.on("error", (err:any) => {
            logger.error("RabbitMQ connection error:", err);
        });

        connection.on("close", () => {
            logger.warn("RabbitMQ connection closed. Reconnecting...");

            setTimeout(connectToRabbitMQ, RECONNECT_INTERVAL);
        });

        channel = await connection.createChannel();
        logger.info(`Connected to rabbitMQ: ${rabbitMQ_url}`)

        return channel;
    } catch (error) {
        logger.error(`Error connecting to RabbitMQ : ${error}`)
    }
}

const kyc_job = async (data: any, queue: string) => {
    try {
        if (!channel) {
            channel = await connectToRabbitMQ();
        }

        await channel.assertQueue(queue, { durable: true });

        // convert payload to buffer once
        const messageBuffer = Buffer.from(JSON.stringify(data));

        channel.sendToQueue(queue, messageBuffer, {
            persistent: true
        });

        logger.info(`KYC job added to queue: ${queue}`);
    } catch (error:any) {
        logger.error(`Error adding KYC job to queue: ${queue} - ${error.message}`);
    }
};

export const publish_kyc_job_id = (data: any) => kyc_job(data, QUEUES.identity);
export const publish_kyc_job_passport = (data: any) => kyc_job(data, QUEUES.passport);
export const publish_kyc_job_banking = (data: any) => kyc_job(data, QUEUES.banking);
export const publish_kyc_job_kra = (data: any) => kyc_job(data, QUEUES.kra);

export const publishEvent = async (routingKey: string, message: any) => {
  try {
    if (!channel) {
      await connectToRabbitMQ();
    }

    await channel.assertExchange(EXCHANGE_NAME, "topic", {
      durable: true,
    });

    channel.publish(EXCHANGE_NAME, routingKey, Buffer.from(JSON.stringify(message)));

    logger.info(`📤 Event published: ${routingKey}`);
  } catch (error) {
    logger.error(`Error publishing an Event: ${error}`);
  }
};

export const consumeEvent = async (routingKey: string, callback: (msg: any) => Promise<void>) => {
  try {
    if (!channel) {
      await connectToRabbitMQ();
    }

    await channel.assertExchange(EXCHANGE_NAME, "topic", { durable: true });
    
    const queue = await channel.assertQueue("", { exclusive: true });
    await channel.bindQueue(queue.queue, EXCHANGE_NAME, routingKey);

    channel.consume(queue.queue, async (message: { content: { toString: () => string; }; } | null) => {
      if (message !== null) {
        try {
          const content = JSON.parse(message.content.toString());
          logger.info(`📩 Received message for event ${routingKey}: ${JSON.stringify(content)}`);
          await callback(content);
          channel.ack(message);
        } catch (err) {
          logger.error(`Error handling message: ${err}`);
        }
      }
    });

    logger.info(`⛳ Subscribed to Event :${routingKey}`);
  } catch (error) {
    logger.error(`Error consuming an event: ${routingKey}`, error);
  }
};

export default channel;