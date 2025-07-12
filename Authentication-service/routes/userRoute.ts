import express from "express"
import { forgotPassword, login, protectRoute, Registration, resetPassword, sendEmailToken, sendSMSToken, updatePassword, verifyEmailToken, verifySmsToken } from "../controllers/authController";
import { getLoginOptions, passkeyRegister, verifyPasskey, verifyPasskeyLogin } from "../controllers/biometricsController";

const router = express.Router();

router.post("/register", Registration);
router.post("/login", login)
router.post("/verifyEmail", sendEmailToken);
router.post("/verify", sendSMSToken)
router.get("/verify/sms/:token", verifySmsToken)
router.get("/verify/email/:token", verifyEmailToken)
router.post("/forgotPassword", forgotPassword)
router.patch("/resetPassword", resetPassword)
router.patch("/updatePassword", updatePassword)
router.get("/get-passkey", protectRoute, passkeyRegister)
router.post("/verify-passkey", verifyPasskey)
router.post("/options-passkey", getLoginOptions)
router.post("/login-passkey", verifyPasskeyLogin)

export default router;