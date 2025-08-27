//--src/hooks/useConversations.ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useXMTPClient } from '@/providers/XMTPProvider';

// Dynamic XMTP types to prevent Node.js dependencies from leaking
type Conversation = any; // Will be typed properly when dynamically imported
type Group = any; // Will be typed properly when dynamically imported
type Dm = any; // Will be typed properly when dynamically imported

interface UseConversationsOptions {
  autoSync?: boolean;
  refreshInterval?: number;
}

interface UseConversationsReturn {
  conversations: Conversation[];
  syncConversations: () => Promise<void>;
  createGroup: (participants: string[], name?: string) => Promise<Group>;
  isLoading: boolean;
  error: string | null;
}

export function useConversations(options: UseConversationsOptions = {}): UseConversationsReturn {
  const { autoSync = false, refreshInterval = 30000 } = options;
  const { client } = useXMTPClient();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const syncConversations = useCallback(async () => {
    if (!client) {
      setError('XMTP client not available');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('📡 Syncing XMTP conversations...');
      
      // Sync with XMTP network to get latest conversations
      await client.conversations.sync();
      
      // Get all conversations (both groups and DMs)
      const allConversations = await client.conversations.list();
      
      console.log('✅ Synced conversations:', {
        total: allConversations.length,
        timestamp: new Date().toISOString()
      });

      setConversations(allConversations);
    } catch (err) {
      console.error('❌ Error syncing conversations:', err);
      setError(err instanceof Error ? err.message : 'Failed to sync conversations');
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  const createGroup = useCallback(async (participants: string[], name?: string): Promise<Group> => {
    if (!client) {
      throw new Error('XMTP client not available');
    }

    if (participants.length === 0) {
      throw new Error('At least one participant is required');
    }

    try {
      console.log('👥 Creating XMTP group:', {
        participants: participants.length,
        name: name || 'Unnamed Group'
      });

      // Dynamic import for XMTP group creation
      const { Group } = await import('@xmtp/browser-sdk');
      
      // Create group with participants
      const group = await client.conversations.newGroup(participants, {
        groupName: name || 'SoapBox Group',
        groupImageUrl: '',
        groupDescription: 'Token-gated SoapBox chat room'
      });

      console.log('✅ XMTP group created successfully:', {
        groupId: group.id,
        memberCount: participants.length + 1, // +1 for creator
        name: name
      });

      // Add to local conversations list
      setConversations(prev => [...prev, group]);

      return group;
    } catch (err) {
      console.error('❌ Error creating XMTP group:', err);
      throw err;
    }
  }, [client]);

  // Auto-sync conversations on client initialization
  useEffect(() => {
    if (client && autoSync) {
      syncConversations();
    }
  }, [client, autoSync, syncConversations]);

  // Set up periodic sync if refreshInterval is provided and autoSync is enabled
  useEffect(() => {
    if (!client || !autoSync || !refreshInterval) return;

    const interval = setInterval(() => {
      syncConversations();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [client, autoSync, refreshInterval, syncConversations]);

  return {
    conversations,
    syncConversations,
    createGroup,
    isLoading,
    error
  };
}

export default useConversations;