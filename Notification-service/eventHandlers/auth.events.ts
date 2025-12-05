import client from "../configs/db-config";
import logger from "../utils/logger";

export const getAllUserData = async (input: { userIds: number[] } | number[]) => {
    try {
        const userIds = Array.isArray(input) ? input : input.userIds;

        if (!Array.isArray(userIds)) {
            throw new Error("userIds must be an array");
        }

        const userQuery = `
            SELECT id, username, email, first_name, last_name, phone_number, national_id , role
            FROM users 
            WHERE id = ANY($1)
        `;

        const result = await client.query(userQuery, [userIds]);
        return result.rows;

    } catch (error) {
        logger.error("Error fetching user data:", error);
        throw error;
    }
};


export const getSingleUserData = async (input: number | { userId: number }) => {
    try {
        const userId = typeof input === "object" ? input.userId : input;

        const userQuery = `
            SELECT id, username, email, first_name, last_name, phone_number, national_id 
            FROM users 
            WHERE id = $1
        `;

        const values = [userId];

        const result = await client.query(userQuery, values);

        return result.rows[0];

    } catch (error) {
        logger.error("Error fetching user data:", error);
        throw error;
    }
};
