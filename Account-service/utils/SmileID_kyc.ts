import dotenv from "dotenv";
import { IDApi, WebApi, Signature } from "smile-identity-core";
import logger from "./logger";
import type { Channel } from "amqplib";
import { connectToRabbitMQ } from "./RabbitMQ";

dotenv.config();

let env = process.env.NODE_ENV || "development";

let smile_partner_id = process.env.SMILE_PARTNER_ID as string;
let smile_api_key = process.env.SMILE_API_KEY as string;
let smile_callback_url = process.env.SMILE_CALLBACK_URL as string;


const BASE_URL = 
  env === "production"
  ? process.env.SMILE_ID_SANDBOX_URL_PROD
  : process.env.SMILE_ID_SANDBOX_URL_DEV

const smile_id_bool =
  env === "production"
    ? process.env.SMILE_ID_PROD_BOOLEAN
    : process.env.SMILE_ID_DEV_BOOLEAN;

// WebApi for Document Verification
const webApi = new WebApi( smile_partner_id, smile_api_key, smile_id_bool as string,smile_callback_url );

// Create IDApi instance for ID Lookup
const idApi = new IDApi( smile_partner_id, smile_api_key, smile_id_bool as string );

// TODO:Generate signature
const connection = new Signature(smile_partner_id, smile_api_key);
const { signature, timestamp } = connection.generate_signature()

// confirm signature
const confirmSignature = connection.confirm_signature( timestamp, signature);


export const runBasicKYC = async( country: string, id_type: string, id_number: string ) =>{
  try {
     const payload ={
        smile_partner_id,
        timestamp,
        signature,
        country,
        id_type:id_type,
        id_number: id_number
     }

     const response = await fetch(`${BASE_URL}/id_verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
     })

     if(!response.ok){
        throw new Error(`Error: ${response.status} - ${await response.text()}`)
     }

     return response.json()
  } catch (error) {
    logger.error(`KYC ID lookup failed: ${error}`)
  }
}

// ID queue processor
let channel: Channel;

const processID_kyc_jobs = async()=>{
  try {
    channel = await connectToRabbitMQ();

    await channel.assertQueue("docsQueue", { durable: true })

    channel.consume("docsQueue", async (message:any)=>{
      if(!message) return

      try {
        const job_data = JSON.parse(message.content.toString());

        const { userId , documentType, fileBuffer, mimeType } = job_data
      } catch (error) {
        
      }
    })
  } catch (error) {
    
  }
}