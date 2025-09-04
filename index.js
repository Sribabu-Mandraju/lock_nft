import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import mongoose from 'mongoose'
import { ethers } from 'ethers'
import LockNftRoutes from "./routes/LockNft.routes.js"
import LockTimeNFTRoutes from "./routes/LockTimeNFTRoutes.js"
import userDepositRoutes from "./routes/userDepositRoutes.js"
import LockTimeNFTRoutes_Halal from "./routes/Halal_TimeLockNFT_routes.js"
import Deposit from "./models/Deposit.js"
import TimeLockNFTStaking_ABI from "./abis/LockTimeNFT_ABI_Halal.json" with { type: "json" }

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

// Read from contract (GET)
app.get("/",async (req,res) => {
    res.status(200).json({
        "message":"hello world"
    })
})

// --- Blockchain websocket listeners ---
const ALCHEMY_WS_URL = "wss://eth-sepolia.g.alchemy.com/v2/geIrP8FKOhyxLglmOQLfF";
const STAKING_ADDRESS = process.env.STAKING_ADDRESS || "0xf4b4ea96572B0B9411Ba15A81db6d1dEC4199671";

if (ALCHEMY_WS_URL) {
  const wsProvider = new ethers.WebSocketProvider(ALCHEMY_WS_URL);
  const wsContract = new ethers.Contract(STAKING_ADDRESS, TimeLockNFTStaking_ABI, wsProvider);

  // Deposited(address user, uint256 tokenId, address depsoitToken, uint256 amount, uint8 months, uint256 depositedAt)
  wsContract.on("Deposited", async (user, tokenId, depositToken, amount, months, depositedAt, event) => {
    try {
      console.log("[WS] Deposited event:", {
        user: String(user),
        tokenId: tokenId?.toString?.(),
        depositToken: String(depositToken),
        amount: amount?.toString?.(),
        months: Number(months),
        depositedAt: depositedAt?.toString?.(),
        txHash: event?.log?.transactionHash,
        blockNumber: event?.log?.blockNumber,
      });

      await Deposit.create({
        user: String(user),
        tokenId: tokenId.toString(),
        token: String(depositToken),
        amount: amount.toString(),
        periodMonths: Number(months),
        depositedAt: depositedAt.toString(),
        txHash: event?.log?.transactionHash,
        blockNumber: event?.log?.blockNumber,
      });
      console.log("[WS] Saved deposit:", tokenId.toString());
    } catch (err) {
      console.error("[WS] Save deposit failed:", err.message);
    }
  });

  // Redeemed(address user, uint256 tokenId, address reedemToken, uint256 payout)
  wsContract.on("Redeemed", async (user, tokenId) => {
    try {
      await Deposit.deleteOne({ tokenId: tokenId.toString() });
      console.log("[WS] Removed redeemed token:", tokenId.toString());
    } catch (err) {
      console.error("[WS] Remove redeemed failed:", err.message);
    }
  });
} else {
  console.warn("ALCHEMY_WS_URL not set; websocket listeners disabled.");
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})