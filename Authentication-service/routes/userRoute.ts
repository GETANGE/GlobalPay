import express from "express"
import { Registration, sendEmailToken, verifySMS } from "../controllers/authController";

const router = express.Router();

router.post('/register', Registration);
router.post('/verifyEmail', sendEmailToken);
router.post('/verify', verifySMS)

export default router;