import { getRabbitMQChannel } from "../../configs/rabbitMQ";
import logger from "../../utils/logger";

const DLQ_QUEUE = process.env.DLQ_QUEUE || "dead_letter_queue";

export const deadLetterQueue = async () => {
  try {
    const channel = await getRabbitMQChannel();

    // DO NOT bind to the main exchange
    await channel.assertQueue(DLQ_QUEUE, { durable: true });
    logger.info(`✅ DLQ '${DLQ_QUEUE}' ready`);

    channel.consume(DLQ_QUEUE, async (msg: any) => {
      if (!msg) return;

      const data = JSON.parse(msg.content.toString());
      logger.warn(`⚠️ Dead-lettered message: ${JSON.stringify(data)}`);

      channel.ack(msg);
    });

    logger.info(`🛡️ DLQ consumer running`);
  } catch (err: any) {
    logger.error(`❌ Failed to start DLQ consumer: ${err.message}`);
  }
};
