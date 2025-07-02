import nodemailer, { TransportOptions} from "nodemailer"
import dotenv from "dotenv"
import logger from "./logger";
import { connectToRabbitMQ } from "./rabbitMQ";
import type { Channel } from 'amqplib';
import { resetToken } from "./generateToken";
import client from "../configs/db-config";

dotenv.config()

type Options = {
    from: string;
    email: string;
    subject: string;
    name: string; 
    message: string;
    otp?:number
};

// Email template builder
const emailTemplate = (name: string, message: string, otp?: number): string => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; color: #333;">
    <h2 style="color: #007bff;">Hello ${name},</h2>
    
    <p>Thank you for registering with <strong>GlobalPay</strong>.</p>

    <p>${message}</p>

    ${otp ? `
      <div style="margin: 20px 0; padding: 10px; background-color: #f2f2f2; border-left: 5px solid #007bff;">
        <p style="font-size: 18px; margin: 0;">Your OTP is: <strong>${otp}</strong></p>
      </div>
      <p><small>This OTP will expire in 10 minutes. Please do not share it with anyone.</small></p>
    ` : ""}

    <p>If you did not initiate this request, please ignore this email.</p>

    <p style="margin-top: 30px;">Regards,<br/><strong>GlobalPay Team</strong></p>
  </div>
`;

export const sendMail = async (options: Options) => {
    const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.MAIL_USERNAME as string,
        pass: process.env.MAIL_PASSWORD as string
    },
    } as TransportOptions);

  const mailOptions = {
    from: {
      name: "GlobalPay",
      address:  process.env.MAIL_USERNAME as string,
    },
    to: options.email,
    subject: options.subject,
    html: emailTemplate(options.name, options.message, options.otp),
  };

  const info = await transporter.sendMail(mailOptions);
  return { message: "💌 Email sent successfully", info };
};

// Email queue processor
let channel: Channel;

const processEmailJobs = async () => {
  try {
    channel = await connectToRabbitMQ();

    await channel.assertQueue("email_queue", { durable: true });

    channel.consume("email_queue", async (msg: any) => {
      if (!msg) return;

      try {
        const data = JSON.parse(msg.content.toString());
        const { email, name, subject, message, otp, from, userId, hashedToken, expiresAt } = data;

        logger.info(`📨 Processing job for: ${email}`);
        console.log("✅ Data received in worker:", { email, hashedToken, expiresAt });

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

processEmailJobs();