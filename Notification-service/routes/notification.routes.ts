import express from 'express';
import { authenticateRequest } from '../middlewares/authMiddleware';
import { deleteAllNotifications, deleteNotification, getSingleNotificationById, readAllNotifications, readNotification } from '../controllers/notification.controller';
import { deleteDeviceToken, getDeviceTokens, getSingleDeviceToken, saveDeviceToken, updateDeviceToken } from '../controllers/FCM_controller';

const router = express.Router();

// All notifications
router.patch("/read", authenticateRequest, readNotification);
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

export default router;