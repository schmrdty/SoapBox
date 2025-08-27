//--useTokenInfo.ts
'use client'

import { useState, useEffect, useCallback } from 'react'
import type { ResolvedTokenInfo } from '@/lib/services/tokenInfoResolver'

interface UseTokenInfoOptions {
  autoRefresh?: boolean
  refreshInterval?: number
  onError?: (error: string) => void
  onSuccess?: (data: ResolvedTokenInfo) => void
}

interface TokenInfoState {
  data: ResolvedTokenInfo | null
  isLoading: boolean
  error: string | null
  lastFetched: Date | null
}

export function useTokenInfo(
  options: { vaultAddress?: string; tokenAddress?: string; fallbackPrefix?: string },
  hooks: UseTokenInfoOptions = {}
) {
  const [state, setState] = useState<TokenInfoState>({
    data: null,
    isLoading: false,
    error: null,
    lastFetched: null
  })

  const { vaultAddress, tokenAddress, fallbackPrefix = 'TOKEN' } = options
  const { autoRefresh = false, refreshInterval = 5 * 60 * 1000, onError, onSuccess } = hooks

  const fetchTokenInfo = useCallback(async () => {
    if (!vaultAddress && !tokenAddress) {
      setState(prev => ({
        ...prev,
        error: 'Either vaultAddress or tokenAddress is required',
        isLoading: false
      }))
      return
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      console.log('🔍 Fetching token info via API:', { vaultAddress, tokenAddress, fallbackPrefix })

      const response = await fetch('/api/token-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vaultAddress,
          tokenAddress,
          fallbackPrefix
        })
      })

      if (!response.ok) {
        throw new Error(`Token info API request failed: ${response.status} ${response.statusText}`)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Token info request failed')
      }

      const tokenInfo: ResolvedTokenInfo = result.data
      
      setState({
        data: tokenInfo,
        isLoading: false,
        error: null,
        lastFetched: new Date()
      })

      console.log('✅ Token info fetched successfully:', tokenInfo)
      
      if (onSuccess) {
        onSuccess(tokenInfo)
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to fetch token info'
      
      setState({
        data: null,
        isLoading: false,
        error: errorMsg,
        lastFetched: new Date()
      })

      console.error('❌ Failed to fetch token info:', error)
      
      if (onError) {
        onError(errorMsg)
      }
    }
  }, [vaultAddress, tokenAddress, fallbackPrefix, onError, onSuccess])

  const refetch = useCallback(() => {
    fetchTokenInfo()
  }, [fetchTokenInfo])

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }))
  }, [])

  // Auto-fetch on mount and when dependencies change
  useEffect(() => {
    if (vaultAddress || tokenAddress) {
      fetchTokenInfo()
    }
  }, [fetchTokenInfo])

  // Auto-refresh functionality
  useEffect(() => {
    if (!autoRefresh || !refreshInterval) return

    const interval = setInterval(() => {
      if (vaultAddress || tokenAddress) {
        fetchTokenInfo()
      }
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval, fetchTokenInfo, vaultAddress, tokenAddress])

  return {
    ...state,
    refetch,
    clearError,
    isReady: !!(vaultAddress || tokenAddress)
  }
}

/**
 * Hook for resolving token info from room data
 */
export function useRoomTokenInfo(room: {
  tokenInfo?: any
  empireVaultAddress: string
  tokenAddress?: string
} | null, options: UseTokenInfoOptions = {}) {
  return useTokenInfo(
    {
      vaultAddress: room?.empireVaultAddress,
      tokenAddress: room?.tokenAddress,
      fallbackPrefix: 'ROOM'
    },
    options
  )
}

/**
 * Hook for batch token info resolution
 */
export function useBatchTokenInfo(
  requests: Array<{ vaultAddress?: string; tokenAddress?: string; fallbackPrefix?: string }>,
  options: UseTokenInfoOptions = {}
) {
  const [state, setState] = useState<{
    data: ResolvedTokenInfo[]
    isLoading: boolean
    error: string | null
    lastFetched: Date | null
  }>({
    data: [],
    isLoading: false,
    error: null,
    lastFetched: null
  })

  const fetchBatchTokenInfo = useCallback(async () => {
    if (requests.length === 0) return

    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      console.log('🔍 Fetching batch token info via API:', requests.length, 'requests')

      const response = await fetch('/api/token-info-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests })
      })

      if (!response.ok) {
        throw new Error(`Batch token info API request failed: ${response.status}`)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Batch token info request failed')
      }

      setState({
        data: result.data,
        isLoading: false,
        error: null,
        lastFetched: new Date()
      })

      console.log('✅ Batch token info fetched successfully:', result.data.length, 'tokens')
      
      if (options.onSuccess && result.data.length > 0) {
        // Call onSuccess for first token in batch (can be customized)
        options.onSuccess(result.data[0])
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to fetch batch token info'
      
      setState({
        data: [],
        isLoading: false,
        error: errorMsg,
        lastFetched: new Date()
      })

      console.error('❌ Failed to fetch batch token info:', error)
      
      if (options.onError) {
        options.onError(errorMsg)
      }
    }
  }, [requests, options.onError, options.onSuccess])

  // Auto-fetch when requests change
  useEffect(() => {
    if (requests.length > 0) {
      fetchBatchTokenInfo()
    }
  }, [fetchBatchTokenInfo])

  return {
    ...state,
    refetch: fetchBatchTokenInfo
  }
}