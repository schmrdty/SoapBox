//--SoapBoxMain.tsx
'use client';

import { useState, useEffect } from 'react';
import { useXMTPClient } from '@/providers/XMTPProvider';
import { useWalletConnect } from '@/hooks/useWalletConnect';
import { useConversations } from '@/hooks/useXMTPChat';
import { AdminSoapBoxManager } from '@/components/AdminSoapBoxManager';
import { RoomChatInterface } from '@/components/RoomChatInterface';

interface User {
  fid: number;
  username?: string;
  displayName?: string;
  pfpUrl?: string;
  bio?: string;
  location?: {
    placeId: string;
    description: string;
  };
}

export default function SoapBoxMain() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentView, setCurrentView] = useState<'auth' | 'admin' | 'chat'>('auth');
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  
  const { client, isLoading: xmtpLoading } = useXMTPClient();
  const { 
    connectWallet, 
    isConnecting, 
    error: walletError, 
    success: walletSuccess,
    isConnected,
    address
  } = useWalletConnect({
    onConnect: () => {
      console.log('Wallet connected successfully');
    }
  });

  const { conversations, syncConversations } = useConversations({
    autoSync: true
  });

  // Initialize Farcaster authentication
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Dynamically import Farcaster SDK
        const { sdk } = await import('@farcaster/miniapp-sdk');
        
        // Get authenticated user from Farcaster
        const res = await sdk.quickAuth.fetch('/api/auth/me');
        if (res.ok) {
          const userData = await res.json();
          setUser(userData);
          setCurrentView('admin'); // Start with admin view for Empire Vault management
        } else {
          setCurrentView('auth');
        }
        
        // Signal to Farcaster that the app is ready
        sdk.actions.ready();
      } catch (error) {
        console.error('Failed to authenticate:', error);
        setCurrentView('auth');
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const handleRoomSelect = (roomId: string) => {
    setSelectedRoomId(roomId);
    setCurrentView('chat');
  };

  const handleBackToAdmin = () => {
    setSelectedRoomId(null);
    setCurrentView('admin');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading SoapBox...</p>
        </div>
      </div>
    );
  }

  // Authentication view - show if user is not authenticated
  if (currentView === 'auth' || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">🧼 SoapBox</h1>
            <p className="text-gray-600">Token-Gated Chat Platform</p>
            <p className="text-sm text-gray-500 mt-2">Empire Builder's Decentralized Chat</p>
          </div>

          <div className="space-y-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">🏛️ Empire Vault Integration</h3>
              <p className="text-sm text-blue-700">Connect your Empire Vault to create token-gated chat rooms</p>
            </div>

            <div className="bg-purple-50 rounded-lg p-4">
              <h3 className="font-semibold text-purple-900 mb-2">💬 XMTP Messaging</h3>
              <p className="text-sm text-purple-700">Decentralized, end-to-end encrypted chat</p>
            </div>

            <div className="bg-green-50 rounded-lg p-4">
              <h3 className="font-semibold text-green-900 mb-2">💰 Revenue Splits</h3>
              <p className="text-sm text-green-700">Multi-participant earnings from premium features</p>
            </div>
          </div>

          <div className="mt-8 p-4 bg-yellow-50 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>Authentication Required:</strong> Please authenticate with Farcaster to continue
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Admin view - Empire Vault management and room creation
  if (currentView === 'admin') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">🧼 SoapBox Admin</h1>
              <p className="text-gray-600">Empire Vault • Token-Gated Rooms</p>
            </div>
            <div className="flex items-center space-x-4">
              {user.pfpUrl && (
                <img 
                  src={user.pfpUrl} 
                  alt={user.displayName || user.username} 
                  className="w-10 h-10 rounded-full"
                />
              )}
              <div className="text-right">
                <p className="font-medium text-gray-900">{user.displayName}</p>
                <p className="text-sm text-gray-500">@{user.username}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Wallet Connection Status */}
        {!isConnected && (
          <div className="bg-blue-50 border-b border-blue-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-900 font-medium">Connect Wallet for XMTP Chat</p>
                <p className="text-sm text-blue-700">Required for decentralized messaging</p>
              </div>
              <button
                onClick={connectWallet}
                disabled={isConnecting}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {isConnecting ? 'Connecting...' : 'Connect Wallet'}
              </button>
            </div>
            {walletError && (
              <p className="mt-2 text-red-600 text-sm">{walletError}</p>
            )}
            {walletSuccess && (
              <p className="mt-2 text-green-600 text-sm">{walletSuccess}</p>
            )}
          </div>
        )}

        {/* XMTP Connection Status */}
        {isConnected && !client && (
          <div className="bg-yellow-50 border-b border-yellow-200 px-6 py-4">
            <p className="text-yellow-900 font-medium">
              {xmtpLoading ? 'Initializing XMTP...' : 'XMTP Not Connected'}
            </p>
            <p className="text-sm text-yellow-700">Decentralized messaging protocol</p>
          </div>
        )}

        {/* Success Status */}
        {isConnected && client && (
          <div className="bg-green-50 border-b border-green-200 px-6 py-4">
            <p className="text-green-900 font-medium">✅ SoapBox Ready</p>
            <p className="text-sm text-green-700">
              Wallet: {address?.slice(0, 6)}...{address?.slice(-4)} • XMTP: Connected • Base Network
            </p>
          </div>
        )}

        <div className="p-6">
          <AdminSoapBoxManager 
            user={user}
            onRoomSelect={handleRoomSelect}
            isXMTPReady={Boolean(client)}
          />
        </div>
      </div>
    );
  }

  // Chat view - individual room chat interface
  if (currentView === 'chat' && selectedRoomId) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={handleBackToAdmin}
                className="text-gray-600 hover:text-gray-900"
              >
                ← Back to Admin
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">SoapBox Room</h1>
                <p className="text-sm text-gray-600">Room ID: {selectedRoomId}</p>
              </div>
            </div>
          </div>
        </div>

        <RoomChatInterface 
          roomId={selectedRoomId}
          user={user}
          client={client}
        />
      </div>
    );
  }

  return null;
}