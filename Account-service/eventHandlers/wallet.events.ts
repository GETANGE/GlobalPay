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
    } catch (error:any) {
        logger.error(`Error creating account for ${username}: ${error.message}`, error);
    }
}

// Account deactivation by user
export const handleAccountDeactivation = async (event: any) => {
    logger.info(`Event received: ${JSON.stringify(event)}`);

    const { targetUserId, username } = event;

    try {
        const walletQuery = `
            UPDATE wallets
            SET is_active = $1
            WHERE user_id = $2
        `;
        const values = [false, targetUserId];

        await client.query(walletQuery, values);
        logger.info(`Account deactivated for: ${username}`);
    } catch (error) {
        logger.error(`Error deactivating wallet for ${username}`, error);
    }
};