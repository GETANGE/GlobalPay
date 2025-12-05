import { getRabbitMQChannel } from "../../configs/rabbitMQ";
import logger from "../../utils/logger";
import { sendMail } from "../../utils/email";
import { sendSMS } from "../../utils/sms";
import { publishEvent } from "../publishers/publish.notify";


const EXCHANGE_NAME: string ='global_pay_events';
const SMS_QUEUE: string = 'sms_queue';
const EMAIL_QUEUE: string = 'email_queue';

export const consumeEvent = async(routingKey: string, callback:any)=>{
    try {
        const channel = await getRabbitMQChannel()

        await channel.assertExchange(EXCHANGE_NAME, "topic", { durable: true });
        
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

export const processEmailJobConsumer = async () => {
  try {
    const channel = await getRabbitMQChannel()

    await channel.assertQueue(EMAIL_QUEUE, { durable: true });

    channel.consume(EMAIL_QUEUE, async (msg: any) => {
      if (!msg) return;

      try {
        const data = JSON.parse(msg.content.toString());
        const { email, name, subject, message, otp, from, userId, hashedToken, expiresAt } = data;

        const result = await sendMail({ email, name, subject, message, otp, from });

        await publishEvent("email.sent", { 
          userId, 
          hashedToken, 
          expiresAt 
        });

        logger.info(`💌 Email sent: ${JSON.stringify(result.info.response)}`);
        channel.ack(msg);
      } catch (err: any) {
        logger.error(`😢 Failed to process email job: ${err.message}`);
        channel.nack(msg, false, false); // don't requeue
      }
    });
  } catch (err: any) {
    logger.error(`❌ Failed to connect to RabbitMQ or set up email processor: ${err.message}`);
  }
};

export const processSMSJobConsumer = async () => {
  try {
    const channel = await getRabbitMQChannel();

    await channel.assertQueue(SMS_QUEUE, { durable: true });
    channel.consume(SMS_QUEUE, async (msg: any) => {
      if (!msg) return;

      try {
        const data = JSON.parse(msg.content.toString());
        const { phone_number, message, from, userId, hashedToken, expiresAt } = data;

        logger.info(`💌 Processing sms job `);
        await sendSMS(phone_number, message, from);

        await publishEvent("sms.sent", {
          userId, 
          hashedToken, 
          expiresAt
        });

        logger.info(`💌 SMS sent successfully`);
        channel.ack(msg);
      } catch (error: any) {
        logger.error(`😢 Failed to send sms: ${error.message}`);
        channel.nack(msg, false, false); // do not requeue
      }
    });
  } catch (error: any) {
    logger.error(`😢 Failed to process sms jobs: ${error.message}`);
  }
};
