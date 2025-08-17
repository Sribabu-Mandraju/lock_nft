import express from 'express';
import {
  createDeposit,
  getDeposits,
  getDepositById,
  getDepositsByUser
} from '../controllers/userDepositsController.js';

const router = express.Router();

// Create a new deposit record
// POST /api/deposits
router.post('/', createDeposit);

// Get all deposits with filtering and pagination
// GET /api/deposits?proposalId=123&transactionHash=0x...&address=0x...&limit=50&page=1
router.get('/', getDeposits);

// Get a single deposit by proposalId
// GET /api/deposits/:proposalId
router.get('/:proposalId', getDepositById);

// Get all deposits for a specific user
// GET /api/deposits/user/:userAddress?limit=50&page=1
router.get('/user/:userAddress', getDepositsByUser);

export default router;
