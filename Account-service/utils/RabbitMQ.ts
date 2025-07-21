import amqp from "amqplib"
import dotenv from "dotenv"
import logger from "./logger";

dotenv.config();

let connection = null;
let channel: any =null

const EXCHANGE_NAME: string ='global_pay_events'


const isProduction = process.env.NODE_ENV === "production";

const rabbitMQ_url = isProduction
  ? process.env.RABBITMQ_URL_PROD
  : process.env.RABBITMQ_URL_DEV;

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

export const consumeEvent = async(routingKey: string, callback:any)=>{
    try {
        if(!channel){
            await connectToRabbitMQ()
        }
        const queue = await channel.assertQueue("", { exclusive: true})
        await channel.bindQueue(queue.queue, EXCHANGE_NAME, routingKey)
        channel.consume(queue.queue, (message:any)=>{
            if(message !== null){
                const content = JSON.parse(message.content.toString())
                callback(content)
                channel.ack(message)
            }
        })

        logger.info(`Subscribed to Event :${routingKey}`)
    } catch (error) {
        logger.error(`Error consuming an event: ${routingKey}`)
    }
}

export default channel;