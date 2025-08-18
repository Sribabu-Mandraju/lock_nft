import { ethers } from 'ethers';
import TimeLockNFTStaking_ABI from '../abis/LockTimeNFT_ABI.json' with { type: 'json' };
import UserDeposits from '../models/userDepositsModel.js';

// Global error handler for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't crash the process, just log the error
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Don't crash the process, just log the error
});

// Rate limiting for consecutive API calls
const apiCallTimestamps = new Map();
const MIN_CALL_INTERVAL = 3000; // 3 seconds minimum between calls

// Helper function to check and enforce rate limiting
const checkRateLimit = (proposalId) => {
  const now = Date.now();
  const lastCall = apiCallTimestamps.get(proposalId);
  
  if (lastCall && (now - lastCall) < MIN_CALL_INTERVAL) {
    const waitTime = MIN_CALL_INTERVAL - (now - lastCall);
    throw new Error(`Rate limit exceeded. Please wait ${Math.ceil(waitTime / 1000)} seconds before trying again.`);
  }
  
  apiCallTimestamps.set(proposalId, now);
  
  // Clean up old entries to prevent memory leaks
  setTimeout(() => {
    if (apiCallTimestamps.has(proposalId)) {
      apiCallTimestamps.delete(proposalId);
    }
  }, MIN_CALL_INTERVAL * 2);
  
  return true;
};

// Helper function to safely convert large numbers to strings
const safeToString = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'number') {
    // Check if number is too large for safe handling
    if (value > Number.MAX_SAFE_INTEGER || value < Number.MIN_SAFE_INTEGER) {
      return value.toString();
    }
    return value.toString();
  }
  return String(value);
};

// Helper function to create a fresh contract instance for each call
const createContractInstance = async () => {
  try {
    console.log('Creating fresh contract instance...');
    const provider = new ethers.JsonRpcProvider('https://base-sepolia.g.alchemy.com/v2/GQXyK5v1cXTXl5Ub0idAE');
    const contractAddress = '0x27f3e17C1007Cbd7961042Aaea756A2c12726593';
    
    // Test provider connection first
    try {
      const network = await provider.getNetwork();
      console.log(`Provider connected to network: ${network.name} (Chain ID: ${network.chainId})`);
    } catch (providerError) {
      console.error('Provider connection test failed:', providerError);
      throw new Error(`Provider connection failed: ${providerError.message}`);
    }
    
    const contract = new ethers.Contract(
      contractAddress,
      TimeLockNFTStaking_ABI,
      provider
    );
    
    console.log('Contract instance created successfully');
    return contract;
  } catch (error) {
    console.error('Failed to create contract instance:', error);
    throw error;
  }
};

// Helper function to retry contract calls with exponential backoff
const retryContractCall = async (contractCall, maxRetries = 3, baseDelay = 1000) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await contractCall();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Don't retry on certain error types
      if (error.reason === 'No deposit' || error.code === 'INVALID_ARGUMENT') {
        throw error;
      }
      
      // Wait before retrying with exponential backoff
      const delay = baseDelay * Math.pow(2, attempt - 1);
      console.log(`Contract call failed, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

// Helper function to get token information (decimals, name, symbol)
const getTokenInfo = async (tokenAddress, provider) => {
  if (!tokenAddress || tokenAddress === '0x0000000000000000000000000000000000000000') {
    return { decimals: 18, name: 'Unknown', symbol: 'Unknown' };
  }
  
  try {
    // Basic ERC20 ABI for essential functions
    const erc20Abi = [
      "function decimals() view returns (uint8)",
      "function name() view returns (string)",
      "function symbol() view returns (string)"
    ];
    
    const tokenContract = new ethers.Contract(
      tokenAddress,
      erc20Abi,
      provider
    );
    
    const [decimals, name, symbol] = await Promise.all([
      tokenContract.decimals(),
      tokenContract.name().catch(() => 'Unknown'),
      tokenContract.symbol().catch(() => 'Unknown')
    ]);
    
    console.log(`Token ${tokenAddress}: ${name} (${symbol}) - ${decimals} decimals`);
    
    return { decimals, name, symbol };
  } catch (error) {
    console.warn(`Failed to fetch token info for ${tokenAddress}, using defaults:`, error.message);
    return { decimals: 18, name: 'Unknown', symbol: 'Unknown' };
  }
};

// Helper function to wait for blockchain state to settle
const waitForBlockchainState = async (provider, delayMs = 2000) => {
  console.log(`Waiting ${delayMs}ms for blockchain state to settle...`);
  await new Promise(resolve => setTimeout(resolve, delayMs));
  
  // Get current block to ensure we're working with latest state
  try {
    const currentBlock = await provider.getBlockNumber();
    console.log(`Current block number: ${currentBlock}`);
  } catch (error) {
    console.warn('Failed to get current block number:', error.message);
  }
};

// Test contract connection function
export const testContractConnection = async (req, res) => {
  try {
    console.log('Testing contract connection...');
    
    const TimeLockNFTStaking_contract = await createContractInstance();
    
    // Test basic contract functions
    const contractAddress = await TimeLockNFTStaking_contract.getAddress();
    console.log('Contract address:', contractAddress);
    
    // Test a simple view function if available
    let testResult = 'Connection successful';
    try {
      // Try to get the contract's name or any simple view function
      if (TimeLockNFTStaking_contract.interface.hasFunction('name')) {
        const name = await TimeLockNFTStaking_contract.name();
        testResult = `Contract name: ${name}`;
      }
    } catch (viewError) {
      console.log('View function test failed (this is normal):', viewError.message);
    }
    
    return res.status(200).json({
      success: true,
      message: 'Contract connection test successful',
      contractAddress: contractAddress,
      testResult: testResult,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Contract connection test failed:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

// Health check function to monitor contract connectivity
export const healthCheck = async (req, res) => {
  try {
    const TimeLockNFTStaking_contract = await createContractInstance();
    const network = await TimeLockNFTStaking_contract.provider.getNetwork();
    
    // Check contract connection by calling a simple view function
    let contractHealthy = false;
    try {
      // Try to get the contract address to verify it's accessible
      const contractAddress = await TimeLockNFTStaking_contract.getAddress();
      contractHealthy = contractAddress.toLowerCase() === '0x27f3e17C1007Cbd7961042Aaea756A2c12726593'.toLowerCase();
    } catch (error) {
      console.error('Contract health check failed:', error);
    }
    
    return res.status(200).json({
      success: true,
      status: 'healthy',
      provider: {
        connected: true,
        network: network.name,
        chainId: network.chainId
      },
      contract: {
        healthy: contractHealthy,
        address: '0x27f3e17C1007Cbd7961042Aaea756A2c12726593'
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Health check error:', error);
    return res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

// Create a new deposit record
export const createDeposit = async (req, res) => {
  try {
    const { proposalId, transactionHash } = req.body;

    // Validate required fields
    if (!proposalId || !transactionHash) {
      return res.status(400).json({
        success: false,
        error: 'proposalId and transactionHash are required'
      });
    }

    // Validate proposalId is a positive number
    if (isNaN(proposalId) || parseInt(proposalId) <= 0) {
      return res.status(400).json({
        success: false,
        error: 'proposalId must be a positive number'
      });
    }

    // Check rate limiting for consecutive calls
    try {
      checkRateLimit(proposalId);
    } catch (rateLimitError) {
      return res.status(429).json({
        success: false,
        error: rateLimitError.message,
        retryAfter: MIN_CALL_INTERVAL / 1000
      });
    }

    // Check if deposit already exists
    const existingDeposit = await UserDeposits.findOne({ 
      $or: [
        { tokenId: proposalId.toString() },
        { transactionHash }
      ]
    });

    if (existingDeposit) {
      return res.status(409).json({
        success: false,
        error: 'Deposit already exists with this proposalId or transactionHash',
        existingDeposit: {
          tokenId: existingDeposit.tokenId,
          transactionHash: existingDeposit.transactionHash,
          address: existingDeposit.address
        }
      });
    }

    // Fetch deposit data from smart contract with better error handling
    let depositData;
    let TimeLockNFTStaking_contract; // Declare at function scope
    
    try {
      console.log(`Fetching deposit data for proposalId: ${proposalId}`);
      
      // Create fresh contract instance for this call
      TimeLockNFTStaking_contract = await createContractInstance();
      
      // Wait for blockchain state to settle before making the call
      await waitForBlockchainState(TimeLockNFTStaking_contract.provider);
      
      // Use retry mechanism with state validation for contract calls
      depositData = await retryContractCall(async () => {
        // Check if deposit exists before calling getDeposit
        try {
          const result = await TimeLockNFTStaking_contract.getDeposit(proposalId);
          console.log(`Successfully fetched deposit data for proposalId: ${proposalId}`);
          return result;
        } catch (error) {
          if (error.reason === 'No deposit') {
            console.log(`Deposit not found for proposalId: ${proposalId}, waiting for state to settle...`);
            // Wait a bit more for state to settle
            await waitForBlockchainState(TimeLockNFTStaking_contract.provider, 3000);
            // Try one more time
            return await TimeLockNFTStaking_contract.getDeposit(proposalId);
          }
          throw error;
        }
      }, 5, 1000); // Increased retries and delay
      
      console.log(`Final deposit data for proposalId: ${proposalId}:`, depositData);
    } catch (error) {
      console.error('Contract getDeposit error:', error);
      
      // Provide more specific error messages based on error type
      if (error.code === 'INVALID_ARGUMENT') {
        return res.status(400).json({
          success: false,
          error: `Invalid proposalId: ${proposalId}. Please provide a valid positive number.`
        });
      } else if (error.reason === 'No deposit' || error.message?.includes('No deposit')) {
        return res.status(404).json({
          success: false,
          error: `No deposit found for proposalId ${proposalId} on the blockchain. This proposal may not exist or may have been removed. Please wait a few seconds and try again.`
        });
      } else if (error.code === 'CALL_EXCEPTION') {
        return res.status(500).json({
          success: false,
          error: `Smart contract call failed: ${error.reason || error.message}. This may indicate a contract state issue.`
        });
      } else if (error.message?.includes('Provider connection failed')) {
        return res.status(500).json({
          success: false,
          error: `Blockchain connection failed: ${error.message}. Please try again later.`
        });
      } else {
        return res.status(500).json({
          success: false,
          error: `Contract error: ${error.message || 'Unknown contract error'}`
        });
      }
    }

    // Validate that we received the expected data structure
    if (!depositData || !depositData.depositToken || !depositData.amount) {
      console.error('Invalid deposit data structure:', depositData);
      return res.status(500).json({
        success: false,
        error: 'Invalid deposit data received from smart contract'
      });
    }

    // Extract data from contract response and handle BigInt values
    const {
      depositToken,
      amount,
      startTimestamp,
      periodMonths,
      unlockTimestamp,
      originalMinter
    } = depositData;

    // Validate extracted data
    if (!depositToken || !amount || !startTimestamp || !periodMonths || !unlockTimestamp || !originalMinter) {
      console.error('Missing required deposit data fields:', {
        depositToken: !!depositToken,
        amount: !!amount,
        startTimestamp: !!startTimestamp,
        periodMonths: !!periodMonths,
        unlockTimestamp: !!unlockTimestamp,
        originalMinter: !!originalMinter
      });
      return res.status(500).json({
        success: false,
        error: 'Missing required deposit data fields from smart contract'
      });
    }

    // Fetch token information using helper function
    let tokenDecimals = 18; // Default fallback
    
    if (TimeLockNFTStaking_contract && TimeLockNFTStaking_contract.provider) {
      try {
        const tokenInfo = await getTokenInfo(depositToken, TimeLockNFTStaking_contract.provider);
        tokenDecimals = tokenInfo.decimals;
        
        console.log(`Fetched token info for ${depositToken}:`, {
          decimals: tokenDecimals,
          name: tokenInfo.name,
          symbol: tokenInfo.symbol
        });
      } catch (tokenError) {
        console.warn(`Failed to fetch token info, using default decimals:`, tokenError.message);
        tokenDecimals = 18;
      }
    } else {
      console.warn('Contract instance not available, using default decimals');
    }

    // Create new deposit record with safe string conversion for large numbers
    const newDeposit = new UserDeposits({
      address: originalMinter, // Using originalMinter as address
      depositToken: depositToken,
      decimals: tokenDecimals,
      amount: safeToString(amount), // Safe conversion for large numbers
      startTimestamp: safeToString(startTimestamp), // Safe conversion for large numbers
      periodMonths: Number(periodMonths), // Convert to Number for uint8
      unlockTimestamp: safeToString(unlockTimestamp), // Safe conversion for large numbers
      originalMinter: originalMinter,
      isClaimed: false,
      transactionHash: transactionHash,
      tokenId: safeToString(proposalId)
    });

    console.log('Created deposit record with decimals:', {
      tokenId: newDeposit.tokenId,
      depositToken: newDeposit.depositToken,
      decimals: newDeposit.decimals,
      amount: newDeposit.amount,
      formattedAmount: newDeposit.getFormattedAmount ? newDeposit.getFormattedAmount() : 'N/A'
    });

    // Save to database
    const savedDeposit = await newDeposit.save();
    console.log('Deposit saved successfully to database:', savedDeposit._id);

    return res.status(201).json({
      success: true,
      message: 'Deposit created successfully',
      deposit: savedDeposit
    });

  } catch (error) {
    console.error('createDeposit error:', error);
    
    // Handle database-specific errors
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        error: 'Duplicate key error - deposit may already exist'
      });
    }
    
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
};

// Get deposits with enhanced filtering and deadline ordering
export const getDeposits = async (req, res) => {
  try {
    const {
      proposalId,
      transactionHash,
      address,
      depositToken,
      originalMinter,
      isClaimed,
      periodMonths,
      startTimestamp,
      unlockTimestamp,
      amount,
      // New filtering parameters
      status, // 'all', 'locked', 'unlocked', 'unclaimed_unlocked'
      dateRange, // 'today', 'week', 'month', 'custom'
      fromDate, // Custom start date (timestamp or ISO string)
      toDate,   // Custom end date (timestamp or ISO string)
      minAmount, // Minimum amount filter
      maxAmount, // Maximum amount filter
      limit = 50,
      page = 1
    } = req.query;

    // Build filter object based on provided parameters
    const filter = {};

    if (proposalId) filter.tokenId = proposalId.toString();
    if (transactionHash) filter.transactionHash = transactionHash;
    if (address) filter.address = address.toLowerCase();
    if (depositToken) filter.depositToken = depositToken.toLowerCase();
    if (originalMinter) filter.originalMinter = originalMinter.toLowerCase();
    if (isClaimed !== undefined) filter.isClaimed = isClaimed === 'true';
    if (periodMonths) filter.periodMonths = parseInt(periodMonths);
    if (startTimestamp) filter.startTimestamp = startTimestamp;
    if (unlockTimestamp) filter.unlockTimestamp = unlockTimestamp;
    if (amount) filter.amount = amount;

    // New enhanced filters
    const currentTimestamp = Math.floor(Date.now() / 1000);

    // Status-based filtering
    if (status) {
      switch (status) {
        case 'locked':
          filter.unlockTimestamp = { $gt: currentTimestamp.toString() };
          break;
        case 'unlocked':
          filter.unlockTimestamp = { $lte: currentTimestamp.toString() };
          break;
        case 'unclaimed_unlocked':
          filter.unlockTimestamp = { $lte: currentTimestamp.toString() };
          filter.isClaimed = false;
          break;
        case 'claimed':
          filter.isClaimed = true;
          break;
        case 'pending_claim':
          filter.isClaimed = false;
          break;
      }
    }

    // Date range filtering
    if (dateRange) {
      const now = new Date();
      let startDate, endDate;

      switch (dateRange) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          endDate = now;
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
          endDate = now;
          break;
        case 'custom':
          if (fromDate) {
            startDate = new Date(fromDate);
            filter.startTimestamp = { $gte: Math.floor(startDate.getTime() / 1000).toString() };
          }
          if (toDate) {
            endDate = new Date(toDate);
            filter.startTimestamp = { 
              ...filter.startTimestamp, 
              $lte: Math.floor(endDate.getTime() / 1000).toString() 
            };
          }
          break;
      }

      // Apply date range to startTimestamp if not custom
      if (dateRange !== 'custom' && startDate && endDate) {
        filter.startTimestamp = {
          $gte: Math.floor(startDate.getTime() / 1000).toString(),
          $lt: Math.floor(endDate.getTime() / 1000).toString()
        };
      }
    }

    // Amount range filtering
    if (minAmount || maxAmount) {
      filter.amount = {};
      if (minAmount) filter.amount.$gte = minAmount;
      if (maxAmount) filter.amount.$lte = maxAmount;
    }

    // Calculate skip for pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Enhanced aggregation pipeline with proper field references
    const pipeline = [
      { $match: filter },
      {
        $addFields: {
          // Calculate time until deadline
          timeUntilDeadline: {
            $cond: {
              if: { $gte: [{ $toLong: "$unlockTimestamp" }, currentTimestamp] },
              then: { $subtract: [{ $toLong: "$unlockTimestamp" }, currentTimestamp] },
              else: { $subtract: [{ $toLong: "$unlockTimestamp" }, currentTimestamp] }
            }
          },
          // Add status field for easier frontend handling
          status: {
            $cond: {
              if: { $gte: [{ $toLong: "$unlockTimestamp" }, currentTimestamp] },
              then: "locked",
              else: {
                $cond: {
                  if: "$isClaimed",
                  then: "claimed",
                  else: "unclaimed_unlocked"
                }
              }
            }
          },
          // Calculate days since deposit
          daysSinceDeposit: {
            $floor: {
              $divide: [
                { $subtract: [currentTimestamp, { $toLong: "$startTimestamp" }] },
                86400 // seconds in a day
              ]
            }
          }
        }
      },
      {
        $sort: {
          // Sort by unlockTimestamp (earliest first) - fixed field reference
          unlockTimestamp: 1
        }
      },
      {
        $project: {
          timeUntilDeadline: 0
          // Removed invalid unlockTimestampStr reference
        }
      },
      { $skip: skip },
      { $limit: parseInt(limit) }
    ];

    // Execute aggregation with error handling
    let deposits;
    try {
      deposits = await UserDeposits.aggregate(pipeline);
    } catch (aggregationError) {
      console.error('Aggregation error:', aggregationError);
      return res.status(500).json({
        success: false,
        error: 'Failed to process deposits query',
        details: aggregationError.message
      });
    }

    // Get total count for pagination
    let totalCount;
    try {
      totalCount = await UserDeposits.countDocuments(filter);
    } catch (countError) {
      console.error('Count error:', countError);
      totalCount = 0;
    }

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    return res.status(200).json({
      success: true,
      deposits,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount,
        hasNextPage,
        hasPrevPage,
        limit: parseInt(limit)
      },
      filters: {
        applied: filter,
        status: status || 'all',
        dateRange: dateRange || 'all'
      }
    });

  } catch (error) {
    console.error('getDeposits error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Get a single deposit by proposalId
export const getDepositById = async (req, res) => {
  try {
    const { proposalId } = req.params;

    if (!proposalId || isNaN(proposalId) || parseInt(proposalId) <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid proposalId is required'
      });
    }

    const TimeLockNFTStaking_contract = createContractInstance();
    const deposit = await UserDeposits.findOne({ tokenId: proposalId.toString() });

    if (!deposit) {
      return res.status(404).json({
        success: false,
        error: `Deposit with proposalId ${proposalId} not found`
      });
    }

    return res.status(200).json({
      success: true,
      deposit
    });

  } catch (error) {
    console.error('getDepositById error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Get deposits by user address
export const getDepositsByUser = async (req, res) => {
  try {
    const { userAddress } = req.params;
    const { limit = 50, page = 1 } = req.query;

    if (!userAddress || !ethers.isAddress(userAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Valid user address is required'
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const pipeline = [
      { 
        $match: { 
          originalMinter: userAddress.toLowerCase() 
        } 
      },
      {
        $sort: {
          // Sort by unlockTimestamp (earliest first)
          unlockTimestamp: 1
        }
      },
      { $skip: skip },
      { $limit: parseInt(limit) }
    ];

    let deposits;
    try {
      deposits = await UserDeposits.aggregate(pipeline);
    } catch (aggregationError) {
      console.error('Aggregation error in getDepositsByUser:', aggregationError);
      return res.status(500).json({
        success: false,
        error: 'Failed to process user deposits query'
      });
    }

    let totalCount;
    try {
      totalCount = await UserDeposits.countDocuments({ 
        originalMinter: userAddress.toLowerCase() 
      });
    } catch (countError) {
      console.error('Count error in getDepositsByUser:', countError);
      totalCount = 0;
    }

    const totalPages = Math.ceil(totalCount / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    return res.status(200).json({
      success: true,
      deposits,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount,
        hasNextPage,
        hasPrevPage,
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('getDepositsByUser error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Test token decimals fetching function
export const testTokenDecimals = async (req, res) => {
  try {
    const { tokenAddress } = req.query;
    
    if (!tokenAddress) {
      return res.status(400).json({
        success: false,
        error: 'tokenAddress query parameter is required'
      });
    }
    
    console.log(`Testing token decimals fetching for: ${tokenAddress}`);
    
    // Create fresh contract instance
    const TimeLockNFTStaking_contract = await createContractInstance();
    
    // Test token info fetching
    const tokenInfo = await getTokenInfo(tokenAddress, TimeLockNFTStaking_contract.provider);
    
    console.log('Token info fetched successfully:', tokenInfo);
    
    return res.status(200).json({
      success: true,
      message: 'Token decimals test successful',
      tokenAddress: tokenAddress,
      tokenInfo: tokenInfo,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Token decimals test failed:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

// Test blockchain state and rate limiting
export const testBlockchainState = async (req, res) => {
  try {
    const { proposalId } = req.query;
    
    console.log('Testing blockchain state and rate limiting...');
    
    // Test rate limiting
    if (proposalId) {
      try {
        checkRateLimit(proposalId);
        console.log(`Rate limit check passed for proposalId: ${proposalId}`);
      } catch (rateLimitError) {
        console.log(`Rate limit check failed for proposalId: ${proposalId}:`, rateLimitError.message);
      }
    }
    
    // Create fresh contract instance
    const TimeLockNFTStaking_contract = await createContractInstance();
    
    // Test blockchain state
    const network = await TimeLockNFTStaking_contract.provider.getNetwork();
    const currentBlock = await TimeLockNFTStaking_contract.provider.getBlockNumber();
    
    console.log('Blockchain state:', {
      network: network.name,
      chainId: network.chainId,
      currentBlock: currentBlock
    });
    
    return res.status(200).json({
      success: true,
      message: 'Blockchain state test successful',
      blockchain: {
        network: network.name,
        chainId: network.chainId,
        currentBlock: currentBlock
      },
      rateLimit: {
        activeEntries: apiCallTimestamps.size,
        minInterval: MIN_CALL_INTERVAL
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Blockchain state test failed:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};
