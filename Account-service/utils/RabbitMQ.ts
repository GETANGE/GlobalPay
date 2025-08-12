import amqp from "amqplib"
import dotenv from "dotenv"
import logger from "./logger";
import { QUEUES } from "./queue";

dotenv.config();

let connection = null;
let channel: any =null

const EXCHANGE_NAME: string ='global_pay_events'


let env = process.env.RABBITMQ_URL_PROD || "development" 

const rabbitMQ_url = 
    env === "production"
        ? process.env.RABBITMQ_URL_PROD
        : process.env.RABBITMQ_URL_DEV

export const connectToRabbitMQ = async()=>{
    try {
        connection = await amqp.connect( rabbitMQ_url as string);
        channel = await connection.createChannel();

        await channel.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });
        // logger.info(`🐇 Connected to RabbitMQ..`);

        return channel;
    } catch (error) {
        logger.error(`Error connecting to RabbitMQ : ${error}`)
    }
}

const kyc_job = async(data:any, queue: string )=>{
    try {
        if(!channel){
          await connectToRabbitMQ()
        }

        channel.assertQueue(queue, { durable: true });

        // convert the payload to a string
        const messageBuffer = Buffer.from(JSON.stringify(data));

        channel.sendToQueue(queue, Buffer.from(messageBuffer), {
          persistent : true
        })
        logger.info(`KYC job added to queue .`)
    } catch (error) {
      logger.error(`Error adding KYC job to queue`)
    }
}

export const publish_kyc_job_id = async (data:any) =>{
    try {
      await kyc_job(data, QUEUES.identity)
    } catch (error) {
      logger.error(`Error adding KYC job to queue`)
    }
}

export const publish_kyc_job_passport = async (data:any) =>{
    try {
      await kyc_job(data, QUEUES.passport)
    } catch (error) {
      logger.error(`Error adding KYC job to queue`)
    }
}

export const publish_kyc_job_banking = async (data:any) =>{
    try {
      await kyc_job(data, QUEUES.banking)
    } catch (error) {
      logger.error(`Error adding KYC job to queue`)
    }
}

export const publish_kyc_job_kra = async (data:any) =>{
    try {
      await kyc_job(data, QUEUES.kra)
    } catch (error) {
      logger.error(`Error adding KYC job to queue`)
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