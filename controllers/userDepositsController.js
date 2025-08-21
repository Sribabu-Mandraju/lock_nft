import { ethers } from 'ethers';
import TimeLockNFTStaking_ABI from '../abis/LockTimeNFT_ABI.json' with { type: 'json' };
import UserDeposits from '../models/userDepositsModel.js';

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

const provider = new ethers.JsonRpcProvider('https://base-mainnet.g.alchemy.com/v2/lzIxPpJ8bHtK938K6Bnet');
const TimeLockNFTStaking_contractAddress = '0xC7Ac55fF5C832fDc8572C5F0C6E203BB329Af35B';

const TimeLockNFTStaking_contract = new ethers.Contract(
  TimeLockNFTStaking_contractAddress,
  TimeLockNFTStaking_ABI,
  provider
);

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
        error: 'Deposit already exists with this proposalId or transactionHash'
      });
    }

    // Fetch deposit data from smart contract
    let depositData;
    try {
      depositData = await TimeLockNFTStaking_contract.getDeposit(proposalId);
    } catch (error) {
      console.error('Contract getDeposit error:', error);
      
      // Provide more specific error messages
      if (error.code === 'INVALID_ARGUMENT') {
        return res.status(400).json({
          success: false,
          error: `Invalid proposalId: ${proposalId}. Please provide a valid positive number.`
        });
      } else if (error.message && error.message.includes('No deposit')) {
        return res.status(404).json({
          success: false,
          error: `No deposit found for proposalId ${proposalId}`
        });
      } else {
        return res.status(500).json({
          success: false,
          error: `Contract error: ${error.message}`
        });
      }
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

    // Create new deposit record with safe string conversion for large numbers
    const newDeposit = new UserDeposits({
      address: originalMinter, // Using originalMinter as address
      depositToken: depositToken,
      amount: safeToString(amount), // Safe conversion for large numbers
      startTimestamp: safeToString(startTimestamp), // Safe conversion for large numbers
      periodMonths: Number(periodMonths), // Convert to Number for uint8
      unlockTimestamp: safeToString(unlockTimestamp), // Safe conversion for large numbers
      originalMinter: originalMinter,
      isClaimed: false,
      transactionHash: transactionHash,
      tokenId: safeToString(proposalId)
    });

    // Save to database
    const savedDeposit = await newDeposit.save();

    return res.status(201).json({
      success: true,
      message: 'Deposit created successfully',
      deposit: savedDeposit
    });

  } catch (error) {
    console.error('createDeposit error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Get deposits with filtering and deadline ordering
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
      limit = 50,
      page = 1
    } = req.query;

    // Build filter object based on provided parameters
    const filter = {};

    if (proposalId) {
      filter.tokenId = proposalId.toString();
    }

    if (transactionHash) {
      filter.transactionHash = transactionHash;
    }

    if (address) {
      filter.address = address.toLowerCase();
    }

    if (depositToken) {
      filter.depositToken = depositToken.toLowerCase();
    }

    if (originalMinter) {
      filter.originalMinter = originalMinter.toLowerCase();
    }

    if (isClaimed !== undefined) {
      filter.isClaimed = isClaimed === 'true';
    }

    if (periodMonths) {
      filter.periodMonths = parseInt(periodMonths);
    }

    if (startTimestamp) {
      filter.startTimestamp = startTimestamp;
    }

    if (unlockTimestamp) {
      filter.unlockTimestamp = unlockTimestamp;
    }

    if (amount) {
      filter.amount = amount;
    }

    // Calculate skip for pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get current timestamp for deadline comparison
    const currentTimestamp = Math.floor(Date.now() / 1000).toString();

    // Build aggregation pipeline for deadline ordering (handle large numbers as strings)
    const pipeline = [
      { $match: filter },
      {
        $addFields: {
          // Keep unlockTimestamp as string and compare as strings for large numbers
          unlockTimestampStr: "$unlockTimestamp",
          // Calculate time until deadline using string comparison
          timeUntilDeadline: {
            $cond: {
              if: { $gte: ["$unlockTimestamp", currentTimestamp] },
              then: { $subtract: [{ $toLong: "$unlockTimestamp" }, parseInt(currentTimestamp)] },
              else: { $subtract: [{ $toLong: "$unlockTimestamp" }, parseInt(currentTimestamp)] }
            }
          }
        }
      },
      {
        $sort: {
          // Sort by unlockTimestamp string (lexicographical order works for timestamps)
          unlockTimestampStr: 1
        }
      },
      {
        $project: {
          unlockTimestampStr: 0, // Remove the computed field
          timeUntilDeadline: 0   // Remove the computed field
        }
      },
      { $skip: skip },
      { $limit: parseInt(limit) }
    ];

    // Execute aggregation
    const deposits = await UserDeposits.aggregate(pipeline);

    // Get total count for pagination
    const totalCount = await UserDeposits.countDocuments(filter);

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
    const currentTimestamp = Math.floor(Date.now() / 1000).toString();

    const pipeline = [
      { 
        $match: { 
          originalMinter: userAddress.toLowerCase() 
        } 
      },
      {
        $addFields: {
          // Keep unlockTimestamp as string for large numbers
          unlockTimestampStr: "$unlockTimestamp"
        }
      },
      {
        $sort: {
          // Sort by unlockTimestamp string (lexicographical order works for timestamps)
          unlockTimestampStr: 1
        }
      },
      {
        $project: {
          unlockTimestampStr: 0 // Remove the computed field
        }
      },
      { $skip: skip },
      { $limit: parseInt(limit) }
    ];

    const deposits = await UserDeposits.aggregate(pipeline);
    const totalCount = await UserDeposits.countDocuments({ 
      originalMinter: userAddress.toLowerCase() 
    });

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
