import Africastalking from "africastalking"
import dotenv from "dotenv"
import logger from "./logger";
import APIError from "../controllers/errorHandler";
import { connectToRabbitMQ } from "./rabbitMQ";
import type { Channel } from 'amqplib';
import client from "../configs/db-config";
import { resetToken } from "./generateToken";

dotenv.config()

const SMS_QUEUE: string = "sms_queue"

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
let channel: Channel;

const processSMSJobs = async()=>{
    try {
        channel = await connectToRabbitMQ();

        await channel.assertQueue(SMS_QUEUE, { durable: true });
        channel.consume(SMS_QUEUE, async(msg:any)=>{
            if(!msg) return;

            try {
                const data = JSON.parse(msg.content.toString());
                const { phone_number, message, from, userId } = data;

                logger.info(`💌 Processing job for :${data.phone_number}`)
                const result = await sendSMS(phone_number, message, from);

                // insert to the database
                const { hashedToken, expiresAt } = resetToken();
                
                const insertQuery = {
                    text: `
                        INSERT INTO user_verification (user_id, phone_token, phone_expires_at) 
                        VALUES ($1, $2, $3) 
                        ON CONFLICT (user_id) DO UPDATE
                        SET phone_token = EXCLUDED.phone_token,
                            phone_expires_at = EXCLUDED.phone_expires_at
                        RETURNING *
                    `,
                    values: [userId, hashedToken, expiresAt]
                }

                await client.query(insertQuery);                

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