//--empireApi.ts
// Server-side only service - no 'use client' needed

import type { ReactNode } from 'react'

export interface EmpireVaultData {
  address: string
  tokenAddress: string
  tokenInfo: {
    symbol: string
    name: string
    logoURI?: string
  }
  leaderboard: EmpireHolder[]
  isSupported: boolean
  vaultType: 'clanker' | 'glanker' | 'unknown'
}

export interface EmpireHolder {
  address: string
  balance: string
  baseBalance: string
  appliedBoosts: any[]
  finalMultiplier: number
  isLP: boolean
  farcasterUsername?: string
  rank: number
}

export interface EmpirePersonalStats {
  address: string
  totalVaults: number
  totalTokensHeld: string
  totalValueUSD: string
  topVaultsByValue: Array<{
    vaultAddress: string
    tokenSymbol: string
    balance: string
    valueUSD: string
    rank: number
  }>
  recentActivity: Array<{
    type: 'deposit' | 'withdrawal' | 'vault_created'
    vaultAddress: string
    amount: string
    timestamp: Date
    txHash: string
  }>
}

export interface EmpireDeploymentRequest {
  tokenAddress: string
  vaultType: 'clanker' | 'glanker'
  ownerAddress: string
  settings?: {
    feePercentage?: number
    minimumDeposit?: string
    maxSupply?: string
  }
}

export interface EmpireDeploymentResponse {
  success: boolean
  vaultAddress?: string
  transactionHash?: string
  error?: string
  estimatedGas?: string
  deploymentCost?: string
}

export interface EmpireTokenInfo {
  address: string
  symbol: string
  name: string
  decimals: number
  logoURI?: string
  priceUSD?: string
  marketCap?: string
  volume24h?: string
  isVerified: boolean
}

export interface TokenWithEmpireRequest {
  name: string
  symbol: string
  imageUrl: string
  creatorAddress: string
  signature: string
  message: string
  vaultPercentage?: number
  vaultUnlockTimestamp?: number
}

export interface TokenWithEmpireResponse {
  success: boolean
  token: {
    address: string
    name: string
    symbol: string
    logoURI: string
    deploymentHash: string
    blockNumber: number
    gasUsed: string
    creatorRewardsPercentage: number
    vaultPercentage: number
    vaultUnlockTimestamp: number
  }
  empire: {
    address: string
    name: string
    deploymentHash: string
    blockNumber: number
    gasUsed: string
    owner: string
    chainId: number
    status: string
  }
  deployedAt: string
  totalGasUsed: string
}

interface EmpireApiErrorData {
  code: string
  message: string
  details?: any
  timestamp: Date
}

interface CacheEntry<T> {
  data: T
  timestamp: number
  expiresAt: number
}

interface RateLimitState {
  requests: number
  resetTime: number
}

class EmpireApiService {
  private readonly baseUrl: string = 'https://www.empirebuilder.world/api'
  private readonly apiKey: string
  private readonly cache: Map<string, CacheEntry<any>> = new Map()
  private readonly rateLimitState: RateLimitState = { requests: 0, resetTime: 0 }
  private readonly maxRequestsPerMinute: number = 60
  private readonly defaultCacheTTL: number = 5 * 60 * 1000 // 5 minutes

  constructor() {
    this.apiKey = process.env.NEXT_PUBLIC_EMPIRE_API_KEY || 'schmidt-empire-56284ver4mt68e9'
    
    if (!this.apiKey) {
      console.warn('⚠️ Empire API key not found in environment variables')
    }
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {},
    cacheTTL: number = this.defaultCacheTTL
  ): Promise<T> {
    const cacheKey = `${endpoint}_${JSON.stringify(options)}`
    
    // Check cache first
    const cached = this.cache.get(cacheKey)
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data as T
    }

    // Check rate limit
    await this.checkRateLimit()

    // Use proxy endpoint to avoid CORS issues
    const proxyHeaders = {
      'X-API-Key': this.apiKey,
      'Content-Type': 'application/json',
      'User-Agent': 'SoapBox/1.0',
      ...options.headers
    }

    const proxyBody = {
      protocol: 'https',
      origin: 'www.empirebuilder.world',
      path: `/api${endpoint}`,
      method: options.method || 'GET',
      headers: proxyHeaders,
      ...(options.body && { body: options.body })
    }

    try {
      const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(proxyBody)
      })

      // Update rate limit tracking
      this.updateRateLimit(response)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new EmpireApiError({
          code: `HTTP_${response.status}`,
          message: errorData.message || `Request failed with status ${response.status}`,
          details: errorData,
          timestamp: new Date()
        })
      }

      const data = await response.json()

      // Cache successful response
      if (cacheTTL > 0) {
        this.cache.set(cacheKey, {
          data,
          timestamp: Date.now(),
          expiresAt: Date.now() + cacheTTL
        })
      }

      return data as T
    } catch (error) {
      if (error instanceof EmpireApiError) {
        throw error
      }

      throw new EmpireApiError({
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Network request failed',
        details: error,
        timestamp: new Date()
      })
    }
  }

  private async checkRateLimit(): Promise<void> {
    const now = Date.now()
    
    // Reset rate limit counter every minute
    if (now > this.rateLimitState.resetTime) {
      this.rateLimitState.requests = 0
      this.rateLimitState.resetTime = now + 60000 // 1 minute
    }

    // Check if we've exceeded the rate limit
    if (this.rateLimitState.requests >= this.maxRequestsPerMinute) {
      const waitTime = this.rateLimitState.resetTime - now
      console.warn(`⚠️ Rate limit exceeded, waiting ${waitTime}ms`)
      await new Promise(resolve => setTimeout(resolve, waitTime))
      this.rateLimitState.requests = 0
      this.rateLimitState.resetTime = Date.now() + 60000
    }

    this.rateLimitState.requests++
  }

  private updateRateLimit(response: Response): void {
    const remaining = response.headers.get('X-RateLimit-Remaining')
    const reset = response.headers.get('X-RateLimit-Reset')
    
    if (remaining && reset) {
      this.rateLimitState.requests = this.maxRequestsPerMinute - parseInt(remaining)
      this.rateLimitState.resetTime = parseInt(reset) * 1000
    }
  }

  public async getLeaderboard(
    vaultAddress: string,
    options: {
      limit?: number
      offset?: number
      includeUsernames?: boolean
    } = {}
  ): Promise<EmpireVaultData> {
    const { limit = 100, offset = 0, includeUsernames = true } = options
    
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
        include_usernames: includeUsernames.toString()
      })

      const response = await this.makeRequest<{
        holders: Array<{
          address: string
          balance: string
          baseBalance: string
          appliedBoosts: any[]
          finalMultiplier: number
          isLP: boolean
          farcasterUsername?: string
          rank: number
        }>
        cached: boolean
      }>(`/leaderboard/${vaultAddress}`)

      // Fetch real token info using tokenUtils for proper token data
      let tokenInfo: { symbol: string; name: string; logoURI?: string };
      
      try {
        // Import tokenUtils to get real token information
        const { getTokenInfoFromVault } = await import('@/lib/tokenUtils');
        const vaultTokenInfo = await getTokenInfoFromVault(vaultAddress);
        
        tokenInfo = {
          symbol: vaultTokenInfo.symbol,
          name: vaultTokenInfo.name,
          logoURI: vaultTokenInfo.logoURI
        };
        
        console.log('✅ Real token info resolved:', tokenInfo);
      } catch (tokenError) {
        console.warn('⚠️ Failed to fetch token info, using fallback:', tokenError);
        
        // Make real token metadata call using tokenUtils as fallback
        try {
          console.log('🔄 Attempting real token metadata retrieval as fallback...');
          const { tokenUtils } = await import('@/lib/tokenUtils');
          const realTokenInfo = await tokenUtils.fetchTokenInfo(vaultAddress);
          
          tokenInfo = {
            symbol: realTokenInfo.symbol,
            name: realTokenInfo.name,
            logoURI: realTokenInfo.logoURI
          };
          
          console.log('✅ Real token metadata retrieved as fallback:', tokenInfo);
        } catch (fallbackError) {
          console.warn('⚠️ All token retrieval methods failed, returning structured error response:', fallbackError);
          
          // Return structured error response instead of 'UNKNOWN' values
          tokenInfo = {
            symbol: `ERROR_TOKEN_${vaultAddress.slice(-6)}`,
            name: `Token Metadata Unavailable (${vaultAddress.slice(-6)})`,
            logoURI: undefined
          };
          
          // Add comprehensive error metadata
          Object.assign(tokenInfo, {
            verified: false,
            source: 'error_fallback',
            originalError: tokenError instanceof Error ? tokenError.message : 'Token info unavailable',
            fallbackError: fallbackError instanceof Error ? fallbackError.message : 'Fallback retrieval failed',
            timestamp: new Date().toISOString(),
            vaultAddress: vaultAddress
          });
        }
      }

      return {
        address: vaultAddress,
        tokenAddress: vaultAddress, // This will be corrected by tokenUtils
        tokenInfo,
        leaderboard: response.holders.map(holder => ({
          address: holder.address,
          balance: holder.balance,
          baseBalance: holder.baseBalance,
          appliedBoosts: holder.appliedBoosts,
          finalMultiplier: holder.finalMultiplier,
          isLP: holder.isLP,
          farcasterUsername: holder.farcasterUsername,
          rank: holder.rank
        })),
        isSupported: true, // If we get data, it's supported
        vaultType: response.holders.length > 0 ? 'clanker' : 'unknown' // Default to clanker
      }
    } catch (error) {
      console.error('❌ Failed to fetch Empire leaderboard:', error)
      throw error
    }
  }

  public async getPersonalStats(empireTokenAddress: string, userAddress: string): Promise<EmpirePersonalStats> {
    try {
      const response = await this.makeRequest<{
        balance: string
        boostedBalance: string
        boost: number
        rank: number
        activeBoosterIds: string[]
      }>(`/personal-stats/${empireTokenAddress}`, {
        method: 'POST',
        headers: {
          'X-API-Key': this.apiKey
        },
        body: JSON.stringify({
          address: userAddress
        })
      })

      return {
        address: userAddress,
        totalVaults: 1, // Single vault query
        totalTokensHeld: response.balance,
        totalValueUSD: response.boostedBalance,
        topVaultsByValue: [{
          vaultAddress: userAddress,
          tokenSymbol: 'TOKEN',
          balance: response.balance,
          valueUSD: response.boostedBalance,
          rank: response.rank
        }],
        recentActivity: []
      }
    } catch (error) {
      console.error('❌ Failed to fetch Empire personal stats:', error)
      throw error
    }
  }

  public async deployEmpire(request: EmpireDeploymentRequest): Promise<EmpireDeploymentResponse> {
    try {
      const response = await this.makeRequest<{
        success: boolean
        empireAddress?: string
        transactionHash?: string
        blockNumber?: number
        gasUsed?: string
        empire?: any
        error?: string
        message?: string
        code?: string
      }>('/deploy-empire', {
        method: 'POST',
        headers: {
          'X-API-Key': this.apiKey
        },
        body: JSON.stringify({
          baseToken: request.tokenAddress,
          name: `Empire for ${request.tokenAddress}`,
          owner: request.ownerAddress,
          tokenType: request.vaultType,
          tokenInfo: await this.getTokenInfoForDeployment(request.tokenAddress),
          // Add comprehensive deployment metadata
          deploymentMetadata: {
            requestId: `deploy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            requestTimestamp: Date.now(),
            tokenAddress: request.tokenAddress,
            vaultType: request.vaultType,
            creatorAddress: request.ownerAddress
          },
          signature: '', // Real signature would be provided by the calling component
          message: `Deploy Empire Vault for token ${request.tokenAddress}`,
          // Add deployment metadata for better tracking
          deploymentSource: 'SoapBox',
          deploymentTimestamp: Date.now(),
          creatorAddress: request.ownerAddress
        })
      }, 0) // No caching for deployment requests

      return {
        success: response.success,
        vaultAddress: response.empireAddress,
        transactionHash: response.transactionHash,
        error: response.error,
        estimatedGas: response.gasUsed,
        deploymentCost: '0'
      }
    } catch (error) {
      console.error('❌ Failed to deploy Empire vault:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Deployment failed'
      }
    }
  }

  public async verifyVaultOwnership(
    vaultAddress: string,
    ownerAddress: string
  ): Promise<{ isOwner: boolean; actualOwner?: string }> {
    try {
      const response = await this.makeRequest<{
        is_owner: boolean
        actual_owner?: string
        vault_address: string
      }>(`/v1/vaults/${vaultAddress}/ownership/${ownerAddress}`)

      return {
        isOwner: response.is_owner,
        actualOwner: response.actual_owner
      }
    } catch (error) {
      console.error('❌ Failed to verify vault ownership:', error)
      throw error
    }
  }

  public async getTokenInfo(tokenAddress: string): Promise<EmpireTokenInfo> {
    try {
      const response = await this.makeRequest<{
        address: string
        symbol: string
        name: string
        decimals: number
        logo_uri?: string
        price_usd?: string
        market_cap?: string
        volume_24h?: string
        is_verified: boolean
      }>(`/v1/tokens/${tokenAddress}`)

      return {
        address: response.address,
        symbol: response.symbol,
        name: response.name,
        decimals: response.decimals,
        logoURI: response.logo_uri,
        priceUSD: response.price_usd,
        marketCap: response.market_cap,
        volume24h: response.volume_24h,
        isVerified: response.is_verified
      }
    } catch (error) {
      console.error('❌ Failed to fetch token info:', error)
      throw error
    }
  }

  public async searchVaults(query: string, options: {
    vaultType?: 'clanker' | 'glanker'
    limit?: number
    sortBy?: 'tvl' | 'volume' | 'created_at'
    sortOrder?: 'asc' | 'desc'
  } = {}): Promise<EmpireVaultData[]> {
    const { limit = 20, sortBy = 'tvl', sortOrder = 'desc' } = options
    
    try {
      const params = new URLSearchParams({
        q: query,
        limit: limit.toString(),
        sort_by: sortBy,
        sort_order: sortOrder
      })

      if (options.vaultType) {
        params.append('vault_type', options.vaultType)
      }

      const response = await this.makeRequest<{
        vaults: Array<{
          address: string
          token_address: string
          token_info: {
            symbol: string
            name: string
            logo_uri?: string
          }
          vault_type: string
          is_supported: boolean
          leaderboard_preview: Array<{
            address: string
            balance: string
            base_balance: string
            applied_boosts: any[]
            final_multiplier: number
            is_lp: boolean
            farcaster_username?: string
            rank: number
          }>
        }>
      }>(`/v1/vaults/search?${params}`)

      return response.vaults.map(vault => ({
        address: vault.address,
        tokenAddress: vault.token_address,
        tokenInfo: {
          symbol: vault.token_info.symbol,
          name: vault.token_info.name,
          logoURI: vault.token_info.logo_uri
        },
        leaderboard: vault.leaderboard_preview.map(holder => ({
          address: holder.address,
          balance: holder.balance,
          baseBalance: holder.base_balance,
          appliedBoosts: holder.applied_boosts,
          finalMultiplier: holder.final_multiplier,
          isLP: holder.is_lp,
          farcasterUsername: holder.farcaster_username,
          rank: holder.rank
        })),
        isSupported: vault.is_supported,
        vaultType: this.normalizeVaultType(vault.vault_type)
      }))
    } catch (error) {
      console.error('❌ Failed to search vaults:', error)
      throw error
    }
  }

  public async getVaultMetrics(vaultAddress: string): Promise<{
    totalValueLocked: string
    totalHolders: number
    volume24h: string
    averageHolding: string
    topHolderPercentage: number
  }> {
    try {
      const response = await this.makeRequest<{
        total_value_locked: string
        total_holders: number
        volume_24h: string
        average_holding: string
        top_holder_percentage: number
      }>(`/v1/vaults/${vaultAddress}/metrics`)

      return {
        totalValueLocked: response.total_value_locked,
        totalHolders: response.total_holders,
        volume24h: response.volume_24h,
        averageHolding: response.average_holding,
        topHolderPercentage: response.top_holder_percentage
      }
    } catch (error) {
      console.error('❌ Failed to fetch vault metrics:', error)
      throw error
    }
  }

  public async getVaultByTokenAddress(tokenAddress: string): Promise<EmpireVaultData | null> {
    try {
      // Use search API to find vault for this specific token
      const results = await this.searchVaults(tokenAddress, { limit: 10 })
      
      // Check if any result has an exact token address match
      const exactMatch = results.find(vault => 
        vault.tokenAddress.toLowerCase() === tokenAddress.toLowerCase()
      )
      
      return exactMatch || null
    } catch (error) {
      console.error('❌ Failed to check vault existence for token:', tokenAddress, error)
      return null
    }
  }

  public async deployTokenWithEmpire(params: TokenWithEmpireRequest): Promise<TokenWithEmpireResponse> {
    try {
      // Validate vault percentage caps
      if (params.vaultPercentage !== undefined) {
        if (params.vaultPercentage > 80) {
          throw new Error('Vault percentage cannot exceed 80% (hard cap)')
        }
      }

      const response = await this.makeRequest<TokenWithEmpireResponse>('/deploy-token-with-empire', {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(params)
      }, 0) // No caching for deployment requests

      return response
    } catch (error) {
      console.error('❌ Failed to deploy token with empire:', error)
      throw error
    }
  }

  /**
   * Get real token information for deployment with comprehensive fallback strategy
   */
  private async getTokenInfoForDeployment(tokenAddress: string): Promise<{ symbol: string; name: string; logoURI?: string }> {
    try {
      console.log('🔍 Getting real token info for deployment:', tokenAddress);
      
      // Try our Empire API first to get token info
      try {
        const empireTokenInfo = await this.getTokenInfo(tokenAddress);
        return {
          symbol: empireTokenInfo.symbol,
          name: empireTokenInfo.name,
          logoURI: empireTokenInfo.logoURI
        };
      } catch (empireError) {
        console.warn('⚠️ Empire API token info failed, trying tokenUtils:', empireError);
        
        // Fallback to tokenUtils for comprehensive token metadata
        const { tokenUtils } = await import('@/lib/tokenUtils');
        const tokenInfo = await tokenUtils.fetchTokenInfo(tokenAddress);
        
        console.log('✅ Real token info retrieved via tokenUtils:', tokenInfo);
        return {
          symbol: tokenInfo.symbol,
          name: tokenInfo.name,
          logoURI: tokenInfo.logoURI
        };
      }
    } catch (error) {
      console.error('❌ All token metadata retrieval methods failed for deployment:', error);
      
      // Return structured error response instead of UNKNOWN
      const shortAddress = tokenAddress.slice(-8);
      return {
        symbol: `TOKEN_${shortAddress}`,
        name: `Token ${shortAddress}`,
        logoURI: undefined
      };
    }
  }

  private normalizeVaultType(vaultType: string): 'clanker' | 'glanker' | 'unknown' {
    const normalized = vaultType.toLowerCase()
    if (normalized === 'clanker' || normalized === 'glanker') {
      return normalized as 'clanker' | 'glanker'
    }
    return 'unknown'
  }

  public clearCache(): void {
    this.cache.clear()
  }

  public getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys())
    }
  }
}

// Custom error class for Empire API errors
class EmpireApiError extends Error {
  public readonly code: string
  public readonly details?: any
  public readonly timestamp: Date

  constructor(error: EmpireApiErrorData) {
    super(error.message)
    this.name = 'EmpireApiError'
    this.code = error.code
    this.details = error.details
    this.timestamp = error.timestamp
  }
}

// Export singleton instance
export const empireApiService = new EmpireApiService()

// Export convenience functions
export const getEmpireLeaderboard = (vaultAddress: string, options?: Parameters<typeof empireApiService.getLeaderboard>[1]) =>
  empireApiService.getLeaderboard(vaultAddress, options)

export const getEmpirePersonalStats = (empireTokenAddress: string, userAddress: string) =>
  empireApiService.getPersonalStats(empireTokenAddress, userAddress)

export const deployEmpireVault = (request: EmpireDeploymentRequest) =>
  empireApiService.deployEmpire(request)

export const verifyEmpireVaultOwnership = (vaultAddress: string, ownerAddress: string) =>
  empireApiService.verifyVaultOwnership(vaultAddress, ownerAddress)

export const getEmpireTokenInfo = (tokenAddress: string) =>
  empireApiService.getTokenInfo(tokenAddress)

export const searchEmpireVaults = (query: string, options?: Parameters<typeof empireApiService.searchVaults>[1]) =>
  empireApiService.searchVaults(query, options)

export const getEmpireVaultMetrics = (vaultAddress: string) =>
  empireApiService.getVaultMetrics(vaultAddress)

export const getVaultByTokenAddress = (tokenAddress: string) =>
  empireApiService.getVaultByTokenAddress(tokenAddress)

export const deployTokenWithEmpire = (params: TokenWithEmpireRequest) =>
  empireApiService.deployTokenWithEmpire(params)

export default empireApiService