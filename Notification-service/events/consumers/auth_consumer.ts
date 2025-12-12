import { getRabbitMQChannel } from "../../configs/rabbitMQ";
import logger from "../../utils/logger";
import { sendMail } from "../../utils/email";
import { sendSMS } from "../../utils/sms";
import { publishEvent } from "../publishers/publish.notify";
import { updateNotificationStatus } from "../../helpers/updateNotificationStatus.helper";
import { logNotification } from "../../helpers/lognotification.helper";
import { sendToDLQ } from "../../helpers/sendTo_DLQ.helper";

const EXCHANGE_NAME: string = "global_pay_events";
const SMS_QUEUE: string = "sms_queue";
const EMAIL_QUEUE: string = "email_queue";

export const consumeEvent = async (routingKey: string, callback: any) => {
  try {
    const channel = await getRabbitMQChannel();

    await channel.assertExchange(EXCHANGE_NAME, "topic", { durable: true });

    const queue = await channel.assertQueue("", { exclusive: true });

    await channel.bindQueue(queue.queue, EXCHANGE_NAME, routingKey);

    channel.consume(queue.queue, async (message: any) => {
      if (message !== null) {
        const content = JSON.parse(message.content.toString());

        try {
          await callback(content);
          channel.ack(message);
        } catch (err: any) {
          logger.info(`Error processing event: ${routingKey} - ${err.message}`);

          await sendToDLQ(message.content.toString(), err.message);
          channel.nack(message, false, false);
        }
      }
    });

    logger.info(`Subscribed to Event :${routingKey}`);
  } catch (error) {
    logger.error(`Error consuming an event: ${routingKey}`);
  }
};

export const processEmailJobConsumer = async () => {
  try {
    logger.info(`✅ Setting up email consumer`);

    const channel = await getRabbitMQChannel();
    await channel.assertQueue(EMAIL_QUEUE, { durable: true });

    channel.consume(EMAIL_QUEUE, async (msg: any) => {
      if (!msg) return;

      const content = msg.content.toString();

      try {
        const data = JSON.parse(content);
        
        if (!data.email || !data.subject || !data.message || !data.userId) {
          logger.warn(`⚠️ Ignored invalid email job: missing required fields`);
          channel.ack(msg); 
          return; // STOP PROCESSING
        }
        
        const {
          email,
          name,
          subject,
          message,
          otp,
          from,
          userId,
          hashedToken,
          expiresAt,
          type,
        } = data;

        const result = await sendMail({
          email,
          name,
          subject,
          message,
          otp,
          from,
        });
        logger.info(
          `💌 Email sent: ${JSON.stringify(result.info?.response || "No response info")}`,
        );

        const notificationId = await logNotification(
          userId,
          subject,
          message,
          type || "EMAIL",
          data,
        );

        if (hashedToken && expiresAt) {
          try {
            await publishEvent("notifications.email.sent", {
              userId,
              hashedToken,
              expiresAt,
            });
          } catch (pubErr: any) {
            logger.error(
              `⚠️ Failed to publish notifications.email.sent event: ${pubErr.message}`,
            );
          }
        }

        try {
          await updateNotificationStatus(notificationId, "DELIVERED");
        } catch (updateErr: any) {
          logger.error(
            `⚠️ Failed to update notification status: ${updateErr.message}`,
          );
          // Throw to send to DLQ
          throw updateErr;
        }

        channel.ack(msg);
      } catch (err: any) {
        logger.error(`😢 Failed to process email job: ${err.message}`);

        // Send to Dead Letter Queue and prevent requeue
        await sendToDLQ(content, err.message);
        channel.nack(msg, false, false);
      }
    });
  } catch (err: any) {
    logger.error(
      `❌ Failed to connect to RabbitMQ or set up email consumer: ${err.message}`,
    );
  }
};

export const processSMSJobConsumer = async () => {
  try {
    logger.info(`✅ Setting up SMS consumer`);

    const channel = await getRabbitMQChannel();

    await channel.assertQueue(SMS_QUEUE, { durable: true });

    channel.consume(SMS_QUEUE, async (msg: any) => {
      if (!msg) return;
      
      try {
        const data = JSON.parse(msg.content.toString());
        
        const {
          phone_number,
          message,
          from,
          userId,
          hashedToken,
          expiresAt,
          type,
        } = data;

        logger.info(`💌 Processing SMS job`);

        // Send SMS
        await sendSMS(phone_number, message, from);

        const notificationId = await logNotification(
          userId,
          `SMS to ${phone_number}`,
          message,
          type || "SMS",
          data,
        );

        await publishEvent("notifications.sms.sent", {
          userId,
          hashedToken,
          expiresAt,
        });

        logger.info(`📨 SMS sent successfully`);

        const newStatus = "DELIVERED";
        await updateNotificationStatus(notificationId, newStatus);

        channel.ack(msg);
      } catch (error: any) {
        logger.error(`😢 Failed to process SMS job: ${error.message}`);
        await sendToDLQ(msg.content.toString(), error.message);

        // do NOT retry to avoid infinite loops
        channel.nack(msg, false, false);
      }
    });
  } catch (error: any) {
    logger.error(`😢 Failed to set up SMS processor: ${error.message}`);
  }
};
