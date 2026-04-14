import QueueWithdrawalExpiry from "../models/QueueWithdrawalExpiry.js";
import Deposit from "../models/Deposit.js";
import ethersPkg from "ethers";
const { ethers } = ethersPkg;
import TimeLockNFTStaking_ABI from "../abis/Halal_Cash_ABI.json" with {
  type: "json",
};

const normalizePool = (pool) => {
  if (!pool) return null;
  const p = String(pool).trim().toLowerCase();
  if (p === "usdt" || p === "usdc" || p === "usdt-nolockup") return p;
  return null;
};

// --- HTTP RPC provider for verifying transactions ---
// Prefer env override; fallback keeps same key as ALCHEMY_WS_URL in index.js
const ETH_MAINNET_RPC_URL =
  process.env.ETH_MAINNET_RPC_URL ||
  "https://eth-mainnet.g.alchemy.com/v2/geIrP8FKOhyxLglmOQLfF";

const rpcProvider = new ethers.providers.JsonRpcProvider(ETH_MAINNET_RPC_URL);

// Pool contract addresses (must stay in sync with index.js + frontend)
const USDT_MARKET_ADDRESS =
  "0x02e0415e828a5f97309f93f001885b5db8a87d71".toLowerCase();
const USDC_MARKET_ADDRESS =
  "0x0886dc1d5db7288e2818a80c308de8eb2f13790c".toLowerCase();
const USDT_LOCKUP_MARKET_ADDRESS =
  "0x8c06d86596d671798a67e80dc44a281c8d822fd3".toLowerCase();

const MARKET_ADDRESS_TO_POOL = {
  [USDT_MARKET_ADDRESS]: "usdt",
  [USDC_MARKET_ADDRESS]: "usdc",
  [USDT_LOCKUP_MARKET_ADDRESS]: "usdt-nolockup",
};

const iface = new ethers.utils.Interface(TimeLockNFTStaking_ABI);

const DAYS_30_SECONDS = 30 * 24 * 60 * 60;

export const getUserDepositsByPool = async (req, res) => {
  try {
    const account = req.query?.account;
    if (!account || !ethers.utils.isAddress(account)) {
      return res.status(400).json({
        success: false,
        error: "Valid account is required",
      });
    }

    const docs = await Deposit.find({
      user: new RegExp(`^${String(account).trim()}$`, "i"),
    })
      .sort({ createdAt: -1 })
      .lean();

    const deposits = docs.map((deposit) => {
      const depositedAtNum = Number(deposit.depositedAt || 0);
      const periodMonthsNum = Number(deposit.periodMonths || 0);
      const unlockTimestamp =
        Number.isFinite(depositedAtNum) && Number.isFinite(periodMonthsNum)
          ? String(depositedAtNum + periodMonthsNum * DAYS_30_SECONDS)
          : "";

      return {
        tokenId: deposit.tokenId,
        depositToken: deposit.token,
        tokenName: deposit.token,
        amount: deposit.amount,
        startTimestamp: deposit.depositedAt,
        periodMonths: String(deposit.periodMonths ?? ""),
        unlockTimestamp,
        originalMinter: deposit.user,
        txHash: deposit.txHash,
        blockNumber: deposit.blockNumber,
        createdAt: deposit.createdAt,
        updatedAt: deposit.updatedAt,
      };
    });

    return res.status(200).json({
      success: true,
      deposits,
      depositCount: deposits.length,
    });
  } catch (err) {
    console.error("getUserDepositsByPool error:", err);
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};

export const getWithdrawalQueuesByPool = async (req, res) => {
  try {
    // Accept only query parameters
    const pool = normalizePool(req.query?.pool);
    if (!pool) {
      return res.status(400).json({
        error: "Invalid or missing pool. Use 'usdt', 'usdc', or 'usdt-nolockup'",
      });
    }

    const accountParam = req.query?.account;
    const filter = { market_pool: pool };

    if (accountParam) {
      // case-insensitive exact match for account
      filter.account = new RegExp(`^${String(accountParam).trim()}$`, "i");
    }

    const docs = await QueueWithdrawalExpiry.find(filter)
      .sort({ expiry: 1, blockNumber: -1, createdAt: -1 })
      .lean();

    return res.status(200).json({ count: docs.length, items: docs });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

export const getUsdtWithdrawalQueues = async (req, res) => {
  req.query = { ...(req.query || {}), pool: "usdt" };
  return getWithdrawalQueuesByPool(req, res);
};

export const getUsdcWithdrawalQueues = async (req, res) => {
  req.query = { ...(req.query || {}), pool: "usdc" };
  return getWithdrawalQueuesByPool(req, res);
};

export const getUsdtNolockupWithdrawalQueues = async (req, res) => {
  req.query = { ...(req.query || {}), pool: "usdt-nolockup" };
  return getWithdrawalQueuesByPool(req, res);
};

// Record a withdrawal-related transaction (queue or execute) by tx hash.
// This is an alternative/backup to WebSocket listeners and is idempotent.
export const recordWithdrawalTx = async (req, res) => {
  try {
    const { txHash } = req.body || {};

    if (
      !txHash ||
      typeof txHash !== "string" ||
      !/^0x([A-Fa-f0-9]{64})$/.test(txHash.trim())
    ) {
      return res
        .status(400)
        .json({ success: false, error: "Valid txHash is required" });
    }

    const normalizedHash = txHash.trim();

    // Check if transaction is mined
    const receipt = await rpcProvider.getTransactionReceipt(normalizedHash);

    if (!receipt) {
      return res.status(409).json({
        success: false,
        error: "Transaction not yet mined; please retry shortly",
      });
    }

    if (receipt.status !== 1) {
      return res.status(400).json({
        success: false,
        error: "Transaction failed on-chain (status != 1)",
      });
    }

    const updates = [];

    for (const log of receipt.logs || []) {
      const addr = (log.address || "").toLowerCase();
      const pool = MARKET_ADDRESS_TO_POOL[addr];
      if (!pool) continue;

      let parsed;
      try {
        parsed = iface.parseLog(log);
      } catch {
        continue;
      }

      if (parsed.name === "WithdrawalQueued") {
        const { expiry, account, scaledAmount, normalizedAmount } = parsed.args;

        const key = {
          expiry: expiry?.toString?.() ?? String(expiry),
          account: String(account),
        };

        const update = {
          scaledAmount: scaledAmount?.toString?.() ?? String(scaledAmount),
          normalizedAmount:
            normalizedAmount?.toString?.() ?? String(normalizedAmount),
          market_pool: pool,
          txHash: receipt.transactionHash,
          blockNumber: receipt.blockNumber,
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

        updates.push({
          type: "queued",
          id: saved?.id,
          ...key,
          pool,
        });
      } else if (parsed.name === "WithdrawalExecuted") {
        const { expiry, account } = parsed.args;
        const key = {
          expiry: expiry?.toString?.() ?? String(expiry),
          account: String(account),
        };

        const delRes = await QueueWithdrawalExpiry.deleteOne(key);

        updates.push({
          type: "executed",
          ...key,
          pool,
          deletedCount: delRes?.deletedCount ?? 0,
        });
      }
    }

    if (!updates.length) {
      return res.status(404).json({
        success: false,
        error: "No relevant withdrawal events found in transaction logs",
      });
    }

    return res.status(200).json({
      success: true,
      txHash: normalizedHash,
      updates,
    });
  } catch (err) {
    console.error("recordWithdrawalTx error:", err);
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};

export default {
  getUserDepositsByPool,
  getWithdrawalQueuesByPool,
  getUsdtWithdrawalQueues,
  getUsdcWithdrawalQueues,
  getUsdtNolockupWithdrawalQueues,
  recordWithdrawalTx,
};


