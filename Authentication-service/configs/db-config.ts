import { Client } from "pg";
import dotenv from "dotenv";
import logger from "../utils/logger";

dotenv.config();

const env = process.env.NODE_ENV as string;

let client: Client;

if (env === "production") {
  client = new Client({
    user: process.env.DATABASE_PROD_USERNAME as string,
    password: process.env.DATABASE_PROD_PASSWORD as string,
    host: process.env.DATABASE_PROD_HOST as string,
    port: Number(process.env.DATABASE_PROD_PORT),
    database: process.env.DATABASE_PROD_NAME as string,
  });
} else if (env === "staging") {
  client = new Client({
    user: process.env.DATABASE_STAGE_USERNAME as string,
    password: process.env.DATABASE_STAGE_PASSWORD as string,
    host: process.env.DATABASE_STAGE_HOST as string,
    port: Number(process.env.DATABASE_STAGE_PORT),
    database: process.env.DATABASE_STAGE_NAME as string,
  });
} else {
  // Default to development
  client = new Client({
    user: process.env.DATABASE_DEV_USERNAME as string,
    password: process.env.DATABASE_DEV_PASSWORD as string,
    host: process.env.DATABASE_DEV_HOST as string,
    port: Number(process.env.DATABASE_DEV_PORT),
    database: process.env.DATABASE_DEV_NAME as string,
  });
}

export const connectDatabase = async () => {
  try {
    await client.connect();
    logger.info(`🌊 Connected to the ${env} database successfully...`);
  } catch (error) {
    logger.warn("😢 Database connection error", error);
  }
};

export default client