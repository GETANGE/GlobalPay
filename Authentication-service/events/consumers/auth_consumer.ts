import { getRabbitMQChannel } from "../../configs/rabbitMQ-config";
import logger from "../../utils/logger";
import { sendToDLQ } from "../../helperFunctions/sendTo_DLQ.helper";

const EXCHANGE_NAME: string = "global_pay_events";

export const consumeEvent = async (routingKey: string, callback: any) => {
  try {
    const channel = await getRabbitMQChannel();

    await channel.assertExchange(EXCHANGE_NAME, "topic", { durable: true });

    const queue = await channel.assertQueue("", { exclusive: true });

    await channel.bindQueue(queue.queue, EXCHANGE_NAME, routingKey);

    channel.consume(queue.queue, async (message: any) => {
      if (!message) return;

      const raw_message = message.content.toString();

      try {
        const content = JSON.parse(raw_message);

        logger.info(`📩 Event received (${routingKey}) → ${JSON.stringify(content)}`);

        // Run business logic
        await callback(content);

        // ACK only if business logic succeeds
        channel.ack(message);

      } catch (err: any) {
        logger.error(
          `⚠️ Error while processing event (${routingKey}): ${err.message}`
        );

        // Send failed event to DLQ
        await sendToDLQ(raw_message, err.message);

        // Reject and do NOT requeue
        channel.nack(message, false, false);
      }
    });

    logger.info(`⛳ Subscribed to Event: ${routingKey}`);

  } catch (error: any) {
    logger.error(
      `❌ Error setting up consumer (${routingKey}): ${error.message}`
    );
  }
};
