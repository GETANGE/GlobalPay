import express from 'express';
import { authenticateRequest } from '../middlewares/authMiddleware';
import { readAllNotifications, readNotification } from '../controllers/notification.controller';
const router = express.Router();

router.patch("/read", authenticateRequest, readNotification);
router.patch("/all/read", authenticateRequest, readAllNotifications);

export default router;