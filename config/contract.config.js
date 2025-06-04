// src/config/contract.config.js
import { createPublicClient, http } from 'viem';
import {
  baseSepolia,
  base,
  mainnet,
  sepolia,
  arbitrum,
  arbitrumSepolia,
  optimism,
  optimismSepolia,
} from 'viem/chains';
import LockNftAbi from '../abis/LockTimeNftAbi.json' with { type: 'json' };

// Network configurations
const NETWORKS = {
  baseSepolia: {
    chain: baseSepolia,
    rpcUrl: process.env.BASE_SEPOLIA_RPC || 'https://sepolia.base.org',
    contractAddress: process.env.LOCK_NFT_ADDR_BASE_SEPOLIA,
    name: 'Base Sepolia',
  },
  base: {
    chain: base,
    rpcUrl: process.env.BASE_RPC || 'https://mainnet.base.org',
    contractAddress: process.env.LOCK_NFT_ADDR_BASE,
    name: 'Base',
  },
  mainnet: {
    chain: mainnet,
    rpcUrl: process.env.ETH_RPC || 'https://eth.llamarpc.com',
    contractAddress: process.env.LOCK_NFT_ADDR_ETH,
    name: 'Ethereum',
  },
  sepolia: {
    chain: sepolia,
    rpcUrl: process.env.SEPOLIA_RPC || 'https://rpc.sepolia.org',
    contractAddress: process.env.LOCK_NFT_ADDR_SEPOLIA,
    name: 'Sepolia',
  },
  arbitrum: {
    chain: arbitrum,
    rpcUrl: process.env.ARBITRUM_RPC || 'https://arb1.arbitrum.io/rpc',
    contractAddress: process.env.LOCK_NFT_ADDR_ARBITRUM,
    name: 'Arbitrum',
  },
  arbitrumSepolia: {
    chain: arbitrumSepolia,
    rpcUrl: process.env.ARBITRUM_SEPOLIA_RPC || 'https://sepolia-rollup.arbitrum.io/rpc',
    contractAddress: process.env.LOCK_NFT_ADDR_ARBITRUM_SEPOLIA,
    name: 'Arbitrum Sepolia',
  },
  optimism: {
    chain: optimism,
    rpcUrl: process.env.OPTIMISM_RPC || 'https://mainnet.optimism.io',
    contractAddress: process.env.LOCK_NFT_ADDR_OPTIMISM,
    name: 'Optimism',
  },
  optimismSepolia: {
    chain: optimismSepolia,
    rpcUrl: process.env.OPTIMISM_SEPOLIA_RPC || 'https://sepolia.optimism.io',
    contractAddress: process.env.LOCK_NFT_ADDR_OPTIMISM_SEPOLIA,
    name: 'Optimism Sepolia',
  },
};

// Get current network from environment or default to baseSepolia
const getCurrentNetwork = () => {
  const networkId = process.env.NETWORK_ID || 'baseSepolia';
  return NETWORKS[networkId] || NETWORKS.baseSepolia;
};

// Create public client instance
const createClient = () => {
  const network = getCurrentNetwork();
  return createPublicClient({
    chain: network.chain,
    transport: http(network.rpcUrl),
  });
};

// Instantiate the client
const publicClientInstance = createClient();

// Get contract instance for the current network
export const LockNFT_getContractInstance = () => {
  const network = getCurrentNetwork();
  if (!network.contractAddress) {
    throw new Error(`Contract address not set for ${network.name}. Please set the appropriate LOCK_NFT_ADDR_* environment variable.`);
  }
  return {
    address: network.contractAddress,
    abi: LockNftAbi,
  };
};

// Get all supported networks
export const getSupportedNetworks = () => {
  return Object.entries(NETWORKS).map(([id, network]) => ({
    id,
    name: network.name,
    chainId: network.chain.id,
    rpcUrl: network.rpcUrl,
    contractAddress: network.contractAddress,
  }));
};

// Get network by chain ID
export const getNetworkByChainId = (chainId) => {
  return Object.values(NETWORKS).find(
    (network) => network.chain.id === chainId
  );
};

// Get network by ID
export const getNetworkById = (networkId) => {
  return NETWORKS[networkId];
};

// Export current network info
export const currentNetwork = getCurrentNetwork();

// Export the instantiated client
export { publicClientInstance as publicClient };

// Also export the creation function for flexibility
export const createPublicClientForNetwork = (networkId) => {
  const network = NETWORKS[networkId] || getCurrentNetwork();
  return createPublicClient({
    chain: network.chain,
    transport: http(network.rpcUrl),
  });
};