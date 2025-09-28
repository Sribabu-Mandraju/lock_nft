import express from "express";
import { getWithdrawalQueuesByPool, getUsdtWithdrawalQueues, getUsdcWithdrawalQueues, getUsdtLockupWithdrawalQueues } from "../controllers/Hala_Pool_controllers.js";

const router = express.Router();

// Use query parameters only: ?pool=usdt|usdc|usdt-lockup and optional ?account=0x...
router.get("/queues", getWithdrawalQueuesByPool);
router.get("/queues/usdt", getUsdtWithdrawalQueues);
router.get("/queues/usdc", getUsdcWithdrawalQueues);
router.get("/queues/usdt-lockup", getUsdtLockupWithdrawalQueues);

export default router;