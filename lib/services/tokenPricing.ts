//--src/lib/services/tokenPricing.ts
// Server-side token pricing service

import type { EmpireVaultData } from './empireApi'

export interface TokenInfo {
  address: string
  name: string
  symbol: string
  decimals: number
  logoURI?: string
  verified: boolean
}

export interface TokenPrice {
  address: string
  symbol: string
  price: number
  priceChange24h: number
  volume24h: number
  marketCap?: number
  lastUpdated: Date
}

export interface TokenMetadata {
  address: string
  name: string
  symbol: string
  decimals: number
  totalSupply: string
  logoURI?: string
  description?: string
  website?: string
  twitter?: string
  telegram?: string
  verified: boolean
  tags: string[]
}

export interface TokenValidationResult {
  isValid: boolean
  address: string
  checksumAddress?: string
  error?: string
  tokenInfo?: TokenInfo
}

interface ZeroXTokenResponse {
  address: string
  name: string
  symbol: string
  decimals: number
  logoURI?: string
}

interface ZeroXPriceResponse {
  price: string
  estimatedPriceImpact: string
  sources: Array<{
    name: string
    proportion: string
  }>
}

interface CoinGeckoTokenResponse {
  id: string
  symbol: string
  name: string
  image: {
    thumb: string
    small: string
    large: string
  }
  market_data: {
    current_price: {
      usd: number
    }
    price_change_percentage_24h: number
    total_volume: {
      usd: number
    }
    market_cap: {
      usd: number
    }
  }
  description: {
    en: string
  }
  links: {
    homepage: string[]
    twitter_screen_name: string
    telegram_channel_identifier: string
  }
  contract_address: string
  verified: boolean
}

class TokenPricingService {
  private tokenInfoCache = new Map<string, { data: TokenInfo; timestamp: number }>()
  private priceCache = new Map<string, { data: TokenPrice; timestamp: number }>()
  private metadataCache = new Map<string, { data: TokenMetadata; timestamp: number }>()
  
  private readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes
  private readonly PRICE_CACHE_TTL = 30 * 1000 // 30 seconds for prices
  
  private readonly BASE_CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '8453')
  private readonly ZEROEX_API_BASE = 'https://api.0x.org'
  private readonly COINGECKO_API_BASE = 'https://api.coingecko.com/api/v3'

  private isValidAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address)
  }

  private toChecksumAddress(address: string): string {
    if (!this.isValidAddress(address)) {
      throw new Error('Invalid address format')
    }
    
    // Simple checksum implementation
    const addr = address.toLowerCase().replace('0x', '')
    let checksumAddress = '0x'
    
    for (let i = 0; i < addr.length; i++) {
      const char = addr[i]
      if (parseInt(char, 16) >= 8) {
        checksumAddress += char.toUpperCase()
      } else {
        checksumAddress += char
      }
    }
    
    return checksumAddress
  }

  private async makeProxyRequest<T>(
    protocol: string,
    origin: string,
    path: string,
    method: 'GET' | 'POST' = 'GET',
    headers: Record<string, string> = {},
    body?: any
  ): Promise<T> {
    const requestBody: {
      protocol: string
      origin: string
      path: string
      method: 'GET' | 'POST'
      headers: Record<string, string>
      body?: any
    } = {
      protocol,
      origin,
      path,
      method,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...headers
      }
    }

    if (body && method !== 'GET') {
      requestBody.body = body
    }

    const response = await fetch('/api/proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Proxy request failed: ${response.status} ${errorText}`)
    }

    const data = await response.json()
    
    if (!data.success) {
      throw new Error(data.error || 'Proxy request failed')
    }

    return data.data as T
  }

  public async validateTokenAddress(address: string): Promise<TokenValidationResult> {
    try {
      if (!address || typeof address !== 'string') {
        return {
          isValid: false,
          address,
          error: 'Address is required'
        }
      }

      const trimmedAddress = address.trim()
      
      if (!this.isValidAddress(trimmedAddress)) {
        return {
          isValid: false,
          address: trimmedAddress,
          error: 'Invalid address format'
        }
      }

      const checksumAddress = this.toChecksumAddress(trimmedAddress)
      
      // Try to get token info to validate it exists
      try {
        const tokenInfo = await this.getTokenInfo(checksumAddress)
        return {
          isValid: true,
          address: trimmedAddress,
          checksumAddress,
          tokenInfo
        }
      } catch (error) {
        return {
          isValid: false,
          address: trimmedAddress,
          checksumAddress,
          error: 'Token not found or invalid'
        }
      }
    } catch (error) {
      return {
        isValid: false,
        address,
        error: error instanceof Error ? error.message : 'Validation failed'
      }
    }
  }

  public async getTokenInfo(address: string): Promise<TokenInfo> {
    const checksumAddress = this.toChecksumAddress(address)
    const cacheKey = `info_${checksumAddress}`
    
    // Check cache
    const cached = this.tokenInfoCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data
    }

    try {
      // Try 0x API first with timeout and better error handling
      console.log(`🔍 Fetching token info via proxy for: ${checksumAddress}`)
      
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('0x API timeout')), 3000) // 3 second timeout
      )
      
      const zeroXData = await Promise.race([
        this.makeProxyRequest<ZeroXTokenResponse>(
          'https',
          'api.0x.org',
          `/swap/v1/tokens/${checksumAddress}?chainId=${this.BASE_CHAIN_ID}`,
          'GET'
        ),
        timeoutPromise
      ])

      const tokenInfo: TokenInfo = {
        address: checksumAddress,
        name: zeroXData.name,
        symbol: zeroXData.symbol,
        decimals: zeroXData.decimals,
        logoURI: zeroXData.logoURI,
        verified: true
      }

      // Cache the result
      this.tokenInfoCache.set(cacheKey, {
        data: tokenInfo,
        timestamp: Date.now()
      })

      return tokenInfo
    } catch (error) {
      // Fallback: try to get basic info from contract
      try {
        const fallbackInfo: TokenInfo = {
          address: checksumAddress,
          name: null as any,
          symbol: null as any,
          decimals: 18,
          verified: false,
          // Add metadata to indicate this is a fallback
          source: 'fallback',
          error: 'Token info unavailable - API failed and on-chain lookup not available'
        } as TokenInfo & { source: string; error: string }

        // Cache fallback for shorter time
        this.tokenInfoCache.set(cacheKey, {
          data: fallbackInfo,
          timestamp: Date.now() - (this.CACHE_TTL * 0.8) // Expire sooner
        })

        return fallbackInfo
      } catch (fallbackError) {
        throw new Error(`Failed to get token info: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }
  }

  public async getTokenPrice(address: string): Promise<TokenPrice> {
    const checksumAddress = this.toChecksumAddress(address)
    const cacheKey = `price_${checksumAddress}`
    
    // Check cache with shorter TTL for prices
    const cached = this.priceCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < this.PRICE_CACHE_TTL) {
      return cached.data
    }

    try {
      // Get token info first
      const tokenInfo = await this.getTokenInfo(checksumAddress)
      
      // Try 0x API for price
      const priceData = await this.makeProxyRequest<ZeroXPriceResponse>(
        'https',
        'api.0x.org',
        `/swap/v1/price?sellToken=${checksumAddress}&buyToken=${process.env.NEXT_PUBLIC_BASE_NATIVE_TOKEN || '0x4200000000000000000000000000000000000006'}&sellAmount=1000000000000000000&chainId=${this.BASE_CHAIN_ID}`,
        'GET'
      )

      const price = parseFloat(priceData.price)
      
      const tokenPrice: TokenPrice = {
        address: checksumAddress,
        symbol: tokenInfo.symbol,
        price,
        priceChange24h: 0, // 0x doesn't provide this directly
        volume24h: 0,
        lastUpdated: new Date()
      }

      // Cache the result
      this.priceCache.set(cacheKey, {
        data: tokenPrice,
        timestamp: Date.now()
      })

      return tokenPrice
    } catch (error) {
      // Fallback with zero price
      const tokenInfo = await this.getTokenInfo(checksumAddress)
      
      const fallbackPrice: TokenPrice = {
        address: checksumAddress,
        symbol: tokenInfo.symbol,
        price: 0,
        priceChange24h: 0,
        volume24h: 0,
        lastUpdated: new Date()
      }

      return fallbackPrice
    }
  }

  public async getTokenMetadata(address: string): Promise<TokenMetadata> {
    const checksumAddress = this.toChecksumAddress(address)
    const cacheKey = `metadata_${checksumAddress}`
    
    // Check cache
    const cached = this.metadataCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data
    }

    try {
      // Get basic token info first
      const tokenInfo = await this.getTokenInfo(checksumAddress)
      
      // Try to get additional metadata from CoinGecko
      let metadata: TokenMetadata = {
        address: checksumAddress,
        name: tokenInfo.name,
        symbol: tokenInfo.symbol,
        decimals: tokenInfo.decimals,
        totalSupply: '0',
        logoURI: tokenInfo.logoURI,
        verified: tokenInfo.verified,
        tags: []
      }

      try {
        // Search CoinGecko by contract address
        const coinGeckoData = await this.makeProxyRequest<CoinGeckoTokenResponse>(
          'https',
          'api.coingecko.com',
          `/api/v3/coins/base/contract/${checksumAddress}`,
          'GET'
        )

        metadata = {
          ...metadata,
          name: coinGeckoData.name,
          symbol: coinGeckoData.symbol.toUpperCase(),
          logoURI: coinGeckoData.image?.large || coinGeckoData.image?.small || metadata.logoURI,
          description: coinGeckoData.description?.en,
          website: coinGeckoData.links?.homepage?.[0],
          twitter: coinGeckoData.links?.twitter_screen_name,
          telegram: coinGeckoData.links?.telegram_channel_identifier,
          verified: coinGeckoData.verified || metadata.verified
        }
      } catch (coinGeckoError) {
        console.warn('CoinGecko metadata fetch failed:', coinGeckoError)
        // Continue with basic metadata
      }

      // Cache the result
      this.metadataCache.set(cacheKey, {
        data: metadata,
        timestamp: Date.now()
      })

      return metadata
    } catch (error) {
      throw new Error(`Failed to get token metadata: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  public async getMultipleTokenPrices(addresses: string[]): Promise<TokenPrice[]> {
    const promises = addresses.map(address => 
      this.getTokenPrice(address).catch(error => {
        console.warn(`Failed to get price for ${address}:`, error)
        return null
      })
    )

    const results = await Promise.all(promises)
    return results.filter((price): price is TokenPrice => price !== null)
  }

  public async searchTokens(query: string, limit: number = 10): Promise<TokenInfo[]> {
    try {
      // If query looks like an address, validate and return it
      if (query.startsWith('0x') && query.length === 42) {
        const validation = await this.validateTokenAddress(query)
        if (validation.isValid && validation.tokenInfo) {
          return [validation.tokenInfo]
        }
      }

      // For now, return empty array as we don't have a search endpoint
      // This could be enhanced with a token list or search API
      return []
    } catch (error) {
      console.error('Token search failed:', error)
      return []
    }
  }

  public clearCache(): void {
    this.tokenInfoCache.clear()
    this.priceCache.clear()
    this.metadataCache.clear()
  }

  public getCacheStats(): {
    tokenInfoCacheSize: number
    priceCacheSize: number
    metadataCacheSize: number
  } {
    return {
      tokenInfoCacheSize: this.tokenInfoCache.size,
      priceCacheSize: this.priceCache.size,
      metadataCacheSize: this.metadataCache.size
    }
  }
}

// Export singleton instance
export const tokenPricingService = new TokenPricingService()

// Export convenience functions
export const validateTokenAddress = (address: string) => 
  tokenPricingService.validateTokenAddress(address)

export const getTokenInfo = (address: string) => 
  tokenPricingService.getTokenInfo(address)

export const getTokenPrice = (address: string) => 
  tokenPricingService.getTokenPrice(address)

export const getTokenMetadata = (address: string) => 
  tokenPricingService.getTokenMetadata(address)

export const getMultipleTokenPrices = (addresses: string[]) => 
  tokenPricingService.getMultipleTokenPrices(addresses)

export const searchTokens = (query: string, limit?: number) => 
  tokenPricingService.searchTokens(query, limit)

export default tokenPricingService