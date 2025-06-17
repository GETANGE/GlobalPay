import express from "express"
import { Registration } from "../controllers/authController";

const router = express.Router();

router.post('/register', Registration);

export default router;