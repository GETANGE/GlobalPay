import express from "express"
import { forgotPassword, login, Registration, resetPassword, sendEmailToken, sendSMSToken, verifyEmailToken, verifySmsToken } from "../controllers/authController";

const router = express.Router();

router.post("/register", Registration);
router.post("/login", login)
router.post("/verifyEmail", sendEmailToken);
router.post("/verify", sendSMSToken)
router.get("/verify/sms/:token", verifySmsToken)
router.get("/verify/email/:token", verifyEmailToken)
router.post("/forgotPassword", forgotPassword)
router.patch("/resetPassword", resetPassword)
export default router;