import LockTimeNFTAbi from '../abis/LockTimeNFTabi.json' with { type: 'json' };
import { createWalletClient, createPublicClient, http } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import dotenv from 'dotenv';

dotenv.config();

// Configure clients
export const walletClient = createWalletClient({
  chain: baseSepolia,
  transport: http(process.env.RPC_URL)
});

export const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(process.env.RPC_URL)
});

// Contract instance
export const LockNFT_getContractInstance = () => {
  return {
    address: process.env.LOCK_NFT_ADDR,
    abi: LockTimeNFTAbi
  };
};

// ========== CONFIG FUNCTIONS (OWNER ONLY) ==========

export const setUSDT = async (usdtAddress, account) => {
  const contract = LockNFT_getContractInstance();
  const { request } = await publicClient.simulateContract({
    ...contract,
    functionName: 'setUSDT',
    args: [usdtAddress],
    account
  });
  return walletClient.writeContract(request);
};

export const setROIs = async (roi3m, roi6m, roi12m, account) => {
  const contract = LockNFT_getContractInstance();
  const { request } = await publicClient.simulateContract({
    ...contract,
    functionName: 'setROIs',
    args: [roi3m, roi6m, roi12m],
    account
  });
  return walletClient.writeContract(request);
};

export const setBaseURI = async (baseURI, account) => {
  const contract = LockNFT_getContractInstance();
  const { request } = await publicClient.simulateContract({
    ...contract,
    functionName: 'setBaseURI',
    args: [baseURI],
    account
  });
  return walletClient.writeContract(request);
};

export const setContractURI = async (contractURI, account) => {
  const contract = LockNFT_getContractInstance();
  const { request } = await publicClient.simulateContract({
    ...contract,
    functionName: 'setContractURI',
    args: [contractURI],
    account
  });
  return walletClient.writeContract(request);
};

// ========== STAKING FUNCTIONS ==========

export const deposit = async (amount, periodMonths, account) => {
  const contract = LockNFT_getContractInstance();
  const { request } = await publicClient.simulateContract({
    ...contract,
    functionName: 'deposit',
    args: [amount, periodMonths],
    account
  });
  return walletClient.writeContract(request);
};

export const redeem = async (tokenId, account) => {
  const contract = LockNFT_getContractInstance();
  const { request } = await publicClient.simulateContract({
    ...contract,
    functionName: 'redeem',
    args: [tokenId],
    account
  });
  return walletClient.writeContract(request);
};

// ========== VIEW FUNCTIONS ==========

export const getDeposit = async (tokenId) => {
  const contract = LockNFT_getContractInstance();
  return publicClient.readContract({
    ...contract,
    functionName: 'getDeposit',
    args: [tokenId]
  });
};

export const tokenURI = async (tokenId) => {
  const contract = LockNFT_getContractInstance();
  return publicClient.readContract({
    ...contract,
    functionName: 'tokenURI',
    args: [tokenId]
  });
};

export const contractURI = async () => {
  const contract = LockNFT_getContractInstance();
  return publicClient.readContract({
    ...contract,
    functionName: 'contractURI'
  });
};

export const getCurrentROIs = async () => {
  const contract = LockNFT_getContractInstance();
  const [roi3m, roi6m, roi12m] = await Promise.all([
    publicClient.readContract({ ...contract, functionName: 'roi3m' }),
    publicClient.readContract({ ...contract, functionName: 'roi6m' }),
    publicClient.readContract({ ...contract, functionName: 'roi12m' })
  ]);
  return { roi3m, roi6m, roi12m };
};

export const getUSDTAddress = async () => {
  const contract = LockNFT_getContractInstance();
  return publicClient.readContract({
    ...contract,
    functionName: 'usdt'
  });
};

// ========== UTILITY FUNCTIONS ==========

export const collectFees = async (account) => {
  const contract = LockNFT_getContractInstance();
  const { request } = await publicClient.simulateContract({
    ...contract,
    functionName: 'collectFeesNUCLEAR',
    account
  });
  return walletClient.writeContract(request);
};

// Helper to format deposit data
export const formatDepositData = (depositResult) => {
  const [amount, startTimestamp, periodMonths, unlockTimestamp, originalMinter] = depositResult;
  return {
    amount: amount.toString(),
    startTimestamp: startTimestamp.toString(),
    periodMonths: Number(periodMonths),
    unlockTimestamp: unlockTimestamp.toString(),
    originalMinter
  };
};