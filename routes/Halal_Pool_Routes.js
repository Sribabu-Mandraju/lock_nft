import express from "express";
import { getWithdrawalQueuesByPool, getUsdtWithdrawalQueues, getUsdcWithdrawalQueues, getUsdtNolockupWithdrawalQueues } from "../controllers/Halal_Pool_controllers.js";

const router = express.Router();

// Use query parameters only: ?pool=usdt|usdc|usdt-nolockup and optional ?account=0x...
router.get("/queues", getWithdrawalQueuesByPool);
router.get("/queues/usdt", getUsdtWithdrawalQueues);
router.get("/queues/usdc", getUsdcWithdrawalQueues);
router.get("/queues/usdt-nolockup", getUsdtNolockupWithdrawalQueues);

export default router;