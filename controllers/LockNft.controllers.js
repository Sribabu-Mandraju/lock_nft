import {
  publicClient,
  LockNFT_getContractInstance,
} from "../config/contract.config.js";

const contract = LockNFT_getContractInstance();

/**
 * Fetch deposit details for a given NFT
 * @param tokenId - The NFT token ID to query
 */
export const getDeposit = async (req, res) => {
  try {
    const { tokenId } = req.query;
    if (!Number.isInteger(Number(tokenId)) || Number(tokenId) <= 0) {
      return res.status(400).json({ error: "Invalid token ID" });
    }

    const [
      amount,
      startTs,
      period,
      unlockTs,
      original,
    ] = await publicClient.readContract({
      ...contract,
      functionName: "getDeposit",
      args: [BigInt(tokenId)],
    });

    res.status(200).json({
      amount: amount.toString(),
      startTimestamp: startTs.toString(),
      periodMonths: Number(period),
      unlockTimestamp: unlockTs.toString(),
      originalMinter: original,
    });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch deposit", details: error.message });
  }
};

/**
 * Fetch token URI for a given NFT
 * @param tokenId - The NFT token ID to query
 */
export const getTokenURI = async (req, res) => {
  try {
    const { tokenId } = req.query;
    if (!Number.isInteger(Number(tokenId)) || Number(tokenId) <= 0) {
      return res.status(400).json({ error: "Invalid token ID" });
    }

    const uri = await publicClient.readContract({
      ...contract,
      functionName: "tokenURI",
      args: [BigInt(tokenId)],
    });

    res.status(200).json({ tokenURI: uri });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch token URI", details: error.message });
  }
};

/**
 * Get USDT address from contract
 */
export const getUsdcAddr = async (req, res) => {
  try {
    const address = await publicClient.readContract({
      ...contract,
      functionName: "usdt",
    });
    res.status(200).json({ usdc: address });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get current ROI values for all periods
 */
export const getROIs = async (req, res) => {
  try {
    const [roi3m, roi6m, roi12m] = await Promise.all([
      publicClient.readContract({
        ...contract,
        functionName: "roi3m",
      }),
      publicClient.readContract({
        ...contract,
        functionName: "roi6m",
      }),
      publicClient.readContract({
        ...contract,
        functionName: "roi12m",
      }),
    ]);

    res.status(200).json({
      roi3m: roi3m.toString(),
      roi6m: roi6m.toString(),
      roi12m: roi12m.toString(),
    });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch ROI values", details: error.message });
  }
};

/**
 * Get contract URI
 */
export const getContractURI = async (req, res) => {
  try {
    const uri = await publicClient.readContract({
      ...contract,
      functionName: "contractURI",
    });
    res.status(200).json({ contractURI: uri });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch contract URI", details: error.message });
  }
};

/**
 * Get base URI
 */
export const getBaseURI = async (req, res) => {
  try {
    const uri = await publicClient.readContract({
      ...contract,
      functionName: "_baseURI",
    });
    res.status(200).json({ baseURI: uri });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch base URI", details: error.message });
  }
};

/**
 * Get total supply of NFTs
 */
export const getTotalSupply = async (req, res) => {
  try {
    const totalSupply = await publicClient.readContract({
      ...contract,
      functionName: "totalSupply",
    });
    res.status(200).json({ totalSupply: totalSupply.toString() });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch total supply", details: error.message });
  }
};

/**
 * Get token by index
 * @param index - The index to query
 */
export const getTokenByIndex = async (req, res) => {
  try {
    const { index } = req.query;
    if (!Number.isInteger(Number(index)) || Number(index) < 0) {
      return res.status(400).json({ error: "Invalid index" });
    }

    const tokenId = await publicClient.readContract({
      ...contract,
      functionName: "tokenByIndex",
      args: [BigInt(index)],
    });

    res.status(200).json({ tokenId: tokenId.toString() });
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch token by index",
      details: error.message,
    });
  }
};

/**
 * Get tokens owned by an address
 * @param address - The address to query
 */
export const getTokensOfOwner = async (req, res) => {
  try {
    const { address } = req.query;
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return res.status(400).json({ error: "Invalid address" });
    }

    const balance = await publicClient.readContract({
      ...contract,
      functionName: "balanceOf",
      args: [address],
    });

    const tokens = [];
    for (let i = 0; i < Number(balance); i++) {
      const tokenId = await publicClient.readContract({
        ...contract,
        functionName: "tokenOfOwnerByIndex",
        args: [address, BigInt(i)],
      });
      tokens.push(tokenId.toString());
    }

    res.status(200).json({ tokens });
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch tokens of owner",
      details: error.message,
    });
  }
};

/**
 * Get owner of a token
 * @param tokenId - The token ID to query
 */
export const getTokenOwner = async (req, res) => {
  try {
    const { tokenId } = req.query;
    if (!Number.isInteger(Number(tokenId)) || Number(tokenId) <= 0) {
      return res.status(400).json({ error: "Invalid token ID" });
    }

    const owner = await publicClient.readContract({
      ...contract,
      functionName: "ownerOf",
      args: [BigInt(tokenId)],
    });

    res.status(200).json({ owner });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch token owner", details: error.message });
  }
};

/**
 * Get contract owner
 */
export const getContractOwner = async (req, res) => {
  try {
    const owner = await publicClient.readContract({
      ...contract,
      functionName: "owner",
    });
    res.status(200).json({ owner });
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch contract owner",
      details: error.message,
    });
  }
};

// Placeholder for write functions that should be handled client-side
export const deposit = async (req, res) => {
  res
    .status(400)
    .json({ error: "Deposit must be handled client-side via smart contract." });
};

export const setUSDT = async (req, res) => {
  res
    .status(400)
    .json({ error: "setUSDT must be handled via secure admin script." });
};

export const setROIs = async (req, res) => {
  res
    .status(400)
    .json({ error: "setROIs must be handled via secure admin script." });
};

export const redeem = async (req, res) => {
  res
    .status(400)
    .json({ error: "Redeem must be handled client-side via smart contract." });
};

export const collectFees = async (req, res) => {
  res
    .status(400)
    .json({ error: "collectFees must be handled via secure admin script." });
};

export const connectWallet = async (req, res) => {
  res
    .status(400)
    .json({ error: "Wallet connection must be handled client-side." });
};

/**
 * Get all owned NFTs with their details for a given address
 * @param address - The address to query
 */
export const getAllOwnedNFTs = async (req, res) => {
  try {
    const { address } = req.query;
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return res.status(400).json({ error: "Invalid address" });
    }

    // Get total balance of NFTs owned by the address
    const balance = await publicClient.readContract({
      ...contract,
      functionName: "balanceOf",
      args: [address],
    });

    const nfts = [];

    // Iterate through all owned tokens
    for (let i = 0; i < Number(balance); i++) {
      // Get token ID at index i
      const tokenId = await publicClient.readContract({
        ...contract,
        functionName: "tokenOfOwnerByIndex",
        args: [address, BigInt(i)],
      });

      // Get deposit details for this token
      const [
        amount,
        startTs,
        period,
        unlockTs,
        original,
      ] = await publicClient.readContract({
        ...contract,
        functionName: "getDeposit",
        args: [tokenId],
      });

      // Get token URI
      const tokenURI = await publicClient.readContract({
        ...contract,
        functionName: "tokenURI",
        args: [tokenId],
      });

      nfts.push({
        tokenId: tokenId.toString(),
        deposit: {
          amount: amount.toString(),
          startTimestamp: startTs.toString(),
          periodMonths: Number(period),
          unlockTimestamp: unlockTs.toString(),
          originalMinter: original,
        },
        tokenURI,
        isLocked: BigInt(unlockTs) > BigInt(Math.floor(Date.now() / 1000)),
        timeRemaining:
          BigInt(unlockTs) > BigInt(Math.floor(Date.now() / 1000))
            ? (
                BigInt(unlockTs) - BigInt(Math.floor(Date.now() / 1000))
              ).toString()
            : "0",
      });
    }

    res.status(200).json({
      totalNFTs: Number(balance),
      nfts,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch owned NFTs",
      details: error.message,
    });
  }
};
