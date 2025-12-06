import { getRabbitMQChannel } from "../../configs/rabbitMQ-config";
import logger from "../../utils/logger";

const EXCHANGE_NAME = process.env.EXCHANGE_NAME || "global_pay_events";
const DLQ_QUEUE = process.env.DLQ_QUEUE || "dead_letter_queue";

export const deadLetterQueue = async () => {
  try {
    const channel = await getRabbitMQChannel();

    await channel.assertQueue(DLQ_QUEUE, { durable: true });
    logger.info(`✅ Dead Letter Queue '${DLQ_QUEUE}' is ready`);

    // bind DLQ to exchange
    await channel.assertExchange(EXCHANGE_NAME, "topic", { durable: true });
    await channel.bindQueue(DLQ_QUEUE, EXCHANGE_NAME, "#"); // '#' means all routing keys
    logger.info(`🔗 DLQ bound to exchange '${EXCHANGE_NAME}'`);

    // Set up a consumer for the DLQ
    channel.consume(DLQ_QUEUE, async (msg: any) => {
      if (!msg) return;

      const data = JSON.parse(msg.content.toString());
      logger.warn(`⚠️ Message in Dead Letter Queue: ${JSON.stringify(data)}`);

      // TODO: persist this in a database or alert the team via slack.

      channel.ack(msg); // acknowledge so it’s removed from DLQ
    });

    logger.info(`🛡️ Dead Letter Queue consumer is running`);
  } catch (error: any) {
    logger.error(`❌ Failed to set up Dead Letter Queue: ${error.message}`);
  }
};
