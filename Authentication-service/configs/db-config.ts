import { Client } from "pg";
import dotenv from "dotenv";
import logger from "../utils/logger";

dotenv.config();

const env = process.env.NODE_ENV as string;

let client: Client;

if (env === "production") {
  const connectionString = process.env.DATABASE_URL

  client = new Client({connectionString})

} else if (env === "staging") {
  const connectionString = process.env.DATABASE_URL_STAGING

  client = new Client({ connectionString })

} else {
  // Default to development
  const connectionString = process.env.DATABASE_URL_DEV

  client = new Client({ connectionString })

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