//--useXMTPChat.ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useXMTPClient } from '@/providers/XMTPProvider';
// Dynamic XMTP types to prevent Node.js dependencies from leaking
type Dm = any; // Will be typed properly when dynamically imported
type Group = any; // Will be typed properly when dynamically imported
type ConsentEntityType = any; // Will be typed properly when dynamically imported

// Define consent state types as string literals
type ConsentState = 'allowed' | 'denied' | 'unknown';

interface Message {
  id: string;
  content: string;
  sent: Date;
  senderAddress: string;
  senderInboxId: string;
}

interface SendMessageOptions {
  onSuccess?: (messageId: string) => void;
  onError?: (error: string) => void;
  maxRetries?: number;
}

interface ConversationOptions {
  autoSync?: boolean;
  onError?: (error: string) => void;
}

export function useSendMessage(conversation: Dm | Group | null, options: SendMessageOptions = {}) {
  const { client } = useXMTPClient();
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const maxRetries = options.maxRetries ?? 3;

  const sendMessage = async (content: string | any) => {
    if (!content) {
      setError('Message content cannot be empty');
      return;
    }
    if (!client) {
      setError('XMTP client is not initialized');
      return;
    }
    if (!conversation) {
      setError('No conversation selected');
      return;
    }

    setIsSending(true);
    setError(null);
    
    try {
      // Dynamic import for XMTP types
      const { ConsentEntityType } = await import('@xmtp/browser-sdk');
      
      await conversation.sync();
      let consentState: any;
      
      // Check if it's a DM by trying to call peerInboxId method
      try {
        const peerInboxId = await conversation.peerInboxId();
        if (peerInboxId) {
          consentState = await client.preferences.getConsentState(ConsentEntityType.InboxId, peerInboxId);
          if (consentState === 'denied') {
            throw new Error(`Recipient ${peerInboxId} has denied messages from you.`);
          }
        }
      } catch {
        // Not a DM, skip consent check
      }

      const attemptSend = async (attempt: number): Promise<string> => {
        try {
          const messageId = await conversation.send(content);
          await conversation.sync();
          return messageId;
        } catch (err) {
          if (attempt < maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
            return attemptSend(attempt + 1);
          }
          throw err;
        }
      };

      const messageId = await attemptSend(0);
      if (options.onSuccess) {
        options.onSuccess(messageId);
      }
      return messageId;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to send message';
      setError(errorMsg);
      if (options.onError) {
        options.onError(errorMsg);
      }
      throw err;
    } finally {
      setIsSending(false);
    }
  };

  return { sendMessage, isSending, error };
}

export function useConversations(options: ConversationOptions = {}) {
  const { client } = useXMTPClient();
  const [conversations, setConversations] = useState<(Dm | Group)[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const syncConversations = useCallback(async () => {
    if (!client) return;
    setIsLoading(true);
    setError(null);
    
    try {
      await client.conversations.sync();
      const convos = await client.conversations.list();
      setConversations(convos);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to sync conversations';
      setError(errorMsg);
      if (options.onError) {
        options.onError(errorMsg);
      }
    } finally {
      setIsLoading(false);
    }
  }, [client, options.onError]);

  const createDm = async (peerAddress: string) => {
    if (!client) throw new Error('Client not initialized');
    
    // Dynamic import for XMTP types
    const { ConsentEntityType } = await import('@xmtp/browser-sdk');
    
    const identifier = {
      identifier: peerAddress.toLowerCase(),
      identifierKind: 'ethereum' as const,
    };
    
    const canMessage = await client.canMessage([identifier]);
    if (!canMessage.get(peerAddress.toLowerCase())) {
      throw new Error(`Recipient ${peerAddress} is not enabled for XMTP messages.`);
    }
    
    const inboxId = await client.findInboxIdByIdentifier(identifier);
    if (!inboxId) {
      throw new Error(`No inbox ID found for address ${peerAddress}.`);
    }
    
    const consentState: any = await client.preferences.getConsentState(ConsentEntityType.InboxId, inboxId);
    if (consentState === 'denied') {
      throw new Error(`Recipient ${peerAddress} has denied messages from you.`);
    }
    
    await client.preferences.setConsentStates([
      { entityType: ConsentEntityType.InboxId, entity: inboxId, state: 'allowed' as any },
    ]);
    
    const conversation = await client.conversations.newDm(inboxId);
    await conversation.sync();
    setConversations((prev) => [...prev, conversation]);
    return conversation;
  };

  const createGroup = async (memberAddresses: string[], groupName?: string) => {
    if (!client) throw new Error('Client not initialized');
    
    const identifiers = memberAddresses.map((addr) => ({
      identifier: addr.toLowerCase(),
      identifierKind: 'ethereum' as const,
    }));
    
    const canMessage = await client.canMessage(identifiers);
    const invalidAddresses = memberAddresses.filter(
      (addr) => !canMessage.get(addr.toLowerCase())
    );
    
    if (invalidAddresses.length > 0) {
      throw new Error(
        `The following addresses are not enabled for XMTP: ${invalidAddresses.join(', ')}`
      );
    }
    
    const inboxIdPromises = await Promise.all(
      identifiers.map((id) => client.findInboxIdByIdentifier(id))
    );
    
    const inboxIds = inboxIdPromises.filter((id): id is string => id !== undefined);
    
    if (inboxIds.length === 0) {
      throw new Error('No valid inbox IDs found for the provided addresses');
    }
    
    const group = await client.conversations.newGroup(inboxIds);
    // Note: Group naming may require different API calls in XMTP browser SDK
    
    await group.sync();
    setConversations((prev) => [...prev, group]);
    return group;
  };

  useEffect(() => {
    if (options.autoSync && client) {
      syncConversations();
    }
  }, [client, options.autoSync, syncConversations]);

  return {
    conversations,
    syncConversations,
    createDm,
    createGroup,
    isLoading,
    error,
  };
}