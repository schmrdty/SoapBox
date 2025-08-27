//--src/components/enhanced/EnhancedAdminPanel.tsx
'use client'

import { useState } from 'react'
import { useEmpireVaultSearch } from '@/hooks/useEmpireApi'
import { useRoomData } from '@/hooks/useRoomData'
import { LoadingBoundary, EmpireApiLoadingBoundary } from '@/components/LoadingBoundary'
import { useTokenInfo } from '@/hooks/useTokenInfo'

interface User {
  fid: number
  username?: string
  displayName?: string
  pfpUrl?: string
  bio?: string
}

interface EnhancedAdminPanelProps {
  user: User
  onRoomSelect: (roomId: string) => void
  isXMTPReady: boolean
}

/**
 * Enhanced admin panel using client-safe hooks for all data operations
 */
export function EnhancedAdminPanel({ user, onRoomSelect, isXMTPReady }: EnhancedAdminPanelProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedVault, setSelectedVault] = useState('')
  const [newRoomName, setNewRoomName] = useState('')
  const [newRoomDescription, setNewRoomDescription] = useState('')
  const [tokenRequirement, setTokenRequirement] = useState('1000')
  const [roomType, setRoomType] = useState<'standard' | 'premium' | 'leaderboard'>('leaderboard')
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // Use client-safe hooks for data fetching
  const { 
    data: vaultSearchResults = [], 
    isLoading: isSearching, 
    error: searchError 
  } = useEmpireVaultSearch(searchQuery, {
    limit: 20,
    onError: (error) => console.error('Vault search error:', error)
  })

  const {
    data: existingRooms = [],
    isLoading: isLoadingRooms,
    error: roomsError,
    refetch: refetchRooms
  } = useRoomData({
    autoRefresh: true,
    refreshInterval: 30 * 1000,
    onError: (error) => console.error('Rooms loading error:', error)
  })

  // Get token info for selected vault
  const {
    data: selectedVaultTokenInfo,
    isLoading: isLoadingTokenInfo,
    error: tokenInfoError
  } = useTokenInfo(
    { vaultAddress: selectedVault },
    {
      onError: (error) => console.error('Token info error:', error)
    }
  )

  const handleCreateRoom = async () => {
    if (!newRoomName.trim() || !selectedVault || !user?.fid) {
      setCreateError('Please fill in all required fields')
      return
    }

    setIsCreating(true)
    setCreateError(null)
    
    try {
      // Step 1: Validate Empire Vault has leaderboard (if leaderboard-based room)
      if (roomType === 'leaderboard') {
        console.log('🔍 Validating Empire Vault leaderboard...')
        const validationResponse = await fetch(`/api/empire-leaderboard?vault=${encodeURIComponent(selectedVault)}&limit=1`)
        const validationResult = await validationResponse.json()
        
        if (!validationResult.success) {
          throw new Error(validationResult.error || 'Invalid vault')
        }
        
        console.log('✅ Empire Vault leaderboard confirmed')
      }
      
      // Step 2: Create SoapBox room via API
      console.log('🏗️ Creating SoapBox room...')
      const createRoomResponse = await fetch('/api/empire-room-creation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newRoomName.trim(),
          description: newRoomDescription.trim() || 'A token-gated SoapBox room',
          type: roomType,
          vaultAddress: selectedVault,
          tokenGated: roomType !== 'leaderboard',
          minTokenBalance: roomType !== 'leaderboard' ? tokenRequirement : undefined,
          empireLeaderboardRange: roomType === 'leaderboard' ? { minRank: 1, maxRank: 100 } : undefined,
          topHoldersOnly: roomType === 'premium',
          createdBy: user.fid.toString()
        })
      })
      
      const roomResult = await createRoomResponse.json()
      
      if (!roomResult.success) {
        throw new Error(roomResult.error || 'Failed to create room')
      }
      
      // Reset form
      setNewRoomName('')
      setNewRoomDescription('')
      setSelectedVault('')
      setTokenRequirement('1000')
      setRoomType('leaderboard')
      
      // Refresh rooms list
      await refetchRooms()
      
      console.log('✅ SoapBox room created successfully!')
    } catch (error) {
      console.error('❌ Error creating room:', error)
      setCreateError(error instanceof Error ? error.message : 'Failed to create room')
    } finally {
      setIsCreating(false)
    }
  }

  const handleRoomClick = (roomId: string) => {
    if (!isXMTPReady) {
      alert('Please connect your wallet and initialize XMTP first')
      return
    }
    onRoomSelect(roomId)
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header Section */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Enhanced SoapBox Room Management</h2>
        <div className="grid md:grid-cols-3 gap-4 text-sm">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-semibold text-blue-900">🏛️ Empire Vaults</h3>
            <p className="text-blue-700">Real-time token-gated access control</p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <h3 className="font-semibold text-purple-900">💬 XMTP Chat</h3>
            <p className="text-purple-700">Decentralized, secure messaging</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <h3 className="font-semibold text-green-900">💰 Revenue Splits</h3>
            <p className="text-green-700">Automated multi-participant earnings</p>
          </div>
        </div>
      </div>

      {/* Create New Room */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">Create New SoapBox Room</h3>
        
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Room Name</label>
              <input
                type="text"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                placeholder="Enter room name"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description (Optional)</label>
              <input
                type="text"
                value={newRoomDescription}
                onChange={(e) => setNewRoomDescription(e.target.value)}
                placeholder="Brief description of the room"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Room Type</label>
              <select
                value={roomType}
                onChange={(e) => setRoomType(e.target.value as 'standard' | 'premium' | 'leaderboard')}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="leaderboard">Leaderboard Based (Recommended)</option>
                <option value="standard">Token Gated - Standard</option>
                <option value="premium">Token Gated - Premium</option>
              </select>
            </div>
            
            {/* Empire Vault Search with Loading States */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Empire Vault Search</label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for Empire vaults..."
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
              
              {/* Search Results */}
              <EmpireApiLoadingBoundary>
                <div className="mt-2 max-h-48 overflow-y-auto">
                  {isSearching && searchQuery && (
                    <div className="p-3 text-sm text-gray-600">
                      Searching Empire vaults...
                    </div>
                  )}
                  
                  {searchError && (
                    <div className="p-3 text-sm text-red-600">
                      Search failed: {searchError}
                    </div>
                  )}
                  
                  {vaultSearchResults.length > 0 && (
                    <div className="space-y-1">
                      {vaultSearchResults.map((vault) => (
                        <button
                          key={vault.address}
                          onClick={() => {
                            setSelectedVault(vault.address)
                            setSearchQuery('')
                          }}
                          className="w-full text-left p-2 hover:bg-gray-100 rounded text-sm"
                        >
                          <div className="font-medium">{vault.tokenInfo.name}</div>
                          <div className="text-gray-600">{vault.tokenInfo.symbol} - {vault.address.slice(0, 8)}...</div>
                        </button>
                      ))}
                    </div>
                  )}
                  
                  {searchQuery && !isSearching && vaultSearchResults.length === 0 && !searchError && (
                    <div className="p-3 text-sm text-gray-600">
                      No vaults found for "{searchQuery}"
                    </div>
                  )}
                </div>
              </EmpireApiLoadingBoundary>
            </div>

            {/* Selected Vault Info with Token Metadata */}
            {selectedVault && (
              <LoadingBoundary
                fallback={<div className="p-3 text-sm text-gray-600">Loading token info...</div>}
              >
                <div className="p-3 bg-blue-50 rounded-lg">
                  <div className="font-medium text-blue-900">Selected Vault:</div>
                  <div className="text-sm text-blue-700">{selectedVault.slice(0, 8)}...{selectedVault.slice(-8)}</div>
                  
                  {isLoadingTokenInfo && (
                    <div className="text-xs text-blue-600 mt-1">Resolving token metadata...</div>
                  )}
                  
                  {selectedVaultTokenInfo && (
                    <div className="mt-2 text-xs text-blue-700">
                      <div>Token: {selectedVaultTokenInfo.name} ({selectedVaultTokenInfo.symbol})</div>
                      <div>Source: {selectedVaultTokenInfo.source}</div>
                      {selectedVaultTokenInfo.verified && (
                        <div className="text-green-600">✅ Verified Token</div>
                      )}
                    </div>
                  )}
                  
                  {tokenInfoError && (
                    <div className="text-xs text-red-600 mt-1">
                      Token info error: {tokenInfoError}
                    </div>
                  )}
                </div>
              </LoadingBoundary>
            )}
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Token Requirement</label>
              <input
                type="number"
                value={tokenRequirement}
                onChange={(e) => setTokenRequirement(e.target.value)}
                placeholder="1000"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">Revenue Split Configuration</h4>
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex justify-between">
                <span>Empire Vault:</span>
                <span>40%</span>
              </div>
              <div className="flex justify-between">
                <span>Room Creator (You):</span>
                <span>20%</span>
              </div>
              <div className="flex justify-between">
                <span>Dev Wallet:</span>
                <span>20%</span>
              </div>
              <div className="flex justify-between">
                <span>MYU Vault:</span>
                <span>20%</span>
              </div>
            </div>
          </div>
        </div>
        
        {createError && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{createError}</p>
          </div>
        )}
        
        <div className="mt-6">
          <button
            onClick={handleCreateRoom}
            disabled={isCreating || !isXMTPReady}
            className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCreating ? 'Creating Room...' : 'Create SoapBox Room'}
          </button>
          
          {!isXMTPReady && (
            <p className="text-sm text-amber-600 mt-2">
              ⚠️ Connect wallet and initialize XMTP to create rooms
            </p>
          )}
        </div>
      </div>

      {/* Existing Rooms with Loading States */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">Your SoapBox Rooms</h3>
        
        <LoadingBoundary
          fallback={<div className="text-center py-8">Loading your rooms...</div>}
        >
          {isLoadingRooms ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading your SoapBox rooms...</p>
            </div>
          ) : roomsError ? (
            <div className="text-center py-8">
              <p className="text-red-600">Failed to load rooms: {roomsError}</p>
              <button
                onClick={refetchRooms}
                className="mt-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
              >
                Retry
              </button>
            </div>
          ) : existingRooms.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No rooms created yet. Create your first SoapBox room above!</p>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {existingRooms.map(room => (
                <div
                  key={room.id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => handleRoomClick(room.id)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <h4 className="font-semibold text-gray-900">{room.name}</h4>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      room.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {room.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  
                  <div className="space-y-2 text-sm text-gray-600">
                    <div>
                      <span className="font-medium">Token Requirement:</span> {room.tokenRequirement}
                    </div>
                    <div>
                      <span className="font-medium">Members:</span> {room.memberCount}
                    </div>
                    <div>
                      <span className="font-medium">Vault:</span> {room.empireVaultAddress.slice(0, 6)}...{room.empireVaultAddress.slice(-4)}
                    </div>
                    {room.tokenInfo && (
                      <div>
                        <span className="font-medium">Token:</span> {room.tokenInfo.name} ({room.tokenInfo.symbol})
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <button
                      className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors text-sm"
                      disabled={!isXMTPReady}
                    >
                      {isXMTPReady ? 'Enter Chat Room' : 'XMTP Required'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </LoadingBoundary>
      </div>
    </div>
  )
}