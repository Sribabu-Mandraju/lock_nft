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

// Network configurations with specific environment variables for each
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
    contractAddress: process.env.LOCK_NFT_ADDR_MAINNET,
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

// Create public client instance with proper error handling
const createClient = () => {
  try {
    const network = getCurrentNetwork();
    if (!network.rpcUrl) {
      throw new Error(`RPC URL not configured for ${network.name}`);
    }
    return createPublicClient({
      chain: network.chain,
      transport: http(network.rpcUrl),
    });
  } catch (error) {
    console.error('Error creating public client:', error);
    throw error;
  }
};

// Instantiate the client
const publicClientInstance = createClient();

// Get contract instance with proper validation
export const LockNFT_getContractInstance = () => {
  const network = getCurrentNetwork();
  
  if (!network.contractAddress) {
    throw new Error(
      `Contract address not set for ${network.name}. ` +
      `Please set the LOCK_NFT_ADDR_${network.id.toUpperCase()} environment variable.`
    );
  }

  if (!LockNftAbi || LockNftAbi.length === 0) {
    throw new Error('Contract ABI is not loaded or is empty');
  }

  return {
    address: network.contractAddress,
    abi: LockNftAbi,
  };
};

// Enhanced public client with error handling
export const publicClient = {
  ...publicClientInstance,
  readContract: async (params) => {
    try {
      return await publicClientInstance.readContract(params);
    } catch (error) {
      console.error('Contract read error:', {
        address: params.address,
        functionName: params.functionName,
        args: params.args,
        error: error.message
      });
      throw error;
    }
  }
};

// Export other utilities
export const getSupportedNetworks = () => {
  return Object.entries(NETWORKS).map(([id, network]) => ({
    id,
    name: network.name,
    chainId: network.chain.id,
    rpcUrl: network.rpcUrl,
    contractAddress: network.contractAddress,
  }));
};

export const getNetworkByChainId = (chainId) => {
  return Object.values(NETWORKS).find(
    (network) => network.chain.id === chainId
  );
};

export const getNetworkById = (networkId) => {
  return NETWORKS[networkId];
};

export const currentNetwork = getCurrentNetwork();

export const createPublicClientForNetwork = (networkId) => {
  const network = NETWORKS[networkId] || getCurrentNetwork();
  return createPublicClient({
    chain: network.chain,
    transport: http(network.rpcUrl),
  });
};