import express from "express"
import { forgotPassword, login, Registration, sendEmailToken, sendSMSToken, verifyEmailToken, verifySmsToken } from "../controllers/authController";

const router = express.Router();

router.post("/register", Registration);
router.post("/login", login)
router.post("/verifyEmail", sendEmailToken);
router.post("/verify", sendSMSToken)
router.get("/verify/sms/:token", verifySmsToken)
router.get("/verify/email/:token", verifyEmailToken)
router.post("/forgotPassword", forgotPassword)
export default router;