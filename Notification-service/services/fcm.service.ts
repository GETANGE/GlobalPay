import client from "../configs/db-config";
import APIError from "../utils/APIError";

export const createFCM_Token = async (
  user_id: string,
  token: string,
  device_type: string,
) => {
  const query = `
    INSERT INTO device_tokens (user_id, token, device_type)
    VALUES ($1, $2, $3)
  `;

  try {
    await client.query("BEGIN");

    const result = await client.query(query, [user_id, token, device_type]);

    if (result.rowCount === 0) {
      throw new APIError("Failed to create FCM token", 500);
    }

    await client.query("COMMIT");

    return result.rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
};

export const deleteFCM_Token = async (user_id: string, token: string) => {
  const query = `
    DELETE FROM device_tokens
    WHERE user_id = $1 AND token = $2
  `;

  try {
    await client.query("BEGIN");

    const result = await client.query(query, [user_id, token]);

    if (result.rowCount === 0) {
      throw new APIError("Failed to delete FCM token", 500);
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
};

export const getFCM_Tokens = async (user_id: string) => {
  const query = `
    SELECT token, device_type
    FROM device_tokens
    WHERE user_id = $1
  `;

  const result = await client.query(query, [user_id]);

  if (result.rowCount === 0) {
    throw new APIError("No FCM tokens found", 404);
  }

  return result.rows;
};

export const updateFCM_Token = async (
  user_id: string,
  token: string,
  device_type: string,
) => {
  const query = `
    UPDATE device_tokens
    SET token = $2, device_type = $3
    WHERE user_id = $1
  `;

  try {
    await client.query("BEGIN");

    const result = await client.query(query, [user_id, token, device_type]);

    if (result.rowCount === 0) {
      throw new APIError("Failed to update FCM token", 500);
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
};

export const getFCM_Token = async (user_id: string, token: string) => {
  const query = `
    SELECT token, device_type
    FROM device_tokens
    WHERE user_id = $1 AND token = $2
  `;

  const result = await client.query(query, [user_id, token]);

  if (result.rowCount === 0) {
    throw new APIError("No FCM token found", 404);
  }

  return result.rows[0];
};
