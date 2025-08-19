import express from "express";
import multer from "multer";
import { getAllAccounts, getSingleAccount, updateAccount } from "../controllers/walletController";
import { authenticateRequest, authorizeRoles } from "../middlewares/authMiddleware";
import APIError from "../utils/APIError";
import { banking, kra, kyc_approval_admin, kyc_rejection_admin, national_id, passport } from "../controllers/kyc_controller";
import { getAllLinkedAccounts, getSingleLinkedAccount, linkAccount_token } from "../controllers/tokenController";

const router = express.Router();

const storage = multer.memoryStorage();

const upload = multer({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10 MB
    },
    fileFilter: (req, file, callback) =>{
        if(!file.originalname.match(/\.(jpg|JPG|jpeg|JPEG|png|PNG|PDF|pdf)$/)){
            return callback(new APIError(`Only image and PDF are supported`, 400))
        }else{
            callback(null, true)
        }
    }
})

router.get('/stats', authenticateRequest, authorizeRoles('admin'), getAllAccounts)
router.get('/stats/:wallet_id', authenticateRequest, getSingleAccount)
router.patch('/wallet/:wallet_id', authenticateRequest, authorizeRoles('admin', 'user'), updateAccount)
router.post("/kyc/national-id", authenticateRequest, upload.single("file"), national_id);
router.post("/kyc/passport", authenticateRequest, upload.single("file"), passport);
router.post("/kyc/banking", authenticateRequest, upload.single("file"), banking);
router.post("/kyc/kra", authenticateRequest, upload.single("file"), kra);

router.patch('/kyc/admin/approve/:docs_id', authenticateRequest, authorizeRoles('admin'), kyc_approval_admin);
router.patch('/kyc/admin/reject/:docs_id', authenticateRequest, authorizeRoles('admin'), kyc_rejection_admin);

router.get('/linked/accounts', authenticateRequest, authorizeRoles('admin'), getAllLinkedAccounts);
router.get('linked/account/:accountId', authenticateRequest, getSingleLinkedAccount)
router.post('/linked/account', authenticateRequest, linkAccount_token)

export default router;