import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import mongoose from 'mongoose'
import { ethers } from 'ethers'
import LockNftRoutes from "./routes/LockNft.routes.js"
import LockTimeNFTRoutes from "./routes/LockTimeNFTRoutes.js"
import userDepositRoutes from "./routes/userDepositRoutes.js"
import LockTimeNFTRoutes_Halal from "./routes/Halal_TimeLockNFT_routes.js"
import QueueWithdrawalExpiry from "./models/QueueWithdrawalExpiry.js"
import TimeLockNFTStaking_ABI from "./abis/LockTimeNFT_ABI_Halal.json" with { type: "json" }
import Halal_Pool_Routes from "./routes/Halal_Pool_Routes.js"

const app = express()
const PORT = 3000

// MongoDB Connection
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Connect to MongoDB
connectDB();

app.use(cors())
app.use(express.json())

app.use("/market",LockNftRoutes)
app.use("/lockTimeNFT",LockTimeNFTRoutes)
app.use("/deposits", userDepositRoutes)
app.use("/halal_lockTimeNFT", LockTimeNFTRoutes_Halal)
app.use("/halal_pool", Halal_Pool_Routes)

// Read from contract (GET)
app.get("/",async (req,res) => {
    res.status(200).json({
        "message":"hello world"
    })
})

// --- Blockchain websocket listeners ---
const ALCHEMY_WS_URL = "wss://eth-mainnet.g.alchemy.com/v2/geIrP8FKOhyxLglmOQLfF";
// USDT pool
const USDT_MARKET_ADDRESS = "0xBe8b1f70c5C20fe240CfA7e55B434545398279F3";
// USDC pool
const USDC_MARKET_ADDRESS = "0x7e496C5678b1722289d9c4A13C9aa53631Ca7607";

if (ALCHEMY_WS_URL) {
  const wsProvider = new ethers.WebSocketProvider(ALCHEMY_WS_URL);
  const usdtContract = new ethers.Contract(USDT_MARKET_ADDRESS, TimeLockNFTStaking_ABI, wsProvider);
  const usdcContract = new ethers.Contract(USDC_MARKET_ADDRESS, TimeLockNFTStaking_ABI, wsProvider);

  // Deposited(address user, uint256 tokenId, address depsoitToken, uint256 amount, uint8 months, uint256 depositedAt)


  // WithdrawalQueued(uint256 indexed expiry, address indexed account, uint256 scaledAmount, uint256 normalizedAmount)
  const handleWithdrawalQueued = (marketPool) => async (
    expiry,
    account,
    scaledAmount,
    normalizedAmount,
    event
  ) => {
    try {
      const key = {
        expiry: expiry?.toString?.(),
        account: String(account),
      };

      const update = {
        scaledAmount: scaledAmount?.toString?.(),
        normalizedAmount: normalizedAmount?.toString?.(),
        market_pool: marketPool,
        txHash: event?.log?.transactionHash,
        blockNumber: event?.log?.blockNumber,
      };

      const saved = await QueueWithdrawalExpiry.findOneAndUpdate(
        key,
        { $set: update },
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true,
        }
      );

      console.log("[WS] WithdrawalQueued upserted:", saved?.id, key, marketPool);
    } catch (err) {
      console.error("[WS] WithdrawalQueued upsert failed:", err.message);
    }
  };

  usdtContract.on("WithdrawalQueued", handleWithdrawalQueued("usdt"));
  usdcContract.on("WithdrawalQueued", handleWithdrawalQueued("usdc"));

  // WithdrawalExecuted(uint256 indexed expiry, address indexed account, uint256 normalizedAmount)
  const handleWithdrawalExecuted = (marketPool) => async (
    expiry,
    account,
    _normalizedAmount,
    event
  ) => {
    try {
      const key = {
        expiry: expiry?.toString?.(),
        account: String(account),
      };

      const res = await QueueWithdrawalExpiry.deleteOne(key);
      console.log(
        "[WS] WithdrawalExecuted removed:",
        key,
        marketPool,
        "deletedCount=",
        res?.deletedCount
      );
    } catch (err) {
      console.error("[WS] WithdrawalExecuted delete failed:", err.message);
    }
  };

  usdtContract.on("WithdrawalExecuted", handleWithdrawalExecuted("usdt"));
  usdcContract.on("WithdrawalExecuted", handleWithdrawalExecuted("usdc"));
} else {
  console.warn("ALCHEMY_WS_URL not set; websocket listeners disabled.");
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})