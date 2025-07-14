import express from "express"
import { forgotPassword, login, protectRoute, Registration, resetPassword, sendEmailToken, sendSMSToken, updatePassword, verifyEmailToken, verifySmsToken } from "../controllers/authController";
import { getLoginOptions, passkeyRegister, verifyPasskey, verifyPasskeyLogin } from "../controllers/biometricsController";
import passport from "passport";
import { githubCallback, googleCallback } from "../controllers/OAuth2Controller";

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

router.get("/github", passport.authenticate('github', { scope: ['user:email']}));
router.get("/github/callback", githubCallback)

router.get("/google", passport.authenticate('google', { scope: ['profile', 'email']}));
router.get('/google/callback', googleCallback)

export default router;