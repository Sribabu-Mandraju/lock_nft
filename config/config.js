import { createConfig, http } from '@wagmi/core'
import { mainnet, sepolia } from '@wagmi/core/chains'
import { base, baseSepolia } from 'viem/chains' // Import both Base networks from viem

export const config = createConfig({
  chains: [mainnet, sepolia, base, baseSepolia],
  transports: {
    // Ethereum
    // [mainnet.id]: http(process.env.NEXT_PUBLIC_ETH_MAINNET_RPC),
    // [sepolia.id]: http(process.env.NEXT_PUBLIC_ETH_SEPOLIA_RPC),
    
    // Base Mainnet
    // [base.id]: http(process.env.NEXT_PUBLIC_BASE_MAINNET_RPC),
    
    // Base Sepolia
    [baseSepolia.id]: http(process.env.RPC_URL),
  }
})
