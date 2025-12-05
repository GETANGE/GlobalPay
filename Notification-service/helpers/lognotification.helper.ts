import client from "../configs/db-config";

export const logNotification = async (userId: string, title: string, message: string, type: string, data?: any) => {
  try {
    await client.query("BEGIN");

    // 1. Insert notification
    const notificationResult = await client.query(
      `INSERT INTO notifications (id, user_id, title, message, type, data)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
       RETURNING id, status`,
      [userId, title, message, type, data]
    );

    const notificationId = notificationResult.rows[0].id;

    // 2. Insert recipient
    await client.query(
      `INSERT INTO notification_recipients (id, notification_id, user_id)
       VALUES (gen_random_uuid(), $1, $2)`,
      [notificationId, userId]
    );

    // 3. Insert initial log
    await client.query(
      `INSERT INTO notification_logs (id, notification_id, status)
       VALUES (gen_random_uuid(), $1, $2)`,
      [notificationId, "PENDING"]
    );

    await client.query("COMMIT");
    
    return notificationId;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
};
