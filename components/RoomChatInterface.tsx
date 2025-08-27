//--RoomChatInterface.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useConversations, useSendMessage } from '@/hooks/useXMTPChat';
import { useXMTPClient } from '@/providers/XMTPProvider';
// Dynamic XMTP types to prevent Node.js dependencies from leaking
type Dm = any; // Will be typed properly when dynamically imported
type Group = any; // Will be typed properly when dynamically imported
type Client = any; // Will be typed properly when dynamically imported

interface User {
  fid: number;
  username?: string;
  displayName?: string;
  pfpUrl?: string;
  bio?: string;
}

interface RoomChatInterfaceProps {
  roomId: string;
  user: User;
  client: Client | null;
  onBack?: () => void;
}

interface Message {
  id: string;
  content: string;
  sent: Date;
  senderAddress: string;
  senderInboxId: string;
  kind?: string;
}

export function RoomChatInterface({ roomId, user, client, onBack }: RoomChatInterfaceProps) {
  const [selectedConversation, setSelectedConversation] = useState<Dm | Group | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [messageText, setMessageText] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [peerInboxIds, setPeerInboxIds] = useState<Map<string, string>>(new Map());
  const [accessError, setAccessError] = useState<string | null>(null);
  const [initializingRoom, setInitializingRoom] = useState(false);
  const [membershipStatus, setMembershipStatus] = useState<{
    totalMembers: number;
    lastUpdated: Date | null;
  }>({ totalMembers: 0, lastUpdated: null });
  const messageContainerRef = useRef<HTMLDivElement>(null);
  const membershipCheckInterval = useRef<NodeJS.Timeout | null>(null);

  // Get wallet address from XMTP provider for token verification
  const { walletAddress } = useXMTPClient();

  const { conversations, syncConversations, createGroup } = useConversations({
    autoSync: true
  });

  const { sendMessage, isSending, error: sendError } = useSendMessage(selectedConversation, {
    onSuccess: (messageId) => {
      console.log('Message sent successfully:', messageId);
      setMessageText('');
    },
    onError: (error) => {
      console.error('Failed to send message:', error);
    }
  });

  // Helper function to convert nanoseconds to a Date object
  const nsToDate = (nanoseconds: bigint): Date => {
    const milliseconds = Number(nanoseconds) / 1_000_000;
    return new Date(milliseconds);
  };

  // Truncate inboxId for display
  const truncateInboxId = (id: string) =>
    id.length > 10 ? `${id.slice(0, 6)}...${id.slice(-4)}` : id;

  // Find or create room conversation with real token holder verification
  useEffect(() => {
    const initializeRoomConversation = async () => {
      if (!client || !roomId || !walletAddress) return;
      
      setInitializingRoom(true);
      setAccessError(null);

      try {
        // Dynamic import for XMTP types
        const { Group } = await import('@xmtp/browser-sdk');

        // Look for existing conversation for this room
        const roomConversation = conversations.find(conv => {
          if (conv instanceof Group) {
            return conv.name === `SoapBox_${roomId}` || conv.id === roomId;
          }
          return false;
        });

        if (roomConversation) {
          console.log('✅ Found existing room conversation:', roomId);
          setSelectedConversation(roomConversation);
          return;
        }

        // Get room data and verify user access
        console.log('🔍 Fetching room data and verifying access for:', roomId);
        
        const roomResponse = await fetch(`/api/empire-rooms/${roomId}`);
        if (!roomResponse.ok) {
          console.error('Failed to fetch room data:', roomResponse.statusText);
          return;
        }
        
        const roomData = await roomResponse.json();
        if (!roomData.success) {
          console.error('Room data request failed:', roomData.error);
          return;
        }
        
        const room = roomData.data;
        console.log('📊 Room data retrieved:', {
          name: room.name,
          vaultAddress: room.empireVaultAddress,
          tokenGating: room.tokenGating
        });

        // Verify user has access to this room (token holder verification)
        const accessResponse = await fetch('/api/room-access-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomId,
            userAddress: walletAddress, // Use wallet address for token verification
            vaultAddress: room.empireVaultAddress,
            tokenGating: room.tokenGating
          })
        });

        if (!accessResponse.ok) {
          console.error('❌ Access verification failed:', accessResponse.statusText);
          return;
        }

        const accessResult = await accessResponse.json();
        if (!accessResult.success || !accessResult.hasAccess) {
          const errorMessage = accessResult.reason || 'Access denied: You need to hold tokens from this vault to join the room';
          console.error('❌ User does not have access to room:', {
            reason: accessResult.reason,
            userStats: accessResult.userStats
          });
          setAccessError(errorMessage);
          return;
        }

        console.log('✅ User access verified:', {
          reason: accessResult.reason,
          userStats: accessResult.userStats
        });

        // Get verified token holders for group membership
        console.log('👥 Fetching verified token holders for group creation...');
        
        const membersResponse = await fetch(`/api/empire-rooms/${roomId}/members`);
        if (!membersResponse.ok) {
          console.error('Failed to fetch room members:', membersResponse.statusText);
          return;
        }
        
        const membersData = await membersResponse.json();
        if (!membersData.success) {
          console.error('Members data request failed:', membersData.error);
          return;
        }

        // Get top token holders (limit to reasonable group size for XMTP performance)
        const topHolders = membersData.data.slice(0, 50); // Limit to top 50 holders
        const memberAddresses = topHolders
          .map((member: any) => member.address)
          .filter((address: string) => address.toLowerCase() !== walletAddress.toLowerCase()) // Exclude current user
          .slice(0, 25); // XMTP group size limitation

        console.log('🎯 Creating XMTP group with verified token holders:', {
          roomName: room.name,
          totalTokenHolders: membersData.data.length,
          selectedMembers: memberAddresses.length,
          currentUser: walletAddress
        });

        // Create XMTP group conversation with verified token holders
        if (memberAddresses.length > 0) {
          try {
            const groupConversation = await createGroup(
              memberAddresses,
              `SoapBox: ${room.name}`
            );
            
            console.log('✅ XMTP group conversation created successfully:', {
              groupId: groupConversation.id,
              memberCount: memberAddresses.length + 1, // +1 for current user
              roomName: room.name
            });
            
            setSelectedConversation(groupConversation);
          } catch (groupError) {
            console.error('❌ Failed to create XMTP group:', groupError);
            
            // Fallback: Try creating smaller groups or handle specific errors
            if (memberAddresses.length > 10) {
              console.log('🔄 Retrying with smaller group size...');
              try {
                const smallerGroup = memberAddresses.slice(0, 10);
                const fallbackGroup = await createGroup(
                  smallerGroup,
                  `SoapBox: ${room.name} (Core)`
                );
                
                console.log('✅ Fallback XMTP group created:', {
                  groupId: fallbackGroup.id,
                  memberCount: smallerGroup.length + 1
                });
                
                setSelectedConversation(fallbackGroup);
              } catch (fallbackError) {
                console.error('❌ Fallback group creation also failed:', fallbackError);
              }
            }
          }
        } else {
          console.warn('⚠️ No other verified token holders found for group creation');
          // Could create a group with just the current user, or handle this case differently
        }

      } catch (error) {
        console.error('❌ Error initializing room conversation:', error);
        setAccessError('Failed to initialize room conversation. Please try refreshing the page.');
      } finally {
        setInitializingRoom(false);
      }
    };

    initializeRoomConversation();
  }, [client, roomId, conversations, createGroup, walletAddress]);

  // Real-time member verification - check token holdings periodically
  useEffect(() => {
    if (!selectedConversation || !roomId || !walletAddress) return;

    const verifyMemberAccess = async () => {
      try {
        // Re-check user's own access first
        const accessResponse = await fetch('/api/room-access-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomId,
            userAddress: walletAddress,
            vaultAddress: '', // Will be filled by the API
            tokenGating: {}
          })
        });

        if (!accessResponse.ok) return;

        const accessResult = await accessResponse.json();
        if (!accessResult.success || !accessResult.hasAccess) {
          console.warn('⚠️ User no longer has access to room - access revoked');
          setAccessError('Your access to this room has been revoked - you no longer meet the token requirements.');
          setSelectedConversation(null);
          return;
        }

        // Get updated member list to check for new token holders
        const membersResponse = await fetch(`/api/empire-rooms/${roomId}/members`);
        if (!membersResponse.ok) return;
        
        const membersData = await membersResponse.json();
        if (!membersData.success) return;

        const currentMembers = membersData.data.length;
        setMembershipStatus({
          totalMembers: currentMembers,
          lastUpdated: new Date()
        });

        console.log('🔄 Member verification check completed:', {
          roomId,
          totalMembers: currentMembers,
          userStillHasAccess: accessResult.hasAccess,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        console.error('❌ Error during member verification:', error);
      }
    };

    // Initial verification
    verifyMemberAccess();
    
    // Set up periodic verification (every 5 minutes)
    membershipCheckInterval.current = setInterval(verifyMemberAccess, 5 * 60 * 1000);

    // Cleanup interval on unmount or conversation change
    return () => {
      if (membershipCheckInterval.current) {
        clearInterval(membershipCheckInterval.current);
        membershipCheckInterval.current = null;
      }
    };
  }, [selectedConversation, roomId, walletAddress]);

  // Fetch peerInboxIds when conversations load
  useEffect(() => {
    const fetchPeerInboxIds = async () => {
      // Dynamic import for XMTP types
      const { Dm } = await import('@xmtp/browser-sdk');
      
      const inboxIds = new Map<string, string>();
      for (const convo of conversations) {
        if (convo instanceof Dm) {
          try {
            const inboxId = await convo.peerInboxId();
            inboxIds.set(convo.id, inboxId || convo.id);
          } catch (error) {
            console.error(`Error fetching peerInboxId for conversation ${convo.id}:`, error);
            inboxIds.set(convo.id, convo.id); // Fallback
          }
        }
      }
      setPeerInboxIds(inboxIds);
    };

    if (conversations.length > 0) {
      fetchPeerInboxIds();
    }
  }, [conversations]);

  // Load initial message history when a conversation is selected
  useEffect(() => {
    if (!selectedConversation) {
      setMessages([]);
      return;
    }

    const loadMessages = async () => {
      setLoadingMessages(true);
      try {
        const history = await selectedConversation.messages();
        setMessages(history);
      } catch (error) {
        console.error('Error loading messages:', error);
      } finally {
        setLoadingMessages(false);
      }
    };
    loadMessages();
  }, [selectedConversation]);

  // Set up real-time message streaming
  useEffect(() => {
    if (!selectedConversation) return;

    let isActive = true;
    const streamMessages = async () => {
      try {
        const onMessage = (error: Error | null, message: any | undefined) => {
          if (error) {
            console.error('Streaming error:', error);
            return;
          }
          if (message && isActive) {
            setMessages((prev) => [...prev, message]);
          }
        };

        const stream = await selectedConversation.stream(onMessage);
        
        // Cleanup function
        return () => {
          isActive = false;
          void stream.return(undefined);
        };
      } catch (error) {
        console.error('Error setting up message stream:', error);
      }
    };

    const cleanup = streamMessages();

    // Cleanup on unmount or when selectedConversation changes
    return () => {
      if (cleanup) {
        cleanup.then(cleanupFn => cleanupFn?.());
      }
    };
  }, [selectedConversation]);

  // Auto-scroll to the latest message
  useEffect(() => {
    if (messageContainerRef.current) {
      messageContainerRef.current.scrollTop = messageContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = () => {
    if (!messageText.trim()) return;
    
    // Wrap async logic in an IIFE to keep the event handler synchronous
    (async () => {
      try {
        await sendMessage(messageText.trim());
      } catch (error) {
        console.error('Error sending message:', error);
      }
    })();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!client) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
        <div className="text-center">
          <p className="text-gray-600 mb-4">XMTP client not connected</p>
          <p className="text-sm text-gray-500">Please connect your wallet and initialize XMTP</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Room Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                title="Back to Dashboard"
              >
                ←
              </button>
            )}
            <div>
              <h2 className="text-lg font-semibold text-gray-900">SoapBox Room</h2>
              <p className="text-sm text-gray-600">Room ID: {roomId}</p>
              {membershipStatus.totalMembers > 0 && (
                <p className="text-xs text-green-600">
                  🎯 {membershipStatus.totalMembers} verified token holders
                </p>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">Connected as</p>
              <p className="text-sm text-gray-600">{user.displayName || user.username}</p>
            </div>
            {user.pfpUrl && (
              <img 
                src={user.pfpUrl} 
                alt={user.displayName || user.username} 
                className="w-10 h-10 rounded-full"
              />
            )}
          </div>
        </div>
      </div>

      {/* Chat Messages */}
      <div 
        className="flex-1 overflow-y-auto p-4 space-y-4"
        ref={messageContainerRef}
      >
        {accessError ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-red-500 text-2xl">🚫</span>
              </div>
              <h3 className="text-lg font-semibold text-red-600 mb-2">Access Denied</h3>
              <p className="text-gray-600 mb-4">{accessError}</p>
              <p className="text-sm text-gray-500">
                You need to hold tokens from this vault to join this room.
              </p>
              {onBack && (
                <button
                  onClick={onBack}
                  className="mt-4 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Back to Dashboard
                </button>
              )}
            </div>
          </div>
        ) : !selectedConversation ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">
                {initializingRoom ? 'Verifying token ownership and setting up room...' : 'Setting up room conversation...'}
              </p>
              <p className="text-sm text-gray-500 mt-2">
                {initializingRoom 
                  ? 'This may take a moment while we check your token holdings and create a secure group chat with other verified holders.'
                  : 'Connecting to XMTP network and initializing secure chat'
                }
              </p>
            </div>
          </div>
        ) : loadingMessages ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-600">Loading messages...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-gray-600 mb-2">No messages yet in this room</p>
              <p className="text-sm text-gray-500">Start the conversation!</p>
            </div>
          </div>
        ) : (
          messages.map((message, index) => {
            const isSystemMessage = message.kind === 'membership_change';
            const messageContent = message.content || message;
            const isOwnMessage = message.senderInboxId === client?.inboxId;

            return (
              <div
                key={index}
                className={`flex ${
                  isSystemMessage
                    ? 'justify-center'
                    : isOwnMessage
                    ? 'justify-end'
                    : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-xs md:max-w-md lg:max-w-lg xl:max-w-xl rounded-lg p-3 ${
                    isSystemMessage
                      ? 'bg-gray-300 text-gray-700'
                      : isOwnMessage
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-900 border border-gray-200'
                  }`}
                >
                  {isSystemMessage ? (
                    <div className="text-sm text-center">
                      {messageContent.initiatedByInboxId ? (
                        `Room initialized by ${truncateInboxId(messageContent.initiatedByInboxId)}`
                      ) : messageContent.inboxId ? (
                        `User joined: ${truncateInboxId(messageContent.inboxId)}`
                      ) : messageContent.addedInboxes?.length > 0 ? (
                        `Added users: ${messageContent.addedInboxes
                          .map((inbox: any) => truncateInboxId(inbox.inboxId || inbox))
                          .join(', ')}`
                      ) : messageContent.removedInboxes?.length > 0 ? (
                        `Removed users: ${messageContent.removedInboxes
                          .map((inbox: any) => truncateInboxId(inbox.inboxId || inbox))
                          .join(', ')}`
                      ) : (
                        'System message'
                      )}
                    </div>
                  ) : typeof message.content === 'string' ? (
                    <div>{message.content}</div>
                  ) : (
                    <div>Message: {JSON.stringify(message.content || message)}</div>
                  )}
                  
                  <div
                    className={`text-xs mt-1 ${
                      isSystemMessage
                        ? 'text-gray-500 text-center'
                        : isOwnMessage
                        ? 'text-blue-200'
                        : 'text-gray-500'
                    }`}
                  >
                    {isSystemMessage
                      ? 'System'
                      : message.sentAtNs
                      ? nsToDate(message.sentAtNs).toLocaleTimeString()
                      : 'Now'}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Message Input */}
      <div className="bg-white border-t border-gray-200 p-4">
        <div className="flex items-center space-x-4">
          <div className="flex-1">
            <textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={
                selectedConversation 
                  ? "Type your message here..." 
                  : "Setting up room conversation..."
              }
              className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={2}
              disabled={!selectedConversation || isSending}
            />
          </div>
          
          <button
            onClick={handleSendMessage}
            disabled={!messageText.trim() || !selectedConversation || isSending}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSending ? 'Sending...' : 'Send'}
          </button>
        </div>
        
        {sendError && (
          <p className="mt-2 text-red-600 text-sm">{sendError}</p>
        )}
        
        {!selectedConversation && (
          <p className="mt-2 text-amber-600 text-sm">
            ⚡ Initializing secure XMTP conversation for this room...
          </p>
        )}
      </div>
    </div>
  );
}