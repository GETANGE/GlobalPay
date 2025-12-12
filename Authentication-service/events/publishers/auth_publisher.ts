import { getRabbitMQChannel } from "../../configs/rabbitMQ-config";
import logger from "../../utils/logger";

const EXCHANGE_NAME: string = "global_pay_events";

// publish a message to the exchange
export const publishEvent = async (routingKey: string, message: any) => {
  try {
    const channel = await getRabbitMQChannel();

    await channel.assertExchange(EXCHANGE_NAME, "topic", { durable: true });

    channel.publish(
      EXCHANGE_NAME,
      routingKey,
      Buffer.from(JSON.stringify(message)),
    );
    logger.info(`Event published: ${routingKey}`);
  } catch (error) {
    logger.error(`Error publishing an Event : ${error}`);
  }
};
