import client from "../configs/db-config";
import logger from "../utils/logger"

export const handleAccountCreation =async (event: any)=>{
    logger.info(`Event received: ${JSON.stringify(event)}`)

    // create account
    const { userId, username } = event;

    try {
        const userQuery = `
            INSERT INTO wallets (user_id, balance, frozen_balance)
            VALUES ($1, $2, $3)
        `
        const values = [userId, 0.00, 0.00];

        await client.query(userQuery, values)
        logger.info(`Account created for ${username}`)
    } catch (error) {
        logger.error(`Error occured while creating user account`, error)
    }
}