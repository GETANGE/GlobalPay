import express from "express"
import { getAllAccounts, getSingleAccount, updateAccount } from "../controllers/walletController";
import { authenticateRequest, authorizeRoles } from "../middlewares/authMiddleware";

const router = express.Router()

router.get('/stats', authenticateRequest, authorizeRoles('admin'), getAllAccounts)
router.get('/stats/:wallet_id', authenticateRequest, getSingleAccount)
router.patch('/wallet/:wallet_id', authenticateRequest, authorizeRoles('admin', 'user'), updateAccount)

export default router;