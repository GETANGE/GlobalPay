import nodemailer from "nodemailer"
import dotenv from "dotenv"
import logger from "./logger";
import { connectToRabbitMQ } from "./rabbitMQ";

dotenv.config()

type Options = {
    from: any;
    email: string;
    subject: string;
    name: string; 
    message: string;
    otp?:any
};

// Email template builder
const emailTemplate = (name: string, message: string, otp?: number): string => `
  <div style="font-family: Arial, sans-serif;">
    <h2>Hello ${name},</h2>
    <p>${message}</p>
    ${otp ? `<p>Your OTP is: <strong>${otp}</strong></p>` : ""}
    <p>Regards,<br/>GlobalPay Team</p>
  </div>
`;

export const sendMail = async (options: Options) => {
    const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        type: 'OAuth2',
        user: process.env.MAIL_USERNAME,
        clientId: process.env.OAUTH_CLIENTID,
        clientSecret: process.env.OAUTH_CLIENT_SECRET,
        refreshToken: process.env.OAUTH_REFRESH_TOKEN,
    },
    });

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
const processEmailJobs = async () => {
  try {
    const { channel } = await connectToRabbitMQ();

    await channel.assertQueue("email_queue", { durable: true });

    channel.consume("email_queue", async (msg:any) => {
      if (!msg) return;

      try {
        const data = JSON.parse(msg.content.toString());
        const { email, name, subject, message, otp, from } = data;

        logger.info(`📨 Processing job for: ${email}`);
        const result = await sendMail({ email, name, subject, message, otp, from });

        logger.info(`💌 Email sent: ${JSON.stringify(result.info.response)}`);
        channel.ack(msg);
      } catch (err: any) {
        logger.error(`😢 Failed to send email: ${err.message}`);
        channel.nack(msg, false, false); // don't requeue
      }
    });
  } catch (err:any) {
    logger.error(`😢 Failed to connect to RabbitMQ or process email jobs: ${err.message}`);
  }
};

processEmailJobs();