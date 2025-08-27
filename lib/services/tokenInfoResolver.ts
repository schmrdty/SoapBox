//--src/lib/services/tokenInfoResolver.ts
// Token Info Resolver Service - Comprehensive token metadata retrieval with fallback strategies
// Replaces all 'UNKNOWN' placeholders with real token data or structured error responses

import { tokenUtils, getTokenInfoFromVault } from '@/lib/tokenUtils'
import { empireApiService } from './empireApi'

export interface ResolvedTokenInfo {
  symbol: string
  name: string
  logoURI?: string
  verified?: boolean
  source?: 'vault' | 'tokenUtils' | 'empireApi' | 'fallback' | 'error' | 'cache'
  error?: string
}

export interface TokenResolutionOptions {
  vaultAddress?: string
  tokenAddress?: string
  fallbackPrefix?: string
}

class TokenInfoResolver {
  private cache = new Map<string, { data: ResolvedTokenInfo; timestamp: number }>()
  private readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes

  /**
   * Comprehensive token metadata resolution with multiple fallback strategies
   * Eliminates all UNKNOWN placeholders by trying multiple data sources
   */
  public async resolveTokenInfo(options: TokenResolutionOptions): Promise<ResolvedTokenInfo> {
    const { vaultAddress, tokenAddress, fallbackPrefix = 'TOKEN' } = options
    
    // Create cache key
    const cacheKey = `${vaultAddress || tokenAddress || 'unknown'}_${fallbackPrefix}`
    
    // Check cache first
    const cached = this.cache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      console.log('📦 Using cached token info for:', cacheKey)
      return cached.data
    }

    try {
      console.log('🔍 Starting comprehensive token metadata resolution:', { vaultAddress, tokenAddress, fallbackPrefix })

      // Strategy 1: Try to get token info from Empire Vault (if vaultAddress provided)
      if (vaultAddress) {
        try {
          console.log('🏛️ Attempting vault-based token resolution...')
          const vaultTokenInfo = await getTokenInfoFromVault(vaultAddress)
          
          const resolvedInfo: ResolvedTokenInfo = {
            symbol: vaultTokenInfo.symbol,
            name: vaultTokenInfo.name,
            logoURI: vaultTokenInfo.logoURI,
            verified: true,
            source: 'vault'
          }
          
          // Cache successful result
          this.cache.set(cacheKey, {
            data: resolvedInfo,
            timestamp: Date.now()
          })
          
          console.log('✅ Token info resolved via Empire Vault:', resolvedInfo)
          return resolvedInfo
          
        } catch (vaultError) {
          console.warn('⚠️ Vault-based token resolution failed:', vaultError)
        }
      }

      // Strategy 2: Try tokenUtils for direct token address resolution
      if (tokenAddress || vaultAddress) {
        try {
          console.log('🔧 Attempting tokenUtils resolution...')
          const address = tokenAddress || vaultAddress!
          const tokenInfo = await tokenUtils.fetchTokenInfo(address)
          
          const resolvedInfo: ResolvedTokenInfo = {
            symbol: tokenInfo.symbol,
            name: tokenInfo.name,
            logoURI: tokenInfo.logoURI,
            verified: true,
            source: 'tokenUtils'
          }
          
          // Cache successful result
          this.cache.set(cacheKey, {
            data: resolvedInfo,
            timestamp: Date.now()
          })
          
          console.log('✅ Token info resolved via tokenUtils:', resolvedInfo)
          return resolvedInfo
          
        } catch (tokenUtilsError) {
          console.warn('⚠️ TokenUtils resolution failed:', tokenUtilsError)
        }
      }

      // Strategy 3: Try Empire API service
      if (tokenAddress) {
        try {
          console.log('🌐 Attempting Empire API resolution...')
          const empireTokenInfo = await empireApiService.getTokenInfo(tokenAddress)
          
          const resolvedInfo: ResolvedTokenInfo = {
            symbol: empireTokenInfo.symbol,
            name: empireTokenInfo.name,
            logoURI: empireTokenInfo.logoURI,
            verified: empireTokenInfo.isVerified,
            source: 'empireApi'
          }
          
          // Cache successful result
          this.cache.set(cacheKey, {
            data: resolvedInfo,
            timestamp: Date.now()
          })
          
          console.log('✅ Token info resolved via Empire API:', resolvedInfo)
          return resolvedInfo
          
        } catch (empireApiError) {
          console.warn('⚠️ Empire API resolution failed:', empireApiError)
        }
      }

      // Strategy 4: Create structured fallback instead of UNKNOWN
      console.warn('⚠️ All token resolution methods failed, creating structured fallback')
      const address = tokenAddress || vaultAddress
      const shortAddress = address ? address.slice(-6) : 'ADDR'
      
      const fallbackInfo: ResolvedTokenInfo = {
        symbol: `${fallbackPrefix}_${shortAddress}`,
        name: `Token ${shortAddress}`,
        logoURI: undefined,
        verified: false,
        source: 'fallback',
        error: 'Token metadata unavailable - all resolution methods failed'
      }
      
      // Cache fallback result with shorter TTL
      this.cache.set(cacheKey, {
        data: fallbackInfo,
        timestamp: Date.now()
      })
      
      console.log('🔄 Structured fallback token info created:', fallbackInfo)
      return fallbackInfo

    } catch (error) {
      console.error('❌ Token info resolution completely failed:', error)
      
      // Final error fallback
      const address = tokenAddress || vaultAddress
      const shortAddress = address ? address.slice(-6) : 'ERROR'
      
      const errorInfo: ResolvedTokenInfo = {
        symbol: `ERROR_${shortAddress}`,
        name: `Resolution Failed (${shortAddress})`,
        logoURI: undefined,
        verified: false,
        source: 'error',
        error: error instanceof Error ? error.message : 'Unknown resolution error'
      }
      
      console.log('💥 Error fallback token info created:', errorInfo)
      return errorInfo
    }
  }

  /**
   * Resolve token info from database room record
   * Handles cases where tokenInfo might be a string, object, or null
   */
  public async resolveTokenInfoFromRoom(room: {
    tokenInfo?: any
    empireVaultAddress: string
    tokenAddress?: string
  }): Promise<ResolvedTokenInfo> {
    try {
      // Check if we already have valid token info
      if (room.tokenInfo && typeof room.tokenInfo === 'object') {
        const tokenInfo = room.tokenInfo as any
        
        // Validate that it's not using UNKNOWN placeholders
        if (tokenInfo.symbol && tokenInfo.name && 
            tokenInfo.symbol !== 'UNKNOWN' && tokenInfo.name !== 'UNKNOWN') {
          return {
            symbol: tokenInfo.symbol,
            name: tokenInfo.name,
            logoURI: tokenInfo.logoURI,
            verified: tokenInfo.verified !== false,
            source: 'cache'
          }
        }
      }

      // If token info is missing or has UNKNOWN values, resolve it
      console.log('🔄 Room has invalid token info, resolving...', { 
        hasTokenInfo: !!room.tokenInfo,
        tokenInfoType: typeof room.tokenInfo,
        empireVaultAddress: room.empireVaultAddress
      })

      return await this.resolveTokenInfo({
        vaultAddress: room.empireVaultAddress,
        tokenAddress: room.tokenAddress,
        fallbackPrefix: 'ROOM'
      })
      
    } catch (error) {
      console.error('❌ Failed to resolve token info from room:', error)
      
      const shortAddress = room.empireVaultAddress.slice(-6)
      return {
        symbol: `ROOM_${shortAddress}`,
        name: `Room Token ${shortAddress}`,
        logoURI: undefined,
        verified: false,
        source: 'error',
        error: error instanceof Error ? error.message : 'Room token resolution failed'
      }
    }
  }

  /**
   * Clear cache (for debugging/testing)
   */
  public clearCache(): void {
    this.cache.clear()
    console.log('🗑️ Token info resolver cache cleared')
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys())
    }
  }
}

// Export singleton instance
export const tokenInfoResolver = new TokenInfoResolver()

// Export convenience functions
export const resolveTokenInfo = (options: TokenResolutionOptions) => 
  tokenInfoResolver.resolveTokenInfo(options)

export const resolveTokenInfoFromRoom = (room: Parameters<typeof tokenInfoResolver.resolveTokenInfoFromRoom>[0]) =>
  tokenInfoResolver.resolveTokenInfoFromRoom(room)

export default tokenInfoResolver