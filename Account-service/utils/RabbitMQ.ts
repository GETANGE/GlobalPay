import amqp from "amqplib"
import dotenv from "dotenv"
import logger from "./logger";

dotenv.config();

let connection = null;
let channel: any =null

const EXCHANGE_NAME: string ='global_pay_events'


let env = process.env.RABBITMQ_URL || "development" 

const rabbitMQ_url = 
    env === "production"
        ? process.env.RABBITMQ_URL_PROD
        : process.env.RABBITMQ_URL_DEV

export const connectToRabbitMQ = async()=>{
    try {
        connection = await amqp.connect( rabbitMQ_url as string);
        channel = await connection.createChannel();

        await channel.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });
        logger.info(`🐇 Connected to RabbitMQ..`);

        return channel;
    } catch (error) {
        logger.error(`Error connecting to RabbitMQ : ${error}`)
    }
}

export const publishEvent = async(routingKey: string, message: any) => {
    try {
        if(!channel){
            await connectToRabbitMQ()
        }

        channel.publish(EXCHANGE_NAME, routingKey, Buffer.from(JSON.stringify(message)));
        logger.info(`Event published: ${routingKey}`)
    } catch (error) {
        logger.error(`Error publishing an Event : ${error}`)
    }
}

export const consumeEvent = async (routingKey: string, callback: (msg: any) => Promise<void>) => {
  try {
    if (!channel) {
      await connectToRabbitMQ();
    }

    const queue = await channel.assertQueue("", { exclusive: true });
    await channel.bindQueue(queue.queue, EXCHANGE_NAME, routingKey);

    channel.consume(queue.queue, async (message: any) => {
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