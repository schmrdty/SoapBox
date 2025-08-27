//--useRoomData.ts
'use client'

import { useState, useEffect, useCallback } from 'react'
import type { ResolvedTokenInfo } from '@/lib/services/tokenInfoResolver'

// Client-safe room data types
export interface SoapBoxRoom {
  id: string
  name: string
  description: string
  tokenRequirement: string
  empireVaultAddress: string
  isActive: boolean
  memberCount: number
  type: 'standard' | 'premium' | 'leaderboard'
  createdBy: string
  createdAt: Date
  tokenInfo?: ResolvedTokenInfo
  tokenAddress?: string
  minTokenBalance?: string
  tokenGating?: any
}

export interface RoomMember {
  address: string
  balance: string
  baseBalance: string
  farcasterUsername?: string
  rank: number
  isLP: boolean
}

export interface RoomAccessResult {
  hasAccess: boolean
  reason?: string
  userStats?: {
    balance: string
    rank?: number
    meetsCriteria: boolean
  }
}

interface UseRoomDataOptions {
  autoRefresh?: boolean
  refreshInterval?: number
  onError?: (error: string) => void
  onSuccess?: (data: SoapBoxRoom[]) => void
}

interface UseRoomMembersOptions {
  limit?: number
  autoRefresh?: boolean
  refreshInterval?: number
  onError?: (error: string) => void
  onSuccess?: (data: RoomMember[]) => void
}

/**
 * Hook for fetching all SoapBox rooms
 */
export function useRoomData(options: UseRoomDataOptions = {}) {
  const [data, setData] = useState<SoapBoxRoom[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastFetched, setLastFetched] = useState<Date | null>(null)

  const {
    autoRefresh = false,
    refreshInterval = 30 * 1000, // 30 seconds
    onError,
    onSuccess
  } = options

  const fetchRooms = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      console.log('🔍 Fetching SoapBox rooms via API')

      const response = await fetch('/api/empire-rooms')

      if (!response.ok) {
        throw new Error(`Rooms API request failed: ${response.status} ${response.statusText}`)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Rooms request failed')
      }

      const roomsData = (result.data || []).map((room: any): SoapBoxRoom => ({
        id: room.id,
        name: room.name,
        description: room.description || '',
        tokenRequirement: room.minTokenBalance 
          ? `${room.minTokenBalance} tokens` 
          : 'Leaderboard based',
        empireVaultAddress: room.vaultAddress || room.empireVaultAddress,
        isActive: room.isActive,
        memberCount: room.memberCount || 0,
        type: room.type || 'leaderboard',
        createdBy: room.createdBy,
        createdAt: new Date(room.createdAt),
        tokenInfo: room.tokenInfo,
        tokenAddress: room.tokenAddress,
        minTokenBalance: room.minTokenBalance,
        tokenGating: room.tokenGating
      }))

      setData(roomsData)
      setLastFetched(new Date())
      
      console.log('✅ SoapBox rooms fetched successfully:', roomsData.length, 'rooms')

      if (onSuccess) {
        onSuccess(roomsData)
      }

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch rooms'
      
      setError(errorMsg)
      setData([])
      
      console.error('❌ Failed to fetch SoapBox rooms:', err)
      
      if (onError) {
        onError(errorMsg)
      }
    } finally {
      setIsLoading(false)
    }
  }, [onError, onSuccess])

  const refetch = useCallback(() => {
    fetchRooms()
  }, [fetchRooms])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  // Auto-fetch on mount
  useEffect(() => {
    fetchRooms()
  }, [fetchRooms])

  // Auto-refresh functionality
  useEffect(() => {
    if (!autoRefresh || !refreshInterval) return

    const interval = setInterval(() => {
      fetchRooms()
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval, fetchRooms])

  return {
    data,
    isLoading,
    error,
    lastFetched,
    refetch,
    clearError
  }
}

/**
 * Hook for fetching individual room data
 */
export function useIndividualRoom(roomId: string | null) {
  const [data, setData] = useState<SoapBoxRoom | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastFetched, setLastFetched] = useState<Date | null>(null)

  const fetchRoom = useCallback(async () => {
    if (!roomId) return

    setIsLoading(true)
    setError(null)

    try {
      console.log('🔍 Fetching individual room via API:', roomId)

      const response = await fetch(`/api/empire-rooms/${roomId}`)

      if (!response.ok) {
        throw new Error(`Room API request failed: ${response.status}`)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Room request failed')
      }

      const roomData: SoapBoxRoom = {
        id: result.data.id,
        name: result.data.name,
        description: result.data.description || '',
        tokenRequirement: result.data.minTokenBalance 
          ? `${result.data.minTokenBalance} tokens` 
          : 'Leaderboard based',
        empireVaultAddress: result.data.vaultAddress || result.data.empireVaultAddress,
        isActive: result.data.isActive,
        memberCount: result.data.memberCount || 0,
        type: result.data.type || 'leaderboard',
        createdBy: result.data.createdBy,
        createdAt: new Date(result.data.createdAt),
        tokenInfo: result.data.tokenInfo,
        tokenAddress: result.data.tokenAddress,
        minTokenBalance: result.data.minTokenBalance,
        tokenGating: result.data.tokenGating
      }
      
      setData(roomData)
      setLastFetched(new Date())
      
      console.log('✅ Individual room fetched successfully:', roomData.name)

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch room'
      
      setError(errorMsg)
      setData(null)
      
      console.error('❌ Failed to fetch individual room:', err)
    } finally {
      setIsLoading(false)
    }
  }, [roomId])

  // Auto-fetch when roomId changes
  useEffect(() => {
    if (roomId) {
      fetchRoom()
    } else {
      setData(null)
      setError(null)
      setLastFetched(null)
    }
  }, [fetchRoom])

  return {
    data,
    isLoading,
    error,
    lastFetched,
    refetch: fetchRoom,
    clearError: () => setError(null),
    isReady: !!roomId
  }
}

/**
 * Hook for fetching room members
 */
export function useRoomMembers(
  roomId: string | null,
  options: UseRoomMembersOptions = {}
) {
  const [data, setData] = useState<RoomMember[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastFetched, setLastFetched] = useState<Date | null>(null)

  const {
    limit = 100,
    autoRefresh = false,
    refreshInterval = 60 * 1000, // 1 minute
    onError,
    onSuccess
  } = options

  const fetchMembers = useCallback(async () => {
    if (!roomId) return

    setIsLoading(true)
    setError(null)

    try {
      console.log('🔍 Fetching room members via API:', roomId)

      const params = new URLSearchParams({
        limit: limit.toString()
      })

      const response = await fetch(`/api/empire-rooms/${roomId}/members?${params}`)

      if (!response.ok) {
        throw new Error(`Members API request failed: ${response.status}`)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Members request failed')
      }

      const membersData: RoomMember[] = (result.data || []).map((member: any) => ({
        address: member.address,
        balance: member.balance,
        baseBalance: member.baseBalance,
        farcasterUsername: member.farcasterUsername,
        rank: member.rank,
        isLP: member.isLP || false
      }))
      
      setData(membersData)
      setLastFetched(new Date())
      
      console.log('✅ Room members fetched successfully:', membersData.length, 'members')

      if (onSuccess) {
        onSuccess(membersData)
      }

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch members'
      
      setError(errorMsg)
      setData([])
      
      console.error('❌ Failed to fetch room members:', err)
      
      if (onError) {
        onError(errorMsg)
      }
    } finally {
      setIsLoading(false)
    }
  }, [roomId, limit, onError, onSuccess])

  const refetch = useCallback(() => {
    fetchMembers()
  }, [fetchMembers])

  // Auto-fetch when roomId changes
  useEffect(() => {
    if (roomId) {
      fetchMembers()
    } else {
      setData([])
      setError(null)
      setLastFetched(null)
    }
  }, [fetchMembers])

  // Auto-refresh functionality
  useEffect(() => {
    if (!autoRefresh || !refreshInterval || !roomId) return

    const interval = setInterval(() => {
      fetchMembers()
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval, fetchMembers, roomId])

  return {
    data,
    isLoading,
    error,
    lastFetched,
    refetch,
    clearError: () => setError(null),
    isReady: !!roomId
  }
}

/**
 * Hook for checking room access
 */
export function useRoomAccess(
  roomId: string | null,
  userAddress: string | null
) {
  const [data, setData] = useState<RoomAccessResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const checkAccess = useCallback(async () => {
    if (!roomId || !userAddress) return

    setIsLoading(true)
    setError(null)

    try {
      console.log('🔍 Checking room access via API:', { roomId, userAddress })

      const response = await fetch('/api/room-access-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          userAddress,
          vaultAddress: '', // Will be filled by the API
          tokenGating: {} // Will be filled by the API
        })
      })

      if (!response.ok) {
        throw new Error(`Access check API request failed: ${response.status}`)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Access check failed')
      }

      const accessResult: RoomAccessResult = {
        hasAccess: result.hasAccess,
        reason: result.reason,
        userStats: result.userStats
      }
      
      setData(accessResult)
      
      console.log('✅ Room access checked successfully:', accessResult)

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to check access'
      
      setError(errorMsg)
      setData(null)
      
      console.error('❌ Failed to check room access:', err)
    } finally {
      setIsLoading(false)
    }
  }, [roomId, userAddress])

  // Auto-check when dependencies change
  useEffect(() => {
    if (roomId && userAddress) {
      checkAccess()
    } else {
      setData(null)
      setError(null)
    }
  }, [checkAccess])

  return {
    data,
    isLoading,
    error,
    refetch: checkAccess,
    clearError: () => setError(null),
    isReady: !!(roomId && userAddress)
  }
}