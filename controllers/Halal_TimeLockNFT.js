import ethersPkg from "ethers";
const { ethers } = ethersPkg;
import TimeLockNFTStaking_ABI from '../abis/Halal_Cash_ABI.json' with { type: 'json' };
import ERC20_ABI from '../abis/ERC20_ABI.json' with { type: 'json' };
import Deposit from '../models/Deposit.js';

// Multiple RPC providers for load balancing
const rpcUrls = [
  "https://eth-mainnet.g.alchemy.com/v2/GQXyK5v1cXTXl5Ub0idAE",
"https://mainnet.infura.io/v3/810bf02706b94d81b0c81dc4870cea06",
"https://mainnet.infura.io/v3/dddfeddfe3a94c5a9ccd2fdddd135d9a",
];

// Create providers for load balancing
const providers = rpcUrls.map((url) => new ethers.providers.JsonRpcProvider(url));

// Load balancer function to get a provider
let currentProviderIndex = 0;
const getProvider = () => {
  const provider = providers[currentProviderIndex];
  currentProviderIndex = (currentProviderIndex + 1) % providers.length;
  return provider;
};

// Create contracts for each provider
const TimeLockNFTStaking_contractAddress = '0xf4b4ea96572B0B9411Ba15A81db6d1dEC4199671';
const TimeLockNFTStaking_contracts = providers.map((provider) =>
  new ethers.Contract(
    TimeLockNFTStaking_contractAddress,
    TimeLockNFTStaking_ABI,
    provider
  )
);

// Get contract with load balancing
const getContract = () => {
  const contract = TimeLockNFTStaking_contracts[currentProviderIndex];
  currentProviderIndex = (currentProviderIndex + 1) % TimeLockNFTStaking_contracts.length;
  return contract;
};
  
export const getStakingPublicData_Halal = async (req, res) => {
  try {
    const provider = getProvider();
    const contract = getContract();

    // Verify contract exists at address on this network
    const [network, code] = await Promise.all([
      provider.getNetwork(),
      provider.getCode(TimeLockNFTStaking_contractAddress)
    ]);
    if (!code || code === '0x') {
      return res.status(503).json({
        success: false,
        error: `Contract not found at ${TimeLockNFTStaking_contractAddress} on network ${network?.name ?? 'unknown'} (${network?.chainId ?? 'unknown'})`
      });
    }

    // Fetch ROI rates and contract URI (tolerate individual failures)
    const metaResults = await Promise.allSettled([
      contract.roi_3m(),
      contract.roi_6m(),
      contract.roi_12m(),
      contract.contractURI(),
      contract._tokenIdCounter(),
    ]);

    const [roi1mR, roi2mR, roi3mR, contractURIR, totalMintedR] = metaResults;
    const warnings = [];
    if (roi1mR.status === 'rejected') warnings.push('roi1m failed');
    if (roi2mR.status === 'rejected') warnings.push('roi2m failed');
    if (roi3mR.status === 'rejected') warnings.push('roi3m failed');
    if (contractURIR.status === 'rejected') warnings.push('contractURI failed');
    if (totalMintedR.status === 'rejected') warnings.push('totalMinted failed');

    const roi1m = roi1mR.status === 'fulfilled' ? roi1mR.value : 0n;
    const roi2m = roi2mR.status === 'fulfilled' ? roi2mR.value : 0n;
    const roi3m = roi3mR.status === 'fulfilled' ? roi3mR.value : 0n;
    const contractURI = contractURIR.status === 'fulfilled' ? contractURIR.value : '';
    const totalMinted = totalMintedR.status === 'fulfilled' ? totalMintedR.value : 0n;

    // Fetch allowedTokens array
    let allowedTokens = [];
    try {
      // Fetch up to a reasonable limit to avoid infinite loops
      for (let i = 0; i < 100; i++) {
        try {
          const tokenAddress = await contract.allowedTokens(i);
          allowedTokens.push(tokenAddress);
        } catch (error) {
          // Break when index is out of bounds
          break;
        }
      }
    } catch (error) {
      console.warn('Failed to fetch allowedTokens:', error.message);
    }

    // Optimized: Fetch token metadata and balances in parallel with load balancing
    const tokenDataPromises = allowedTokens.map(async (tokenAddress) => {
      const tokenProvider = getProvider();
      const tokenContract = new ethers.Contract(
        tokenAddress,
        ERC20_ABI,
        tokenProvider
      );
      
      try {
        const [name, decimals, balance, cap] = await Promise.all([
          tokenContract.name().catch(() => 'Unknown'),
          tokenContract.decimals().catch(() => 18),
          contract.depositedTokenBalance(tokenAddress).catch(() => 0n),
          contract.isAllowedToken(tokenAddress).catch(() => 0n)
        ]);
        
        return {
          address: tokenAddress,
          name,
          decimals: decimals.toString(),
          balance: balance.toString(),
          cap: cap.toString(),
        };
      } catch (error) {
        console.warn(`Failed to fetch data for token ${tokenAddress}:`, error.message);
        return {
          address: tokenAddress,
          name: 'Unknown',
          decimals: '18',
          balance: '0',
          cap: '0',
        };
      }
    });

    const tokenData = await Promise.all(tokenDataPromises);

    // Separate the data for response
    const allowedTokensWithNames = tokenData.map(({ address, name, decimals, cap }) => ({
      address,
      name,
      decimals,
      cap
    }));

    const depositedBalances = tokenData.map(({ address, name, balance, cap }) => ({
      token: address,
      name,
      balance,
      cap
    }));

    return res.status(200).json({
      success: true,
      allowedTokens: allowedTokensWithNames,
      roi3m: roi1m.toString(),
      roi6m: roi2m.toString(),
      roi12m: roi3m.toString(),
      contractURI,
      depositedBalances,
      totalMinted: totalMinted.toString(),
      warnings,
    });
  } catch (error) {
    console.error('getStakingPublicData error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};


export const getStakingAdminData_Halal = async (req, res) => {
  try {
    const provider = getProvider();
    const contract = getContract();

    // Verify contract exists at address on this network
    const [network, code] = await Promise.all([
      provider.getNetwork(),
      provider.getCode(TimeLockNFTStaking_contractAddress)
    ]);
    if (!code || code === '0x') {
      return res.status(503).json({
        success: false,
        error: `Contract not found at ${TimeLockNFTStaking_contractAddress} on network ${network?.name ?? 'unknown'} (${network?.chainId ?? 'unknown'})`
      });
    }

    // Fetch ROI rates and contract URI (tolerate individual failures)
    const metaResults = await Promise.allSettled([
      contract.roi_3m(),
      contract.roi_6m(),
      contract.roi_12m(),
      contract.contractURI(),
      contract._tokenIdCounter(),
    ]);

    const [roi1mR, roi2mR, roi3mR, contractURIR, totalMintedR] = metaResults;
    const warnings = [];
    if (roi1mR.status === 'rejected') warnings.push('roi1m failed');
    if (roi2mR.status === 'rejected') warnings.push('roi2m failed');
    if (roi3mR.status === 'rejected') warnings.push('roi3m failed');
    if (contractURIR.status === 'rejected') warnings.push('contractURI failed');
    if (totalMintedR.status === 'rejected') warnings.push('totalMinted failed');

    const roi1m = roi1mR.status === 'fulfilled' ? roi1mR.value : 0n;
    const roi2m = roi2mR.status === 'fulfilled' ? roi2mR.value : 0n;
    const roi3m = roi3mR.status === 'fulfilled' ? roi3mR.value : 0n;
    const contractURI = contractURIR.status === 'fulfilled' ? contractURIR.value : '';
    const totalMinted = totalMintedR.status === 'fulfilled' ? totalMintedR.value : 0n;

    // Fetch allowedTokens array
    let allowedTokens = [];
    try {
      // Fetch up to a reasonable limit to avoid infinite loops
      for (let i = 0; i < 100; i++) {
        try {
          const tokenAddress = await contract.allowedTokens(i);
          allowedTokens.push(tokenAddress);
        } catch (error) {
          // Break when index is out of bounds
          break;
        }
      }
    } catch (error) {
      console.warn('Failed to fetch allowedTokens:', error.message);
    }

    // Optimized: Fetch token metadata and balances in parallel with load balancing
    const tokenDataPromises = allowedTokens.map(async (tokenAddress) => {
      const tokenProvider = getProvider();
      const tokenContract = new ethers.Contract(
        tokenAddress,
        ERC20_ABI,
        tokenProvider
      );
      
      try {
        const [name, decimals,currentBalance, balance, cap] = await Promise.all([
          tokenContract.name().catch(() => 'Unknown'),
          tokenContract.decimals().catch(() => 18),
          tokenContract.balanceOf(TimeLockNFTStaking_contractAddress).catch(() => 0n),  
          contract.depositedTokenBalance(tokenAddress).catch(() => 0n),
          contract.isAllowedToken(tokenAddress).catch(() => 0n)
        ]);
        
        return {
          address: tokenAddress,
          name,
          decimals: decimals.toString(),
          currentBalance:currentBalance.toString(),
          balance: balance.toString(),
          cap: cap.toString(),
        };
      } catch (error) {
        console.warn(`Failed to fetch data for token ${tokenAddress}:`, error.message);
        return {
          address: tokenAddress,
          name: 'Unknown',
          decimals: '18',
          balance: '0',
          cap: '0',
        };
      }
    });

    const tokenData = await Promise.all(tokenDataPromises);

    // Separate the data for response
    const allowedTokensWithNames = tokenData.map(({ address, name, decimals, cap, currentBalance }) => ({
      address,
      name,
      decimals,
      cap,
      currentBalance
    }));

    const depositedBalances = tokenData.map(({ address, name, balance, cap, currentBalance }) => ({
      token: address,
      name,
      balance,
      cap,
      currentBalance
    }));

    return res.status(200).json({
      success: true,
      allowedTokens: allowedTokensWithNames,
      roi3m: roi1m.toString(),
      roi6m: roi2m.toString(),
      roi12m: roi3m.toString(),
      contractURI,
      depositedBalances,
      totalMinted: totalMinted.toString(),
      warnings,
    });
  } catch (error) {
    console.error('getStakingAdminData error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};


export const getUserDeposits_Halal = async (req, res) => {
  try {
    // Get the user's wallet address from the request
    const userWalletAddress = req.query.userWalletAddress;

    // Validate userWalletAddress
    if (!userWalletAddress || !ethers.utils.isAddress(userWalletAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Valid user wallet address not provided',
      });
    }

    // Fetch deposits from MongoDB for this user
    const deposits = await Deposit.find({ user: userWalletAddress });
    const depositCount = deposits.length;

    // Format the response to match the expected structure
    const formattedDeposits = deposits.map(deposit => ({
      tokenId: deposit.tokenId,
      depositToken: deposit.token,
      tokenName: deposit.token, // You might want to add token name to the schema or fetch it separately
      amount: deposit.amount,
      startTimestamp: deposit.depositedAt,
      periodMonths: deposit.periodMonths.toString(),
      unlockTimestamp: (parseInt(deposit.depositedAt) + (deposit.periodMonths * 30 * 24 * 60 * 60)).toString(), // Calculate unlock timestamp
      originalMinter: deposit.user,
      txHash: deposit.txHash,
      blockNumber: deposit.blockNumber,
      createdAt: deposit.createdAt,
      updatedAt: deposit.updatedAt,
    }));

    return res.status(200).json({
      success: true,
      deposits: formattedDeposits,
      depositCount,
    });
  } catch (error) {
    console.error('getUserDeposits error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Get ALL deposits across the collection (not a specific user)
// Reverse order (latest tokenId first), paginated, skip missing deposits without error
export const getAllDeposits_Halal = async (req, res) => {
  try {
    const { page = '1', limit = '20' } = req.query;

    const pageNum = Math.max(parseInt(page), 1);
    const limitNum = Math.min(Math.max(parseInt(limit), 1), 100);

    // Count total deposits to determine pagination and latest tokenId
    const totalCount = await Deposit.countDocuments({});
    if (!totalCount) {
      return res.status(200).json({
        success: true,
        deposits: [],
        pagination: {
          currentPage: pageNum,
          limit: limitNum,
          hasNextPage: false,
          latestTokenId: '0',
        }
      });
    }

    // Use aggregation to sort by numeric tokenId (stored as string) and paginate
    const pipeline = [
      { $addFields: { numericTokenId: { $toInt: "$tokenId" } } },
      { $sort: { numericTokenId: -1 } },
      { $skip: (pageNum - 1) * limitNum },
      { $limit: limitNum },
    ];

    const pageDocs = await Deposit.aggregate(pipeline);

    // Determine latestTokenId (max numeric token id in collection)
    const latestDoc = await Deposit.aggregate([
      { $addFields: { numericTokenId: { $toInt: "$tokenId" } } },
      { $sort: { numericTokenId: -1 } },
      { $limit: 1 },
      { $project: { _id: 0, tokenId: 1 } },
    ]);
    const latestTokenId = latestDoc?.[0]?.tokenId ?? '0';

    // Build token metadata cache and fetch names/symbols/decimals lazily
    const tokenMetaCache = new Map();
    const deposits = [];

    for (const d of pageDocs) {
      const tokenAddr = String(d.token).toLowerCase();
      let meta = tokenMetaCache.get(tokenAddr);
      if (!meta) {
        meta = { name: 'Unknown', symbol: '', decimals: 18 };
        try {
          const tokenProvider = getProvider();
          const tokenContract = new ethers.Contract(
            d.token,
            ERC20_ABI,
            tokenProvider
          );
          const [name, symbol] = await Promise.all([
            tokenContract.name().catch(() => 'Unknown'),
            tokenContract.symbol().catch(() => ''),
          ]);
          let decimals = 18;
          try { decimals = Number(await tokenContract.decimals()); } catch {}
          meta = { name, symbol, decimals };
        } catch {}
        tokenMetaCache.set(tokenAddr, meta);
      }

      const startTs = d.depositedAt ? d.depositedAt.toString() : '';
      const months = Number(d.periodMonths) || 0;
      const unlockTs = startTs ? (parseInt(startTs) + months * 30 * 24 * 60 * 60).toString() : '';

      deposits.push({
        tokenId: d.tokenId,
        depositToken: d.token,
        tokenName: meta.name,
        tokenSymbol: meta.symbol,
        decimals: meta.decimals,
        amount: d.amount,
        startTimestamp: startTs,
        periodMonths: months.toString(),
        unlockTimestamp: unlockTs,
        originalMinter: d.user,
      });
    }

    const hasNextPage = pageNum * limitNum < totalCount;

    return res.status(200).json({
      success: true,
      deposits,
      pagination: {
        currentPage: pageNum,
        limit: limitNum,
        hasNextPage,
        latestTokenId,
      }
    });
  } catch (error) {
    console.error('getAllDeposits error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

export const getTokenMetadata_Halal = async (req, res) => {
  try {
    const contract = getContract();
    
    // Get the tokenId from the request query
    const tokenId = req.query.tokenId;

    // Validate tokenId
    if (!tokenId || isNaN(tokenId) || parseInt(tokenId) <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid tokenId is required',
      });
    }

    // Check if token exists by attempting to fetch its owner
    try {
      await contract.ownerOf(tokenId);
    } catch (error) {
      return res.status(404).json({
        success: false,
        error: `Token with ID ${tokenId} does not exist`,
      });
    }

    // Fetch tokenURI
    const tokenURI = await contract.tokenURI(tokenId);

    // Parse metadata if tokenURI is a data URI
    let metadata = {};
    if (tokenURI.startsWith('data:application/json;base64,')) {
      const base64Data = tokenURI.replace('data:application/json;base64,', '');
      const decodedData = Buffer.from(base64Data, 'base64').toString('utf-8');
      metadata = JSON.parse(decodedData);
    } else {
      // If tokenURI is an external URL, you can optionally fetch it or return it as-is
      metadata = { externalURI: tokenURI };
    }

    return res.status(200).json({
      success: true,
      tokenId,
      metadata,
    });
  } catch (error) {
    console.error('getTokenMetadata error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};  