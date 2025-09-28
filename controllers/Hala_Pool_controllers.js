import QueueWithdrawalExpiry from "../models/QueueWithdrawalExpiry.js";

const normalizePool = (pool) => {
  if (!pool) return null;
  const p = String(pool).trim().toLowerCase();
  if (p === "usdt" || p === "usdc" || p === "usdt-lockup") return p;
  return null;
};

export const getWithdrawalQueuesByPool = async (req, res) => {
  try {
    // Accept only query parameters
    const pool = normalizePool(req.query?.pool);
    if (!pool) {
      return res.status(400).json({ error: "Invalid or missing pool. Use 'usdt', 'usdc', or 'usdt-lockup'" });
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

export const getUsdtLockupWithdrawalQueues = async (req, res) => {
  req.query = { ...(req.query || {}), pool: "usdt-lockup" };
  return getWithdrawalQueuesByPool(req, res);
};

export default {
  getWithdrawalQueuesByPool,
  getUsdtWithdrawalQueues,
  getUsdcWithdrawalQueues,
  getUsdtLockupWithdrawalQueues,
};


