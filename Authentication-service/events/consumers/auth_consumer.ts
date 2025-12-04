import { getRabbitMQChannel } from "../../configs/rabbitMQ-config";
import logger from "../../utils/logger";
import client from "../../configs/db-config";
import { sendMail } from "../../utils/email";
import { sendSMS } from "../../utils/sms";


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

        // Insert or update email_verification table
        const checkQuery = {
          text: `SELECT id FROM email_verification WHERE user_id = $1`,
          values: [userId],
        };

        const existing = await client.query(checkQuery);

        if (existing.rows.length > 0) {
          // UPDATE
          const updateQuery = {
            text: `
              UPDATE email_verification
              SET email_token = $2,
                  email_expires_at = $3,
                  created_at = CURRENT_TIMESTAMP
              WHERE user_id = $1
            `,
            values: [userId, hashedToken, expiresAt],
          };
          await client.query(updateQuery);
        } else {
          // INSERT
          const insertQuery = {
            text: `
              INSERT INTO email_verification (user_id, email_token, email_expires_at)
              VALUES ($1, $2, $3)
            `,
            values: [userId, hashedToken, expiresAt],
          };
          await client.query(insertQuery);
        }

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
        const { phone_number, message, from, userId, hashedToken, expiresAt } =
          data;

        logger.info(`💌 Processing sms job `);
        await sendSMS(phone_number, message, from);

        // Insert or update sms_verification table
        const checkQuery = {
          text: `SELECT id FROM sms_verification WHERE user_id = $1`,
          values: [userId],
        };

        const existing = await client.query(checkQuery);

        if (existing.rows.length > 0) {
          const updateQuery = {
            text: `
                        UPDATE sms_verification
                        SET phone_token = $2,
                            phone_expires_at = $3,
                            created_at = CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Nairobi'
                        WHERE user_id = $1
                        `,
            values: [userId, hashedToken, expiresAt],
          };
          await client.query(updateQuery);
        } else {
          const insertQuery = {
            text: `
                            INSERT INTO sms_verification (user_id, phone_token, phone_expires_at) 
                            VALUES ($1, $2, $3) 
                        `,
            values: [userId, hashedToken, expiresAt],
          };

          await client.query(insertQuery);
        }

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
