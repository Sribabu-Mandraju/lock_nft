import express from "express";
import {
  getWithdrawalQueuesByPool,
  getUsdtWithdrawalQueues,
  getUsdcWithdrawalQueues,
  getUsdtNolockupWithdrawalQueues,
  recordWithdrawalTx,
} from "../controllers/Halal_Pool_controllers.js";

const router = express.Router();

// Use query parameters only: ?pool=usdt|usdc|usdt-nolockup and optional ?account=0x...
router.get("/queues", getWithdrawalQueuesByPool);
router.get("/queues/usdt", getUsdtWithdrawalQueues);
router.get("/queues/usdc", getUsdcWithdrawalQueues);
router.get("/queues/usdt-nolockup", getUsdtNolockupWithdrawalQueues);

// Record a withdrawal-related transaction by tx hash (queue/executed)
router.post("/record-withdrawal", recordWithdrawalTx);

export default router;
