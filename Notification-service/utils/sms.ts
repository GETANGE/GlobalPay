import Africastalking from "africastalking";
import dotenv from "dotenv";
import logger from "./logger";
import APIError from "./APIError";

dotenv.config();

interface Credentials {
  apiKey: string;
  username: string;
}

//Initialize Africastalking SDK
const credentials: Credentials = {
  apiKey: process.env.AFRICASTALKING_API as string,
  username: process.env.AFRICASTALKING_USERNAME as string,
};

const africastalking = Africastalking(credentials);

const sms = africastalking.SMS;

export const sendSMS = async (
  phone_number: string,
  message: string,
  from?: string
) => {
  try {
    const payload: any = {
      to: [phone_number],
      message: message,
    };

    if (from) {
      payload.from = from; // TODO: after necessary transaction to "AFRICASTALKING"
    }

    const response = await sms.send(payload);

    return response;
  } catch (error) {
    logger.error(`Error sending SMS: ${error}`);
    throw new APIError(`Error sending SMS`, 400);
  }
};