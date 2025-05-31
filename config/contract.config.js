// src/config/contract.config.js
import { createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import LockNftAbi from '../abis/LockTimeNftAbi.json' with { type: 'json' };

const RPC_URL = process.env.RPC_URL || 'https://sepolia.base.org';
const CONTRACT_ADDRESS = process.env.LOCK_NFT_ADDR;

if (!CONTRACT_ADDRESS) {
  throw new Error('LOCK_NFT_ADDR is not set in .env');
}

export const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(RPC_URL),
});
//

//

export const LockNFT_getContractInstance = () => ({
  address: CONTRACT_ADDRESS,
  abi: LockNftAbi,
});