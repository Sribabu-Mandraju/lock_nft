import express from "express";
import {
  // Read functions
  getDeposit,
  getTokenURI,
  getUsdcAddr,
  getROIs,
  getContractURI,
  getBaseURI,
  getTotalSupply,
  getTokenByIndex,
  getTokensOfOwner,
  getTokenOwner,
  getContractOwner,
  getAllOwnedNFTs,

  // Write functions (placeholders)
  connectWallet,
  setUSDT,
  setROIs,
  deposit,
  redeem,
  collectFees,
} from "../controllers/LockNft.controllers.js";

const router = express.Router();

// Read routes
router.get("/deposit", getDeposit); // Get deposit info by token ID
router.get("/token-uri", getTokenURI); // Get token URI by token ID
router.get("/usdc", getUsdcAddr); // Get USDT contract address
router.get("/rois", getROIs); // Get current ROI values
router.get("/contract-uri", getContractURI); // Get contract URI
router.get("/base-uri", getBaseURI); // Get base URI
router.get("/total-supply", getTotalSupply); // Get total NFT supply
router.get("/token-by-index", getTokenByIndex); // Get token by index
router.get("/tokens-of-owner", getTokensOfOwner); // Get tokens owned by address
router.get("/token-owner", getTokenOwner); // Get owner of token
router.get("/contract-owner", getContractOwner); // Get contract owner
router.get("/owned-nfts", getAllOwnedNFTs); // Get all owned NFTs with details

// Write routes (placeholders)
router.get("/connect", connectWallet); // Connect wallet (client-side)
router.post("/set-usdt", setUSDT); // Set USDT address (admin)
router.post("/set-rois", setROIs); // Set ROI values (admin)
router.post("/deposit", deposit); // Make deposit (client-side)
router.post("/redeem", redeem); // Redeem deposit (client-side)
router.post("/collect-fees", collectFees); // Collect fees (admin)

export default router;
