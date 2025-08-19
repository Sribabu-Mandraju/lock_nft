import { ethers } from 'ethers';
import TimeLockNFTStaking_ABI from '../abis/LockTimeNFT_ABI.json' with { type: 'json' };
import ERC20_ABI from '../abis/ERC20_ABI.json' with { type: 'json' };


const provider = new ethers.JsonRpcProvider('https://base-mainnet.g.alchemy.com/v2/1kKjc1l5XNcYUfnpMkIht');
const TimeLockNFTStaking_contractAddress = '0xC7Ac55fF5C832fDc8572C5F0C6E203BB329Af35B'; // Replace with your deployed contract address

const TimeLockNFTStaking_contract = new ethers.Contract(
  TimeLockNFTStaking_contractAddress,
  TimeLockNFTStaking_ABI,
  provider
);
  
export const getStakingPublicData = async (req, res) => {
  try {
    // Fetch ROI rates and contract URI
    const [roi1m, roi2m, roi3m, contractURI] = await Promise.all([
      TimeLockNFTStaking_contract.roi1m(),
      TimeLockNFTStaking_contract.roi2m(),
      TimeLockNFTStaking_contract.roi3m(),
      TimeLockNFTStaking_contract.contractURI(),
    ]);

    // Fetch allowedTokens array
    let allowedTokens = [];
    try {
      // Fetch up to a reasonable limit to avoid infinite loops
      for (let i = 0; i < 100; i++) {
        try {
          const tokenAddress = await TimeLockNFTStaking_contract.allowedTokens(i);
          allowedTokens.push(tokenAddress);
        } catch (error) {
          // Break when index is out of bounds
          break;
        }
      }
    } catch (error) {
      console.warn('Failed to fetch allowedTokens:', error.message);
    }

    // Fetch token names for each allowed token using ERC20 ABI
    const allowedTokensWithNames = await Promise.all(
      allowedTokens.map(async (tokenAddress) => {
        try {
          const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
          const tokenName = await tokenContract.name();
          const decimals = await tokenContract.decimals();
          return {
            address: tokenAddress,
            name: tokenName,
            decimals: decimals.toString(),
          };
        } catch (error) {
          console.warn(`Failed to fetch name for token ${tokenAddress}:`, error.message);
          return {
            address: tokenAddress,
            name: 'Unknown', // Fallback name if fetching fails
          };
        }
      })
    );

    // Fetch depositedTokenBalance for each allowed token
    const depositedBalances = await Promise.all(
      allowedTokens.map(async (tokenAddress) => {
        try {
          const balance = await TimeLockNFTStaking_contract.depositedTokenBalance(tokenAddress);
          const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
          const tokenName = await tokenContract.name();
          return {
            token: tokenAddress,
            name: tokenName,
            balance: balance.toString(),
          };
        } catch (error) {
          console.warn(`Failed to fetch balance or name for token ${tokenAddress}:`, error.message);
          return {
            token: tokenAddress,
            name: 'Unknown',
            balance: '0',
          };
        }
      })
    );

    return res.status(200).json({
      success: true,
      allowedTokens: allowedTokensWithNames,
      roi1m: roi1m.toString(),
      roi2m: roi2m.toString(),
      roi3m: roi3m.toString(),
      contractURI,
      depositedBalances,
    });
  } catch (error) {
    console.error('getStakingPublicData error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};


export const getStakingAdminData = async (req, res) => {
  try {
    // Get the requesting user's address from the request
    const userAddress = req.query.userAddress;

    // Validate userAddress
    if (!userAddress || typeof userAddress !== 'string') {
      return res.status(401).json({
        success: false,
        error: 'Valid user address not provided',
      });
    }

    // Fetch contract owner
    let owner;
    try {
      owner = await TimeLockNFTStaking_contract.owner();
    } catch (error) {
      console.error('Failed to fetch contract owner:', error.message);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch contract owner',
      });
    }

    // Validate owner
    if (!owner || typeof owner !== 'string') {
      return res.status(500).json({
        success: false,
        error: 'Contract owner address is invalid',
      });
    }

    // Restrict access to admin (contract owner)
    if (ethers.getAddress(userAddress) !== ethers.getAddress(owner)) {
      return res.status(403).json({
        success: false,
        error: 'Access restricted to contract owner',
      });
    }

    // Fetch admin metadata
    const [tokenIdCounter] = await Promise.all([
      TimeLockNFTStaking_contract._tokenIdCounter(),
    ]);

    // Fetch allowedTokens array
    let allowedTokens = [];
    try {
      for (let i = 0; i < 100; i++) {
        try {
          const tokenAddress = await TimeLockNFTStaking_contract.allowedTokens(i);
          allowedTokens.push(tokenAddress);
        } catch (error) {
          break;
        }
      }
    } catch (error) {
      console.warn('Failed to fetch allowedTokens:', error.message);
    }


    const allowedTokensWithNames = await Promise.all(
      allowedTokens.map(async (tokenAddress) => {
        try {
          const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
          const tokenName = await tokenContract.name();
          const decimals = await tokenContract.decimals();
          // Fix: Access the public mapping directly - this is how Solidity public mappings work
          const maxCap = await TimeLockNFTStaking_contract.isAllowedToken(tokenAddress);
          return {
            address: tokenAddress,
            name: tokenName,
            decimals: decimals.toString(),
            maxCap: maxCap.toString(),
          };
        } catch (error) {
          console.warn(`Failed to fetch data for token ${tokenAddress}:`, error.message);
          return {
            address: tokenAddress,
            name: 'Unknown',
            decimals: "18",
            maxCap: "0",
          };
        }
      })
    );


    // Fetch depositedTokenBalance for each allowed token
    const depositedBalances = await Promise.all(
      allowedTokens.map(async (tokenAddress) => {
        const balance = await TimeLockNFTStaking_contract.depositedTokenBalance(tokenAddress);
        return {
          token: tokenAddress,
          balance: balance.toString(),
        };
      })
    );

    return res.status(200).json({
      success: true,
      owner,
      totalNFTsMinted: tokenIdCounter.toString(),
      // deposits,
      depositedBalances,
      allowedTokensWithNames,
    });
  } catch (error) {
    console.error('getStakingAdminData error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};


export const getUserDeposits = async (req, res) => {
  try {
    // Get the user's wallet address from the request
    const userWalletAddress = req.query.userWalletAddress;

    // Validate userWalletAddress
    if (!userWalletAddress || !ethers.isAddress(userWalletAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Valid user wallet address not provided',
      });
    }

    // Get the number of NFTs owned by the user
    const balance = await TimeLockNFTStaking_contract.balanceOf(userWalletAddress);
    const depositCount = Number(balance);

    // Fetch deposit details for each NFT
    const deposits = [];
    for (let i = 0; i < depositCount; i++) {
      try {
        // Get tokenId for the user's NFT at index i
        const tokenId = await TimeLockNFTStaking_contract.tokenOfOwnerByIndex(userWalletAddress, i);
        // Get deposit details
        const deposit = await TimeLockNFTStaking_contract.getDeposit(tokenId);
        // Get token metadata from ERC20 contract
        let tokenName = 'Unknown';
        let tokenSymbol = '';
        let decimals = 18;
        try {
          const tokenContract = new ethers.Contract(deposit.depositToken, ERC20_ABI, provider);
          try { tokenName = await tokenContract.name(); } catch {}
          try { tokenSymbol = await tokenContract.symbol(); } catch {}
          try { decimals = Number(await tokenContract.decimals()); } catch {}
        } catch (metaErr) {
          console.warn(`Failed to init ERC20 for ${deposit.depositToken}:`, metaErr.message);
        }

        deposits.push({
          tokenId: tokenId.toString(),
          depositToken: deposit.depositToken,
          tokenName,
          tokenSymbol,
          decimals,
          amount: deposit.amount.toString(),
          startTimestamp: deposit.startTimestamp.toString(),
          periodMonths: deposit.periodMonths.toString(),
          unlockTimestamp: deposit.unlockTimestamp.toString(),
          originalMinter: deposit.originalMinter,
        });
      } catch (error) {
        console.warn(`Failed to fetch deposit at index ${i}:`, error.message);
        continue; // Skip invalid deposits
      }
    }

    return res.status(200).json({
      success: true,
      deposits,
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



export const getTokenMetadata = async (req, res) => {
  try {
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
      await TimeLockNFTStaking_contract.ownerOf(tokenId);
    } catch (error) {
      return res.status(404).json({
        success: false,
        error: `Token with ID ${tokenId} does not exist`,
      });
    }

    // Fetch tokenURI
    const tokenURI = await TimeLockNFTStaking_contract.tokenURI(tokenId);

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