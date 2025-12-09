import Africastalking from "africastalking";
import dotenv from "dotenv";
import logger from "./logger";
import APIError from "./APIError";

dotenv.config();

const getSMSInstance = () => {
  const credentials = {
    apiKey: process.env.AFRICASTALKING_API as string,
    username: process.env.AFRICASTALKING_USERNAME as string,
  };
  return Africastalking(credentials).SMS;
};

export const sendSMS = async (phone_number: string, message: string, from?: string) => {
  const sms = getSMSInstance(); // delay time to enhance testing
  try {
    const payload: any = { to: [phone_number], message };
    if (from) payload.from = from;

    const response = await sms.send(payload); 
    return response;
  } catch (error) {
    logger.error(`Error sending SMS: ${error}`);
    throw new APIError("Error sending SMS", 400);
  }
};
