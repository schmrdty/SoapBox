//--lib/utils/basenameResolver.ts
import { createPublicClient, http, isAddress } from 'viem';
import { base, mainnet } from 'viem/chains';
import { createResilientPublicClient } from '@/lib/rpc-config';

export interface BasenameResolution {
  basename: string;
  address: string;
  resolved: boolean;
  cached: boolean;
  timestamp: number;
}

interface CacheEntry {
  address: string;
  timestamp: number;
}

// Cache for resolved basenames (24 hour TTL)
const basenameCache = new Map<string, CacheEntry>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Public clients for ENS resolution
const mainnetClient = createPublicClient({
  chain: mainnet,
  transport: http(),
});

const baseClient = createResilientPublicClient();

/**
 * Check if a string is a valid basename format
 */
export function isValidBasename(name: string): boolean {
  if (!name || typeof name !== 'string') return false;
  
  // Remove leading @ if present
  const cleanName = name.startsWith('@') ? name.slice(1) : name;
  
  // Check for .base.eth or .eth suffix
  return cleanName.endsWith('.base.eth') || cleanName.endsWith('.eth');
}

/**
 * Get cached address for a basename if available and not expired
 */
export function getCachedAddress(basename: string): string | null {
  const normalizedName = basename.toLowerCase();
  const cached = basenameCache.get(normalizedName);
  
  if (!cached) return null;
  
  // Check if cache entry is expired
  if (Date.now() - cached.timestamp > CACHE_TTL) {
    basenameCache.delete(normalizedName);
    return null;
  }
  
  return cached.address;
}

/**
 * Resolve a basename to wallet address using ENS
 */
export async function resolveBasename(basename: string): Promise<BasenameResolution> {
  const normalizedName = basename.toLowerCase();
  const cleanName = normalizedName.startsWith('@') ? normalizedName.slice(1) : normalizedName;
  
  // Validate basename format
  if (!isValidBasename(cleanName)) {
    return {
      basename: cleanName,
      address: '',
      resolved: false,
      cached: false,
      timestamp: Date.now(),
    };
  }
  
  // Check cache first
  const cachedAddress = getCachedAddress(cleanName);
  if (cachedAddress) {
    return {
      basename: cleanName,
      address: cachedAddress,
      resolved: true,
      cached: true,
      timestamp: Date.now(),
    };
  }
  
  try {
    let resolvedAddress: string | null = null;
    
    // Try resolving with Base client for .base.eth names
    if (cleanName.endsWith('.base.eth')) {
      try {
        resolvedAddress = await baseClient.getEnsAddress({
          name: cleanName,
        });
      } catch (error) {
        console.log(`Base ENS resolution failed for ${cleanName}, trying mainnet...`);
      }
    }
    
    // Fallback to mainnet ENS for .eth names or if Base resolution failed
    if (!resolvedAddress) {
      try {
        resolvedAddress = await mainnetClient.getEnsAddress({
          name: cleanName,
        });
      } catch (error) {
        console.error(`Mainnet ENS resolution failed for ${cleanName}:`, error);
      }
    }
    
    // Validate resolved address
    if (resolvedAddress && isAddress(resolvedAddress)) {
      // Cache the successful resolution
      basenameCache.set(cleanName, {
        address: resolvedAddress,
        timestamp: Date.now(),
      });
      
      return {
        basename: cleanName,
        address: resolvedAddress,
        resolved: true,
        cached: false,
        timestamp: Date.now(),
      };
    }
    
    // Resolution failed
    return {
      basename: cleanName,
      address: '',
      resolved: false,
      cached: false,
      timestamp: Date.now(),
    };
    
  } catch (error) {
    console.error(`Error resolving basename ${cleanName}:`, error);
    
    return {
      basename: cleanName,
      address: '',
      resolved: false,
      cached: false,
      timestamp: Date.now(),
    };
  }
}

/**
 * Batch resolve multiple basenames
 */
export async function resolveMultipleBasenames(basenames: string[]): Promise<BasenameResolution[]> {
  const promises = basenames.map(basename => resolveBasename(basename));
  return Promise.all(promises);
}

/**
 * Clear expired entries from cache
 */
export function clearExpiredCache(): number {
  const now = Date.now();
  let cleared = 0;
  
  for (const [key, entry] of basenameCache.entries()) {
    if (now - entry.timestamp > CACHE_TTL) {
      basenameCache.delete(key);
      cleared++;
    }
  }
  
  return cleared;
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { size: number; entries: string[] } {
  return {
    size: basenameCache.size,
    entries: Array.from(basenameCache.keys()),
  };
}

/**
 * Clear all cache entries
 */
export function clearCache(): void {
  basenameCache.clear();
}