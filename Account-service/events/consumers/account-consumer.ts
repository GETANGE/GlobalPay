import logger from "../../utils/logger";
import { getRabbitMQChannel } from "../../configs/rabbitMQ-config";
import dotenv from "dotenv";

dotenv.config();

const EXCHANGE_NAME = process.env.EXCHANGE_NAME || "global_pay_events";

export const consumeEvent = async (
  routingKey: string,
  callback: (msg: any) => Promise<void>
) => {
  try {
    const channel = await getRabbitMQChannel();

    await channel.assertExchange(EXCHANGE_NAME, "topic", { durable: true });

    const queue = await channel.assertQueue("", { exclusive: true });
    await channel.bindQueue(queue.queue, EXCHANGE_NAME, routingKey);

    channel.consume(queue.queue, async (message) => {
      if (!message) return;

      try {
        const content = JSON.parse(message.content.toString());
        logger.info(`📩 Event received (${routingKey}) → ${JSON.stringify(content)}`);

        await callback(content);

        channel.ack(message);
      } catch (err: any) {
        logger.error(`Error handling event message: ${err.message}`);
      }
    });

    logger.info(`⛳ Subscribed → ${routingKey}`);
  } catch (error: any) {
    logger.error(`Error consuming event (${routingKey}): ${error.message}`);
  }
};