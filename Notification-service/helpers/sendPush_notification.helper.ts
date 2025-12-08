import { firebaseAdmin } from "../configs/firebase-config";
import logger from "../utils/logger";
import { PushNotificationPayload } from "../types/express";


export const sendPushNotification = async (token: string, payload: PushNotificationPayload) => {
    const message = {
        notification: {
            title: payload.title,
            body: payload.message
        },
        token
    };

    try {
        await firebaseAdmin.messaging().send(message);
        logger.info('📩 Notification sent successfully');
    } catch (error) {
        logger.error('📩 Error sending notification:', error);
    }
};
