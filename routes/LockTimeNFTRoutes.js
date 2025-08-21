import express from 'express';
import { getStakingPublicData } from '../controllers/LockTimeNFT.js';
import { getStakingAdminData } from '../controllers/LockTimeNFT.js';
import { getUserDeposits } from '../controllers/LockTimeNFT.js';
import { getTokenMetadata } from '../controllers/LockTimeNFT.js';
import { getAllDeposits } from '../controllers/LockTimeNFT.js';
const router = express.Router();

router.get('/publicMetaData', getStakingPublicData);
router.get('/adminMetaData', getStakingAdminData);
router.get("/userDeposits",getUserDeposits)
router.get("/getTokenMetaData",getTokenMetadata)
router.get("/allDeposits", getAllDeposits)

export default router;