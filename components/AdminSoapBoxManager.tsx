//--AdminSoapBoxManager.tsx
'use client';

import { useState, useEffect } from 'react';
import { useReadContract } from 'wagmi';
import { empireApiService } from '@/lib/services/empireApi';
import { roomDatabaseService } from '@/lib/services/roomDatabase';
import { soapboxSplitsFactoryAbi, soapboxSplitsFactoryAddress } from '@/abis/soapboxSplitsFactory';
import type { EmpireVaultData } from '@/lib/services/empireApi';

interface User {
  fid: number;
  username?: string;
  displayName?: string;
  pfpUrl?: string;
  bio?: string;
}

interface AdminSoapBoxManagerProps {
  user: User;
  onRoomSelect: (roomId: string) => void;
  isXMTPReady: boolean;
}

interface SoapBoxRoom {
  id: string;
  name: string;
  description: string;
  tokenRequirement: string;
  empireVault: string;
  isActive: boolean;
  memberCount: number;
  type: 'standard' | 'premium' | 'leaderboard';
  createdBy: string;
  createdAt: Date;
}

export function AdminSoapBoxManager({ user, onRoomSelect, isXMTPReady }: AdminSoapBoxManagerProps) {
  const [rooms, setRooms] = useState<SoapBoxRoom[]>([]);
  const [availableVaults, setAvailableVaults] = useState<EmpireVaultData[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoadingVaults, setIsLoadingVaults] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomDescription, setNewRoomDescription] = useState('');
  const [selectedVault, setSelectedVault] = useState('');
  const [tokenRequirement, setTokenRequirement] = useState('1000');
  const [roomType, setRoomType] = useState<'standard' | 'premium' | 'leaderboard'>('leaderboard');
  const [error, setError] = useState<string | null>(null);

  // Load available Empire Vaults from real API
  useEffect(() => {
    const loadAvailableVaults = async () => {
      if (!isXMTPReady) return;
      
      setIsLoadingVaults(true);
      setError(null);
      
      try {
        // Search for available Empire vaults
        const vaults = await empireApiService.searchVaults('', { limit: 50 });
        setAvailableVaults(vaults);
        console.log('✅ Loaded available Empire vaults:', vaults.length);
      } catch (error) {
        console.error('❌ Failed to load Empire vaults:', error);
        setError('Failed to load available Empire vaults. You can still create rooms by entering a vault address manually.');
      } finally {
        setIsLoadingVaults(false);
      }
    };
    
    loadAvailableVaults();
  }, [isXMTPReady]);

  // Load existing SoapBox rooms from database
  useEffect(() => {
    const loadExistingRooms = async () => {
      if (!isXMTPReady || !user?.fid) return;
      
      try {
        const userRooms = await fetch('/api/empire-rooms');
        if (userRooms.ok) {
          const roomsData = await userRooms.json();
          if (roomsData.success && roomsData.data) {
            const transformedRooms: SoapBoxRoom[] = roomsData.data.map((room: any) => ({
              id: room.id,
              name: room.name,
              description: room.description || '',
              tokenRequirement: room.minTokenBalance ? `${room.minTokenBalance} tokens` : 'Leaderboard based',
              empireVault: room.vaultAddress,
              isActive: room.isActive,
              memberCount: room.memberCount || 0,
              type: room.type || 'leaderboard',
              createdBy: room.createdBy,
              createdAt: new Date(room.createdAt)
            }));
            setRooms(transformedRooms);
            console.log('✅ Loaded existing SoapBox rooms:', transformedRooms.length);
          }
        }
      } catch (error) {
        console.error('❌ Failed to load existing rooms:', error);
      }
    };
    
    loadExistingRooms();
  }, [isXMTPReady, user?.fid]);

  const handleCreateRoom = async () => {
    if (!newRoomName.trim() || !selectedVault || !user?.fid) {
      setError('Please fill in all required fields');
      return;
    }

    setIsCreating(true);
    setError(null);
    
    try {
      // Step 1: Validate Empire Vault has leaderboard (if leaderboard-based room)
      if (roomType === 'leaderboard') {
        console.log('🔍 Validating Empire Vault leaderboard...');
        try {
          await empireApiService.getLeaderboard(selectedVault, { limit: 1 });
          console.log('✅ Empire Vault leaderboard confirmed');
        } catch (vaultError) {
          throw new Error(`Empire Vault validation failed: ${vaultError instanceof Error ? vaultError.message : 'Invalid vault'}`);
        }
      }
      
      // Step 2: Create SoapBox room via API (which handles contract creation and database storage)
      console.log('🏗️ Creating SoapBox room...');
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
      });
      
      const roomResult = await createRoomResponse.json();
      
      if (!roomResult.success) {
        throw new Error(roomResult.error || 'Failed to create room');
      }
      
      // Step 3: Add new room to local state
      const newRoom: SoapBoxRoom = {
        id: roomResult.data.id,
        name: roomResult.data.name,
        description: roomResult.data.description,
        tokenRequirement: roomType === 'leaderboard' ? 'Leaderboard based' : `${tokenRequirement} tokens`,
        empireVault: selectedVault,
        isActive: true,
        memberCount: 1,
        type: roomType,
        createdBy: user.fid.toString(),
        createdAt: new Date()
      };

      setRooms(prev => [...prev, newRoom]);
      
      // Reset form
      setNewRoomName('');
      setNewRoomDescription('');
      setSelectedVault('');
      setTokenRequirement('1000');
      setRoomType('leaderboard');
      
      console.log('✅ SoapBox room created successfully!');
    } catch (error) {
      console.error('❌ Error creating room:', error);
      setError(error instanceof Error ? error.message : 'Failed to create room');
    } finally {
      setIsCreating(false);
    }
  };

  const handleRoomClick = (roomId: string) => {
    if (!isXMTPReady) {
      alert('Please connect your wallet and initialize XMTP first');
      return;
    }
    onRoomSelect(roomId);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header Section */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">SoapBox Room Management</h2>
        <div className="grid md:grid-cols-3 gap-4 text-sm">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-semibold text-blue-900">🏛️ Empire Vaults</h3>
            <p className="text-blue-700">Token-gated access control</p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <h3 className="font-semibold text-purple-900">💬 XMTP Chat</h3>
            <p className="text-purple-700">Decentralized messaging</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <h3 className="font-semibold text-green-900">💰 Revenue Splits</h3>
            <p className="text-green-700">Multi-participant earnings</p>
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
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Empire Vault</label>
              <select
                value={selectedVault}
                onChange={(e) => setSelectedVault(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="">Select Empire Vault</option>
                {isLoadingVaults ? (
                  <option disabled>Loading available vaults...</option>
                ) : availableVaults.length > 0 ? (
                  availableVaults.map(vault => (
                    <option key={vault.address} value={vault.address}>
                      {vault.tokenInfo.name} ({vault.tokenInfo.symbol})
                    </option>
                  ))
                ) : (
                  <option disabled>No vaults available - you can enter address manually</option>
                )}
              </select>
            </div>
            
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
        
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
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

      {/* Existing Rooms */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">Your SoapBox Rooms</h3>
        
        {rooms.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No rooms created yet. Create your first SoapBox room above!</p>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rooms.map(room => (
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
                    <span className="font-medium">Vault:</span> {room.empireVault.slice(0, 6)}...{room.empireVault.slice(-4)}
                  </div>
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
      </div>
    </div>
  );
}