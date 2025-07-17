import express from "express";
import {
  forgotPassword,
  login,
  protectRoute,
  Registration,
  resetPassword,
  restrictTo,
  sendEmailToken,
  sendSMSToken,
  updatePassword,
  verifyEmailToken,
  verifySmsToken,
} from "../controllers/authController";
import {
  getLoginOptions,
  passkeyRegister,
  verifyPasskey,
  verifyPasskeyLogin,
} from "../controllers/biometricsController";
import passport from "passport";
import {
  githubCallback,
  googleCallback,
} from "../controllers/OAuth2Controller";
import { activateUser, deactivateUser, deleteUser, getAllUsers, getSingleUser } from "../controllers/userController";

const router = express.Router();

router.post("/register", Registration);
router.post("/login", login);
router.get("/users", protectRoute, restrictTo("admin"), getAllUsers as any);
router.post("/verifyEmail", sendEmailToken);
router.post("/verifySMS", sendSMSToken);
router.get("/verify/sms/:token", verifySmsToken);
router.get("/verify/email/:token", verifyEmailToken);
router.get("/users/:userId", getSingleUser as any);
router.delete("/users/:id", protectRoute, restrictTo("admin"), deleteUser)
router.patch("/users/deactivate/:userId", protectRoute, deactivateUser)
router.patch("/users/activate/:userId", protectRoute, restrictTo("admin"), activateUser)
router.post("/forgotPassword", forgotPassword);
router.patch("/resetPassword", resetPassword);
router.patch("/updatePassword", updatePassword);
router.get("/get-passkey", protectRoute, passkeyRegister);
router.post("/verify-passkey", verifyPasskey);
router.post("/options-passkey", getLoginOptions);
router.post("/login-passkey", verifyPasskeyLogin);

router.get(
  "/github",
  passport.authenticate("github", { scope: ["user:email"] })
);
router.get("/github/callback", githubCallback);

router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);
router.get("/google/callback", googleCallback);

export default router;
