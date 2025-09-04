import mongoose from "mongoose";

const DepositSchema = new mongoose.Schema(
  {
    user: { type: String, index: true, required: true },
    tokenId: { type: String, index: true, unique: true, required: true },
    token: { type: String, required: true },
    amount: { type: String, required: true },
    periodMonths: { type: Number, required: true },
    depositedAt: { type: String },
    txHash: { type: String },
    blockNumber: { type: Number },
  },
  { timestamps: true }
);

export default mongoose.models.Deposit ||
  mongoose.model("Deposit", DepositSchema);
