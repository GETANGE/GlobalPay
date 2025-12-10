import express from "express";
import {
  authenticateRequest,
  authorizeRoles,
} from "../middlewares/authMiddleware";
import {
  deleteAllNotifications,
  deleteNotification,
  getAllNotifications,
  getSingleNotificationById,
  readAllNotifications,
  readNotification,
} from "../controllers/notification.controller";
import {
  deleteDeviceToken,
  getDeviceTokens,
  getSingleDeviceToken,
  saveDeviceToken,
  updateDeviceToken,
} from "../controllers/FCM_controller";
import {
  createBroadcast,
  deleteBroadcast,
  getAllBroadcastTopics,
  getBroadcastById,
  subscribeUserToTopic,
  unsubscribeUserFromTopic,
  updateBroadcast,
} from "../controllers/broadcast.fcm.controller";

const router = express.Router();

// All notifications
router.patch("/read", authenticateRequest, readNotification);
router.get("/", authenticateRequest, getAllNotifications);
router.get("/:notificationId", authenticateRequest, getSingleNotificationById);
router.patch("/all/read", authenticateRequest, readAllNotifications);
router.delete("/single/delete", authenticateRequest, deleteNotification);
router.delete("/all/delete", authenticateRequest, deleteAllNotifications);

// Device tokens
router.post("/fcm-token/create", authenticateRequest, saveDeviceToken);
router.delete("/fcm-token/delete", authenticateRequest, deleteDeviceToken);
router.patch("/fcm-token/update", authenticateRequest, updateDeviceToken);
router.get("/fcm-token", authenticateRequest, getDeviceTokens);
router.get("/:token/fcm-token", authenticateRequest, getSingleDeviceToken);

// Broadcast notifications
router.post(
  "/broadcast",
  authenticateRequest,
  authorizeRoles("admin"),
  createBroadcast,
);
router.get("/broadcasts", authenticateRequest, getAllBroadcastTopics);
router.get("/:broadcastId/broadcast", authenticateRequest, getBroadcastById);
router.patch("/broadcasts/:broadcastId", authenticateRequest, updateBroadcast);
router.delete("/broadcasts/:broadcastId", authenticateRequest, deleteBroadcast);

// Subscribe Broadcast
router.post("/broadcast/subscribe", authenticateRequest, subscribeUserToTopic);
router.patch(
  "/broadcast/unsubscribe",
  authenticateRequest,
  unsubscribeUserFromTopic,
);

export default router;
