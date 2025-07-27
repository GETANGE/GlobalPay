import express from "express"
import { getAllAccounts, getSingleAccount } from "../controllers/accountController";
import { authenticateRequest, authorizeRoles } from "../middlewares/authMiddleware";

const router = express.Router()

router.get('/stats', authenticateRequest, authorizeRoles('admin'), getAllAccounts)
router.get('/stats/:account_id', authenticateRequest, getSingleAccount)

export default router;