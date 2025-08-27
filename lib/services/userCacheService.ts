//--src/lib/services/userCacheService.ts
// Dynamic import for Redis to avoid SSR issues
let redis: any = null

// Initialize Redis connection
const initRedis = async (): Promise<void> => {
  if (typeof window !== 'undefined') return // Client-side guard
  
  try {
    if (process.env.REDIS_URL && !redis) {
      const Redis = (await import('ioredis')).default
      redis = new Redis(process.env.REDIS_URL)
      
      redis.on('error', (error: Error) => {
        console.warn('Redis connection error:', error.message)
        redis = null
      })
      
      await redis.ping()
      console.log('✅ Redis connected for user cache service')
    }
  } catch (error) {
    console.warn('⚠️ Redis initialization failed for user cache:', error)
    redis = null
  }
}
import type { AuthorizationResult } from './empireAuth'

export interface UserCacheEntry {
  userAddress: string
  vaultAddress: string
  authResult: AuthorizationResult
  balance: string
  rank?: number
  isPayingUser: boolean
  lastPurchaseDate?: string
  cachedAt: string
  expiresAt: string
}

export class UserCacheService {
  private readonly defaultCacheDays = 3
  private readonly payingUserCacheDays = 30
  private readonly keyPrefix = 'soapbox:user_cache:'

  /**
   * Generate cache key for user-vault pair
   */
  private getCacheKey(userAddress: string, vaultAddress: string): string {
    return `${this.keyPrefix}${userAddress.toLowerCase()}_${vaultAddress.toLowerCase()}`
  }

  /**
   * Calculate expiration date based on user payment status
   */
  private calculateExpiration(isPayingUser: boolean): string {
    const days = isPayingUser ? this.payingUserCacheDays : this.defaultCacheDays
    const expirationDate = new Date()
    expirationDate.setDate(expirationDate.getDate() + days)
    return expirationDate.toISOString()
  }

  /**
   * Cache user authorization data
   */
  async cacheUserAuth(
    userAddress: string,
    vaultAddress: string,
    authResult: AuthorizationResult,
    balance: string,
    rank?: number,
    isPayingUser: boolean = false
  ): Promise<void> {
    try {
      const cacheKey = this.getCacheKey(userAddress, vaultAddress)
      const now = new Date().toISOString()
      
      const cacheEntry: UserCacheEntry = {
        userAddress: userAddress.toLowerCase(),
        vaultAddress: vaultAddress.toLowerCase(),
        authResult,
        balance,
        rank,
        isPayingUser,
        lastPurchaseDate: isPayingUser ? now : undefined,
        cachedAt: now,
        expiresAt: this.calculateExpiration(isPayingUser)
      }

      // Calculate TTL in seconds for Redis
      const expirationTime = new Date(cacheEntry.expiresAt).getTime()
      const currentTime = Date.now()
      const ttlSeconds = Math.floor((expirationTime - currentTime) / 1000)

      await initRedis()
      if (redis) {
        await redis.setex(cacheKey, ttlSeconds, JSON.stringify(cacheEntry))
        console.log(`✅ User auth cached for ${isPayingUser ? '30' : '3'} days:`, {
          user: userAddress.slice(0, 6) + '...',
          vault: vaultAddress.slice(0, 6) + '...',
          isPayingUser,
          expiresAt: cacheEntry.expiresAt
        })
      }
    } catch (error) {
      console.error('❌ Failed to cache user auth:', error)
    }
  }

  /**
   * Get cached user authorization data
   */
  async getCachedUserAuth(
    userAddress: string,
    vaultAddress: string
  ): Promise<UserCacheEntry | null> {
    try {
      const cacheKey = this.getCacheKey(userAddress, vaultAddress)
      
      if (!redis) {
        return null
      }

      const cached = await redis.get(cacheKey)
      if (!cached) {
        return null
      }

      const cacheEntry: UserCacheEntry = JSON.parse(cached)
      
      // Check if cache is still valid
      const now = new Date()
      const expiresAt = new Date(cacheEntry.expiresAt)
      
      if (now >= expiresAt) {
        // Cache expired, remove it
        await redis.del(cacheKey)
        return null
      }

      console.log('✅ Retrieved cached user auth:', {
        user: userAddress.slice(0, 6) + '...',
        vault: vaultAddress.slice(0, 6) + '...',
        isPayingUser: cacheEntry.isPayingUser,
        remainingDays: Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      })

      return cacheEntry
    } catch (error) {
      console.error('❌ Failed to get cached user auth:', error)
      return null
    }
  }

  /**
   * Update user to paying status and extend cache to 30 days
   */
  async markUserAsPaying(
    userAddress: string,
    vaultAddress: string
  ): Promise<void> {
    try {
      // Get existing cache entry
      const existing = await this.getCachedUserAuth(userAddress, vaultAddress)
      if (!existing) {
        console.warn('⚠️ No existing cache entry to mark as paying user')
        return
      }

      // Update the entry with paying user status and new expiration
      const updatedEntry: UserCacheEntry = {
        ...existing,
        isPayingUser: true,
        lastPurchaseDate: new Date().toISOString(),
        expiresAt: this.calculateExpiration(true)
      }

      // Re-cache with new 30-day expiration
      const cacheKey = this.getCacheKey(userAddress, vaultAddress)
      const expirationTime = new Date(updatedEntry.expiresAt).getTime()
      const currentTime = Date.now()
      const ttlSeconds = Math.floor((expirationTime - currentTime) / 1000)

      if (redis) {
        await redis.setex(cacheKey, ttlSeconds, JSON.stringify(updatedEntry))
        console.log('✅ User marked as paying, cache extended to 30 days:', {
          user: userAddress.slice(0, 6) + '...',
          vault: vaultAddress.slice(0, 6) + '...',
          newExpiresAt: updatedEntry.expiresAt
        })
      }
    } catch (error) {
      console.error('❌ Failed to mark user as paying:', error)
    }
  }

  /**
   * Clear specific user cache (useful for forced refresh)
   */
  async clearUserCache(
    userAddress: string,
    vaultAddress: string
  ): Promise<void> {
    try {
      const cacheKey = this.getCacheKey(userAddress, vaultAddress)
      
      if (redis) {
        await redis.del(cacheKey)
        console.log('✅ User cache cleared:', {
          user: userAddress.slice(0, 6) + '...',
          vault: vaultAddress.slice(0, 6) + '...'
        })
      }
    } catch (error) {
      console.error('❌ Failed to clear user cache:', error)
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    totalCachedUsers: number
    payingUsers: number
    regularUsers: number
  }> {
    try {
      if (!redis) {
        return { totalCachedUsers: 0, payingUsers: 0, regularUsers: 0 }
      }

      const keys = await redis.keys(`${this.keyPrefix}*`)
      let payingUsers = 0
      let regularUsers = 0

      for (const key of keys) {
        try {
          const cached = await redis.get(key)
          if (cached) {
            const entry: UserCacheEntry = JSON.parse(cached)
            if (entry.isPayingUser) {
              payingUsers++
            } else {
              regularUsers++
            }
          }
        } catch (error) {
          // Skip invalid entries
          continue
        }
      }

      return {
        totalCachedUsers: keys.length,
        payingUsers,
        regularUsers
      }
    } catch (error) {
      console.error('❌ Failed to get cache stats:', error)
      return { totalCachedUsers: 0, payingUsers: 0, regularUsers: 0 }
    }
  }

  /**
   * Clean expired cache entries (maintenance function)
   */
  async cleanExpiredEntries(): Promise<number> {
    try {
      if (!redis) {
        return 0
      }

      const keys = await redis.keys(`${this.keyPrefix}*`)
      let cleanedCount = 0
      const now = new Date()

      for (const key of keys) {
        try {
          const cached = await redis.get(key)
          if (cached) {
            const entry: UserCacheEntry = JSON.parse(cached)
            const expiresAt = new Date(entry.expiresAt)
            
            if (now >= expiresAt) {
              await redis.del(key)
              cleanedCount++
            }
          }
        } catch (error) {
          // Remove invalid entries
          await redis.del(key)
          cleanedCount++
        }
      }

      if (cleanedCount > 0) {
        console.log(`✅ Cleaned ${cleanedCount} expired cache entries`)
      }

      return cleanedCount
    } catch (error) {
      console.error('❌ Failed to clean expired entries:', error)
      return 0
    }
  }
}

// Export singleton instance
export const userCacheService = new UserCacheService()
export default userCacheService