//--rpcConfig.ts
import { http, createPublicClient, fallback } from 'viem'
import { base } from 'viem/chains'
import type { PublicClient } from 'viem'

export interface RPCConfig {
  primary: string
  fallback: string[]
  rotation: boolean
}

/**
 * PRIVATE RPC Configuration for SoapBox - Using only private/authenticated endpoints
 * All public endpoints removed to prevent rate limiting issues
 * Uses private RPC providers from SoapBox RPCs connection
 */
export const getRPCConfig = (): RPCConfig => {
  // Private RPC endpoints from SoapBox RPCs connection (ordered by reliability)
  const alchemyPrimary = `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY1}`;
  const alchemySecondary = `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY2}`;
  const alchemyTertiary = `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY3}`;
  const pimlicoMainnet = `https://api.pimlico.io/v2/8453/rpc?apikey=${process.env.PIMLICO1}`;
  const pimlicoSecondary = 'https://api.pimlico.io/v2/8453/rpc?apikey=${process.env.PIMLICO2}`;
  // Environment variables override if available
  const envPrimaryRPC = process.env.NEXT_PUBLIC_BASE_PRIVATE_RPC_URL || process.env.BASE_RPC_URLS
  const envAlchemy = process.env.NEXT_PUBLIC_ALCHEMY_BASE_URL

  // Fallback chain - only private authenticated endpoints
  const fallbackRpcs = [
    envPrimaryRPC,
    envAlchemy, 
    alchemyPrimary,
    alchemySecondary,
    alchemyTertiary,
    pimlicoMainnet,
    pimlicoSecondary
  ].filter(Boolean) as string[]

  // Debug logging for RPC configuration (server-side only)
  if (typeof window === 'undefined') {
    console.log('🔗 Private RPC Configuration:', {
      primaryRPC: envPrimaryRPC ? `${envPrimaryRPC.slice(0, 25)}...` : 'using fallback',
      fallbackCount: fallbackRpcs.length,
      rotationEnabled: true,
      publicEndpoints: 'REMOVED for rate limit prevention'
    })
  }

  return {
    primary: envPrimaryRPC || alchemyPrimary,
    fallback: fallbackRpcs,
    rotation: true
  }
}

/**
 * Create a resilient public client with multiple fallback RPC endpoints
 * Enhanced for SoapBox authorization calls - NO MORE RATE LIMITS
 * Uses ONLY private/authenticated RPC endpoints with smart rotation
 */
export const createResilientPublicClient = () => {
  const config = getRPCConfig()

  // Create fallback transport chain with private endpoints only
  const transports = config.fallback.map(rpcUrl => 
    http(rpcUrl, {
      timeout: 5000,    // Fast timeout for quick failover
      retryCount: 0,    // No retries on single RPC - fail fast to next
      retryDelay: 1000  // Quick recovery
    })
  )

  console.log('🔗 Creating resilient client with private RPC fallback chain:', 
    config.fallback.map(rpc => `${rpc.split('/')[2]?.split('.')[0]}...`))

  // Use viem's fallback transport for automatic RPC rotation
  const client = createPublicClient({
    chain: base,
    transport: fallback(transports, {
      rank: false // Disable ranking to use RPCs in order
    })
  })

  return client
}

/**
 * Create a high-performance client optimized for frequent calls
 */
export const createHighPerformancePublicClient = () => {
  const config = getRPCConfig()

  // Use primary RPC with minimal timeout for high-performance operations
  const client = createPublicClient({
    chain: base,
    transport: http(config.primary, {
      timeout: 3000,    // Very fast timeout
      retryCount: 1,    // Single retry
      retryDelay: 500   // Quick retry
    })
  })

  return client
}

/**
 * Create fallback client for critical operations (backwards compatibility)
 */
export const createFallbackPublicClient = () => {
  const config = getRPCConfig()
  
  // Use secondary RPC for fallback operations
  const fallbackRPC = config.fallback[1] || config.fallback[0] // Second RPC or primary

  return createPublicClient({
    chain: base,
    transport: http(fallbackRPC, {
      timeout: 8000,    // Standard timeout for fallback operations
      retryCount: 2,    // Moderate retries for fallback
      retryDelay: 1500  // Standard delay
    })
  })
}

/**
 * Create emergency client with different configuration for critical failures
 */
export const createEmergencyPublicClient = () => {
  const config = getRPCConfig()
  
  // Use secondary Alchemy endpoint for emergencies
  const emergencyRPC = config.fallback[3] || config.fallback[0] // alchemyTertiary or first available

  return createPublicClient({
    chain: base,
    transport: http(emergencyRPC, {
      timeout: 10000,   // Longer timeout for emergency calls
      retryCount: 3,    // More retries for critical operations
      retryDelay: 2000  // Longer delays for stability
    })
  })
}

/**
 * Get transport config for wagmi with private RPC rotation
 */
export const getTransportConfig = () => {
  const config = getRPCConfig()
  
  // Use fallback transport for wagmi to ensure connection stability
  const transports = config.fallback.slice(0, 3).map(rpcUrl => // Use top 3 RPCs
    http(rpcUrl, {
      timeout: 8000,
      retryCount: 2,
      retryDelay: 1500
    })
  )
  
  return fallback(transports)
}

/**
 * RPC Health Check for monitoring
 */
export const checkRPCHealth = async (): Promise<{ healthy: string[]; failed: string[] }> => {
  const config = getRPCConfig()
  const healthy: string[] = []
  const failed: string[] = []

  for (const rpcUrl of config.fallback) {
    try {
      const client = createPublicClient({
        chain: base,
        transport: http(rpcUrl, { timeout: 5000 })
      })
      
      // Simple health check - get latest block number
      await client.getBlockNumber()
      healthy.push(rpcUrl.split('/')[2]?.split('.')[0] || 'unknown')
    } catch (error) {
      failed.push(rpcUrl.split('/')[2]?.split('.')[0] || 'unknown')
    }
  }

  console.log('🏥 RPC Health Check:', { healthy: healthy.length, failed: failed.length })
  return { healthy, failed }
}

export default {
  getRPCConfig,
  createResilientPublicClient,
  createFallbackPublicClient,
  createHighPerformancePublicClient,
  createEmergencyPublicClient,
  getTransportConfig,
  checkRPCHealth
}