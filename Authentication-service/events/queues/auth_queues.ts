import { getRabbitMQChannel } from "../../configs/rabbitMQ-config"
import logger from "../../utils/logger"
import client from "../../configs/db-config"
import { sendMail } from "../../utils/email"
import { EmailData, SmsData } from "../../types/express"

const EMAIL_QUEUE: string = "email_queue"
const SMS_QUEUE: string = "sms_queue"


export const publishEmailJob_queue = async(data: EmailData)=>{
    try {
        const channel = await getRabbitMQChannel()

        // ensure the queue exists
        channel.assertQueue(EMAIL_QUEUE, { durable : true});
        
        channel.sendToQueue(EMAIL_QUEUE, Buffer.from(JSON.stringify(data)), {
            persistent: true
        });

        logger.info(`Email job added to queue .`)
    } catch (error) {
        logger.error(`Error adding Job to a queue`)
    }
}

export const publishSMSJob_queue = async(data: SmsData)=>{
    try {
        const channel = await getRabbitMQChannel()

        channel.sendToQueue(SMS_QUEUE, Buffer.from(JSON.stringify(data)), {
            persistent: true
        });

        logger.info(`SMS job added to queue .`)
    } catch (error) {
        logger.error(`Error adding Job to a queue`)
    }
}