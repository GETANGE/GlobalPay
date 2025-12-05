import client from "../configs/db-config";

export const updateNotificationStatus = async (notificationId: string, status: "SENT" | "FAILED" | "READ") => {
  try {
    await client.query("BEGIN");

    // 1. Update main notification status
    await client.query(
      `UPDATE notifications SET status = $1 WHERE id = $2`,
      [status, notificationId]
    );

    // 2. Update recipient status
    await client.query(
      `UPDATE notification_recipients SET status = $1 WHERE notification_id = $2`,
      [status, notificationId]
    );

    // 3. Insert log entry
    await client.query(
      `INSERT INTO notification_logs (id, notification_id, status)
       VALUES (gen_random_uuid(), $1, $2)`,
      [notificationId, status]
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
};