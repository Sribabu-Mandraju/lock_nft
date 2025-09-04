import express from "express";
import { getStakingPublicData_Halal } from "../controllers/Halal_TimeLockNFT.js";
import { getStakingAdminData_Halal } from "../controllers/Halal_TimeLockNFT.js";
import { getUserDeposits_Halal } from "../controllers/Halal_TimeLockNFT.js";
import { getTokenMetadata_Halal } from "../controllers/Halal_TimeLockNFT.js";
import { getAllDeposits_Halal } from "../controllers/Halal_TimeLockNFT.js";
const router = express.Router();

router.get("/publicMetaData", getStakingPublicData_Halal);
router.get("/adminMetaData", getStakingAdminData_Halal);
router.get("/userDeposits", getUserDeposits_Halal);
router.get("/getTokenMetaData", getTokenMetadata_Halal);
router.get("/allDeposits", getAllDeposits_Halal);

export default router;
 