//--src/lib/services/authorizationCache.ts
interface AuthorizationCacheEntry {
  empireVault: string;
  authorizedAddresses: string[];
  timestamp: number;
  walletAddress: string;
  isAuthorized: boolean;
}

class AuthorizationCache {
  private cache = new Map<string, AuthorizationCacheEntry>();
  private readonly TTL = 24 * 60 * 60 * 1000; // 24 hours

  private getCacheKey(empireVault: string, walletAddress: string): string {
    return `${empireVault.toLowerCase()}-${walletAddress.toLowerCase()}`;
  }

  /**
   * Cache authorized addresses for an empire vault + wallet combination
   */
  setAuthorization(
    empireVault: string,
    walletAddress: string,
    authorizedAddresses: string[],
    isAuthorized: boolean
  ): void {
    const key = this.getCacheKey(empireVault, walletAddress);
    const entry: AuthorizationCacheEntry = {
      empireVault: empireVault.toLowerCase(),
      authorizedAddresses: authorizedAddresses.map(addr => addr.toLowerCase()),
      timestamp: Date.now(),
      walletAddress: walletAddress.toLowerCase(),
      isAuthorized,
    };
    
    this.cache.set(key, entry);
    
    console.log(`💾 Cached authorization for ${walletAddress} on vault ${empireVault}: ${isAuthorized ? 'AUTHORIZED' : 'NOT AUTHORIZED'}`);
  }

  /**
   * Get cached authorization - returns null if expired or not found
   */
  getAuthorization(empireVault: string, walletAddress: string): AuthorizationCacheEntry | null {
    const key = this.getCacheKey(empireVault, walletAddress);
    const entry = this.cache.get(key);

    if (!entry) {
      console.log(`📭 No cached authorization found for ${walletAddress} on vault ${empireVault}`);
      return null;
    }

    const isExpired = Date.now() - entry.timestamp > this.TTL;
    if (isExpired) {
      this.cache.delete(key);
      console.log(`⏰ Cached authorization expired for ${walletAddress} on vault ${empireVault}`);
      return null;
    }

    console.log(`💾 Using cached authorization for ${walletAddress} on vault ${empireVault}: ${entry.isAuthorized ? 'AUTHORIZED' : 'NOT AUTHORIZED'}`);
    return entry;
  }

  /**
   * Clear all cached entries (useful for testing)
   */
  clear(): void {
    this.cache.clear();
    console.log('🗑️ Cleared authorization cache');
  }

  /**
   * Get cache statistics
   */
  getStats(): { totalEntries: number; activeEntries: number; expiredEntries: number } {
    const totalEntries = this.cache.size;
    let activeEntries = 0;
    let expiredEntries = 0;

    const now = Date.now();
    for (const entry of this.cache.values()) {
      if (now - entry.timestamp > this.TTL) {
        expiredEntries++;
      } else {
        activeEntries++;
      }
    }

    return { totalEntries, activeEntries, expiredEntries };
  }

  /**
   * Clean up expired entries
   */
  cleanup(): number {
    const now = Date.now();
    let removedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.TTL) {
        this.cache.delete(key);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      console.log(`🧹 Cleaned up ${removedCount} expired authorization cache entries`);
    }

    return removedCount;
  }
}

// Singleton instance
export const authorizationCache = new AuthorizationCache();

// Cleanup interval (run every hour)
if (typeof window === 'undefined') {
  // Server-side only
  setInterval(() => {
    authorizationCache.cleanup();
  }, 60 * 60 * 1000); // 1 hour
