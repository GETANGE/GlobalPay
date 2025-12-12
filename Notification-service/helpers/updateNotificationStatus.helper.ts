import client from "../configs/db-config";

type NotificationStatus = "PENDING" | "SENT" | "DELETED" | "READ" | "DELIVERED";
type RecipientStatus = NotificationStatus | "FAILED";

// ----------------------------
// Helpers for transaction
// ----------------------------
const updateNotificationMainStatusTx = async (
  notificationId: string,
  status: NotificationStatus,
  txClient: any
): Promise<NotificationStatus> => {
  const mainStatus: NotificationStatus = status === "DELIVERED" ? "SENT" : status;

  await txClient.query(
    `UPDATE notifications SET status = $1 WHERE id = $2`,
    [mainStatus, notificationId]
  );

  return mainStatus;
};

const updateNotificationRecipientsStatusTx = async (
  notificationId: string,
  status: RecipientStatus,
  txClient: any
) => {
  await txClient.query(
    `UPDATE notification_recipients SET status = $1 WHERE notification_id = $2`,
    [status, notificationId]
  );
};

const logNotificationStatusChangeTx = async (
  notificationId: string,
  status: NotificationStatus,
  txClient: any
) => {
  await txClient.query(
    `INSERT INTO notification_logs (id, notification_id, status)
     VALUES (gen_random_uuid(), $1, $2)`,
    [notificationId, status]
  );
};

// ----------------------------
// Main ACID Transaction Function
// ----------------------------
export const updateNotificationStatus = async (
  notificationId: string,
  status: RecipientStatus
) => {
  const txClient = client

  try {
    await txClient.query("BEGIN");

    // 1. Update main notification status
    const mainStatus = await updateNotificationMainStatusTx(
      notificationId,
      status as NotificationStatus,
      txClient
    );

    // 2. Update recipient statuses
    await updateNotificationRecipientsStatusTx(notificationId, status, txClient);

    // 3. Log the change
    await logNotificationStatusChangeTx(notificationId, mainStatus, txClient);

    // Commit ACID transaction
    await txClient.query("COMMIT");
  } catch (err) {
    await txClient.query("ROLLBACK");
    throw err;
  }
};