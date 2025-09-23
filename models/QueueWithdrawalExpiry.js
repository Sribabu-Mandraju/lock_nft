import mongoose from "mongoose";

const QueueWithdrawalExpirySchema = new mongoose.Schema(
  {
    expiry: { type: String, index: true },
    account: { type: String, index: true },
    scaledAmount: { type: String },
    normalizedAmount: { type: String },
    market_pool: { type: String, enum: ["usdt", "usdc"], index: true },
    txHash: { type: String },
    blockNumber: { type: Number },
  },
  { timestamps: true }
);

export default mongoose.models.QueueWithdrawalExpiry ||
  mongoose.model("QueueWithdrawalExpiry", QueueWithdrawalExpirySchema);


