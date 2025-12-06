import admin from "firebase-admin";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

// Resolve absolute path to your service account JSON
const serviceAccountPath = path.resolve(
  __dirname,
  "../global-pay-f4df5-firebase-adminsdk-fbsvc-b154f97ee3.json"
);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccountPath),
  });
}

export const firebaseAdmin = admin;
export const messaging = admin.messaging();
