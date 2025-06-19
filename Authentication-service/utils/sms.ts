import Africastalking from "africastalking"
import dotenv from "dotenv"
import logger from "./logger";
import APIError from "../controllers/errorHandler";
import { connectToRabbitMQ } from "./rabbitMQ";

dotenv.config()

interface Credentials{
    apiKey: string;
    username: string
}

//Initialize Africastalking SDK
const credentials: Credentials = {
    apiKey: process.env.AFRICASTALKING_API as string,
    username: process.env.AFRICASTALKING_USERNAME as string
}

const africastalking = Africastalking(credentials);

const sms = africastalking.SMS;

// send SMS 
interface Payload{
    to: string[];
    message: string;
    from?: string
}
export const sendSMS = async (phone_number: string, message: string, from?: string) => {
  try {
    const payload: any = {
      to: [phone_number],
      message: message,
    };

    if (from) {
      payload.from = from; // TODO: after necessary transaction to "AFRICASTALKING"
    }

    const response = await sms.send(payload);
    logger.info(`💌 SMS sent successfully`);

    return response;
  } catch (error) {
    logger.error(`Error sending SMS: ${error}`);
    throw new APIError(`Error sending SMS`, 400);
  }
};

// SMS queue processor
const processSMSJobs = async()=>{
    try {
        const { channel } = await connectToRabbitMQ();

        await channel.assertQueue("sms_queue", { durable: true });
        channel.consume("sms_queue", async(msg:any)=>{
            if(!msg) return;

            try {
                const data = JSON.parse(msg.content.toString());
                const { phone_number, message, from } = data;

                logger.info(`💌 Processing job for :${data.phone_number}`)
                const result = await sendSMS(phone_number, message, from);

                logger.info(`💌 SMS sent: ${JSON.stringify(result)}`)
                channel.ack(msg)
            } catch (error:any) {
                logger.error(`😢 Failed to send sms: ${error.message}`);
                channel.nack(msg, false, false) // do not requeue
            }
        })
    } catch (error:any) {
        logger.error(`😢 Failed to process sms jobs: ${error.message}`)
    }
}
processSMSJobs()