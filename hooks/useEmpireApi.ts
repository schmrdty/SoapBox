//--useEmpireApi.ts
'use client'

import { useState, useEffect, useCallback } from 'react'

// Client-safe type definitions
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

interface UseEmpireLeaderboardOptions {
  limit?: number
  offset?: number
  includeUsernames?: boolean
  autoRefresh?: boolean
  refreshInterval?: number
  onError?: (error: string) => void
  onSuccess?: (data: EmpireVaultData) => void
}

interface UseEmpireVaultSearchOptions {
  vaultType?: 'clanker' | 'glanker'
  limit?: number
  sortBy?: 'tvl' | 'volume' | 'created_at'
  sortOrder?: 'asc' | 'desc'
  autoRefresh?: boolean
  onError?: (error: string) => void
  onSuccess?: (data: EmpireVaultData[]) => void
}

/**
 * Hook for fetching Empire vault leaderboard data
 */
export function useEmpireLeaderboard(
  vaultAddress: string | null,
  options: UseEmpireLeaderboardOptions = {}
) {
  const [data, setData] = useState<EmpireVaultData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastFetched, setLastFetched] = useState<Date | null>(null)

  const {
    limit = 100,
    offset = 0,
    includeUsernames = true,
    autoRefresh = false,
    refreshInterval = 5 * 60 * 1000,
    onError,
    onSuccess
  } = options

  const fetchLeaderboard = useCallback(async () => {
    if (!vaultAddress) return

    setIsLoading(true)
    setError(null)

    try {
      console.log('🔍 Fetching Empire leaderboard via API:', vaultAddress)

      const params = new URLSearchParams({
        vault: vaultAddress,
        limit: limit.toString(),
        offset: offset.toString(),
        includeUsernames: includeUsernames.toString()
      })

      const response = await fetch(`/api/empire-leaderboard?${params}`)

      if (!response.ok) {
        throw new Error(`Leaderboard API request failed: ${response.status} ${response.statusText}`)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Leaderboard request failed')
      }

      const leaderboardData: EmpireVaultData = result.data
      
      setData(leaderboardData)
      setLastFetched(new Date())
      
      console.log('✅ Empire leaderboard fetched successfully:', {
        vault: vaultAddress,
        holdersCount: leaderboardData.leaderboard.length,
        tokenSymbol: leaderboardData.tokenInfo.symbol
      })

      if (onSuccess) {
        onSuccess(leaderboardData)
      }

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch leaderboard'
      
      setError(errorMsg)
      setData(null)
      
      console.error('❌ Failed to fetch Empire leaderboard:', err)
      
      if (onError) {
        onError(errorMsg)
      }
    } finally {
      setIsLoading(false)
    }
  }, [vaultAddress, limit, offset, includeUsernames, onError, onSuccess])

  const refetch = useCallback(() => {
    fetchLeaderboard()
  }, [fetchLeaderboard])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  // Auto-fetch on mount and when dependencies change
  useEffect(() => {
    if (vaultAddress) {
      fetchLeaderboard()
    } else {
      setData(null)
      setError(null)
      setLastFetched(null)
    }
  }, [fetchLeaderboard])

  // Auto-refresh functionality
  useEffect(() => {
    if (!autoRefresh || !refreshInterval || !vaultAddress) return

    const interval = setInterval(() => {
      fetchLeaderboard()
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval, fetchLeaderboard, vaultAddress])

  return {
    data,
    isLoading,
    error,
    lastFetched,
    refetch,
    clearError,
    isReady: !!vaultAddress
  }
}

/**
 * Hook for searching Empire vaults
 */
export function useEmpireVaultSearch(
  query: string,
  options: UseEmpireVaultSearchOptions = {}
) {
  const [data, setData] = useState<EmpireVaultData[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastFetched, setLastFetched] = useState<Date | null>(null)

  const {
    vaultType,
    limit = 20,
    sortBy = 'tvl',
    sortOrder = 'desc',
    autoRefresh = false,
    onError,
    onSuccess
  } = options

  const searchVaults = useCallback(async () => {
    if (!query.trim()) {
      setData([])
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      console.log('🔍 Searching Empire vaults via API:', query)

      const params = new URLSearchParams({
        q: query.trim(),
        limit: limit.toString(),
        sortBy,
        sortOrder
      })

      if (vaultType) {
        params.append('vaultType', vaultType)
      }

      const response = await fetch(`/api/empire-vaults?${params}`)

      if (!response.ok) {
        throw new Error(`Vault search API request failed: ${response.status}`)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Vault search failed')
      }

      const vaultData: EmpireVaultData[] = result.data || []
      
      setData(vaultData)
      setLastFetched(new Date())
      
      console.log('✅ Empire vault search completed:', {
        query,
        resultsCount: vaultData.length
      })

      if (onSuccess) {
        onSuccess(vaultData)
      }

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to search vaults'
      
      setError(errorMsg)
      setData([])
      
      console.error('❌ Failed to search Empire vaults:', err)
      
      if (onError) {
        onError(errorMsg)
      }
    } finally {
      setIsLoading(false)
    }
  }, [query, vaultType, limit, sortBy, sortOrder, onError, onSuccess])

  const clearSearch = useCallback(() => {
    setData([])
    setError(null)
    setLastFetched(null)
  }, [])

  // Auto-search when query changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchVaults()
    }, 300) // Debounce search

    return () => clearTimeout(timeoutId)
  }, [searchVaults])

  // Auto-refresh functionality
  useEffect(() => {
    if (!autoRefresh || !query.trim()) return

    const interval = setInterval(() => {
      searchVaults()
    }, 5 * 60 * 1000) // Refresh every 5 minutes

    return () => clearInterval(interval)
  }, [autoRefresh, searchVaults, query])

  return {
    data,
    isLoading,
    error,
    lastFetched,
    refetch: searchVaults,
    clearSearch,
    clearError: () => setError(null),
    isReady: query.trim().length > 0
  }
}

/**
 * Hook for fetching Empire token info
 */
export function useEmpireTokenInfo(tokenAddress: string | null) {
  const [data, setData] = useState<EmpireTokenInfo | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastFetched, setLastFetched] = useState<Date | null>(null)

  const fetchTokenInfo = useCallback(async () => {
    if (!tokenAddress) return

    setIsLoading(true)
    setError(null)

    try {
      console.log('🔍 Fetching Empire token info via API:', tokenAddress)

      const response = await fetch(`/api/empire-token-info?address=${encodeURIComponent(tokenAddress)}`)

      if (!response.ok) {
        throw new Error(`Token info API request failed: ${response.status}`)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Token info request failed')
      }

      const tokenInfo: EmpireTokenInfo = result.data
      
      setData(tokenInfo)
      setLastFetched(new Date())
      
      console.log('✅ Empire token info fetched successfully:', tokenInfo)

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch token info'
      
      setError(errorMsg)
      setData(null)
      
      console.error('❌ Failed to fetch Empire token info:', err)
    } finally {
      setIsLoading(false)
    }
  }, [tokenAddress])

  // Auto-fetch when token address changes
  useEffect(() => {
    if (tokenAddress) {
      fetchTokenInfo()
    } else {
      setData(null)
      setError(null)
      setLastFetched(null)
    }
  }, [fetchTokenInfo])

  return {
    data,
    isLoading,
    error,
    lastFetched,
    refetch: fetchTokenInfo,
    clearError: () => setError(null),
    isReady: !!tokenAddress
  }
}

/**
 * Hook for fetching personal Empire stats
 */
export function useEmpirePersonalStats(
  empireTokenAddress: string | null,
  userAddress: string | null
) {
  const [data, setData] = useState<EmpirePersonalStats | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchPersonalStats = useCallback(async () => {
    if (!empireTokenAddress || !userAddress) return

    setIsLoading(true)
    setError(null)

    try {
      console.log('🔍 Fetching Empire personal stats via API:', { empireTokenAddress, userAddress })

      const response = await fetch('/api/empire-personal-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empireTokenAddress,
          userAddress
        })
      })

      if (!response.ok) {
        throw new Error(`Personal stats API request failed: ${response.status}`)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Personal stats request failed')
      }

      const personalStats: EmpirePersonalStats = result.data
      
      setData(personalStats)
      
      console.log('✅ Empire personal stats fetched successfully:', personalStats)

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch personal stats'
      
      setError(errorMsg)
      setData(null)
      
      console.error('❌ Failed to fetch Empire personal stats:', err)
    } finally {
      setIsLoading(false)
    }
  }, [empireTokenAddress, userAddress])

  // Auto-fetch when dependencies change
  useEffect(() => {
    if (empireTokenAddress && userAddress) {
      fetchPersonalStats()
    } else {
      setData(null)
      setError(null)
    }
  }, [fetchPersonalStats])

  return {
    data,
    isLoading,
    error,
    refetch: fetchPersonalStats,
    clearError: () => setError(null),
    isReady: !!(empireTokenAddress && userAddress)
  }
}