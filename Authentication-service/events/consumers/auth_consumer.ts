import { getRabbitMQChannel } from "../../configs/rabbitMQ-config";
import logger from "../../utils/logger";


const EXCHANGE_NAME: string ='global_pay_events';

export const consumeEvent = async(routingKey: string, callback:any)=>{
    try {
      const channel = await getRabbitMQChannel();

        await channel.assertExchange(EXCHANGE_NAME, "topic", { durable: true });
        
        const queue = await channel.assertQueue("", { exclusive: true})
        await channel.bindQueue(queue.queue, EXCHANGE_NAME, routingKey)
        channel.consume(queue.queue, (message:any)=>{
            if(message !== null){
                const content = JSON.parse(message.content.toString())
                logger.info(`📩 Event received (${routingKey}) → ${JSON.stringify(content)}`);
                
                callback(content)
                channel.ack(message)
            }
        })

        logger.info(`⛳ Subscribed to Event :${routingKey}`)
    } catch (error) {
        logger.error(`Error consuming an event: ${routingKey}`)
    }
}
