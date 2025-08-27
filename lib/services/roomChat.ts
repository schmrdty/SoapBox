//--src/lib/services/roomChat.ts
// Server-side room chat service

// XMTP Client will be injected via setXMTPClient method
import type { EmpireRoom } from '@/app/api/empire-rooms/route';
import type { ChatMessage, ChatRoom, RoomSettings, TipTransaction } from '@/app/types/chat';
import { parseTipCommand, validateTipCommand, type TipCommand } from '@/lib/utils/chatTippingParser';
import { createTipTransaction, processFeePayment } from '@/lib/payments';
import { getEmpireLeaderboard } from '@/lib/services/empireApi';
// PostHog tracking disabled for performance - using console logging instead

export interface RoomChatMessage {
  id: string;
  content: string;
  senderAddress: string;
  senderInboxId: string;
  timestamp: Date;
  type: 'text' | 'system' | 'tip' | 'game_invite';
  metadata?: Record<string, unknown>;
}

export interface RoomMember {
  address: string;
  inboxId: string;
  joinedAt: Date;
  isActive: boolean;
  tokenBalance: string;
  leaderboardRank: number;
}

export interface RoomConversation {
  id: string;
  roomId: string;
  groupId: string;
  members: RoomMember[];
  isActive: boolean;
  createdAt: Date;
  lastActivity: Date;
}

export interface ChatCommand {
  type: 'tip' | 'game' | 'image' | 'link' | 'tag_all';
  data: Record<string, unknown>;
  cost: number;
  requiresPayment: boolean;
}

export interface MessageProcessingResult {
  message: RoomChatMessage;
  commands: ChatCommand[];
  requiresPayment: boolean;
  totalCost: number;
}

class RoomChatService {
  private xmtpClient: any | null = null;
  private activeConversations: Map<string, RoomConversation> = new Map();
  private messageListeners: Map<string, ((message: RoomChatMessage) => void)[]> = new Map();
  private memberCache: Map<string, RoomMember[]> = new Map();

  public setXMTPClient(client: any): void {
    this.xmtpClient = client;
  }

  public async createRoomConversation(room: EmpireRoom, creatorAddress: string): Promise<RoomConversation> {
    if (!this.xmtpClient) {
      throw new Error('XMTP client not initialized');
    }

    try {
      // Get initial members from Empire leaderboard
      const leaderboard = await getEmpireLeaderboard(room.empireVaultAddress);
      const members: RoomMember[] = [];

      // Add creator as first member
      const creatorInboxId = await this.xmtpClient.findInboxIdByIdentifier({
        identifier: creatorAddress.toLowerCase(),
        identifierKind: 'Ethereum'
      });

      if (creatorInboxId) {
        members.push({
          address: creatorAddress,
          inboxId: creatorInboxId,
          joinedAt: new Date(),
          isActive: true,
          tokenBalance: '0',
          leaderboardRank: 0
        });
      }

      // Create XMTP group conversation
      const group = await this.xmtpClient.conversations.newGroup([creatorInboxId].filter(Boolean) as string[]);
      await group.sync();

      const conversation: RoomConversation = {
        id: `room_${room.id}_${Date.now()}`,
        roomId: room.id,
        groupId: group.id,
        members,
        isActive: true,
        createdAt: new Date(),
        lastActivity: new Date()
      };

      this.activeConversations.set(room.id, conversation);
      this.memberCache.set(room.id, members);

      // Send welcome message
      await this.sendSystemMessage(room.id, `Welcome to ${room.name}! This room is powered by Empire vault ${room.empireVaultAddress.slice(0, 6)}...${room.empireVaultAddress.slice(-4)}`);

      return conversation;
    } catch (error) {
      console.error('Failed to create room conversation:', error);
      throw new Error('Failed to create room conversation');
    }
  }

  public async joinRoomConversation(room: EmpireRoom, userAddress: string): Promise<boolean> {
    if (!this.xmtpClient) {
      throw new Error('XMTP client not initialized');
    }

    try {
      // Verify user has access to room
      const hasAccess = await this.verifyRoomAccess(room, userAddress);
      if (!hasAccess) {
        throw new Error('User does not have access to this room');
      }

      let conversation = this.activeConversations.get(room.id);
      
      if (!conversation) {
        // Try to find existing conversation or create new one
        const conversations = await this.xmtpClient.conversations.list();
        const existingGroup = conversations.find((conv: any) => 
          conv.id && conv.id.includes(`room_${room.id}`)
        );

        if (existingGroup) {
          conversation = {
            id: `room_${room.id}_existing`,
            roomId: room.id,
            groupId: existingGroup.id,
            members: [],
            isActive: true,
            createdAt: new Date(),
            lastActivity: new Date()
          };
          this.activeConversations.set(room.id, conversation);
        } else {
          throw new Error('Room conversation not found');
        }
      }

      // Check if user is already a member
      const existingMember = conversation.members.find(m => m.address.toLowerCase() === userAddress.toLowerCase());
      if (existingMember) {
        return true;
      }

      // Get user's inbox ID
      const userInboxId = await this.xmtpClient.findInboxIdByIdentifier({
        identifier: userAddress.toLowerCase(),
        identifierKind: 'Ethereum'
      });

      if (!userInboxId) {
        throw new Error('User not found on XMTP network');
      }

      // Get user's token balance and rank
      const leaderboard = await getEmpireLeaderboard(room.empireVaultAddress);
      const userEntry = leaderboard.leaderboard.find(entry => entry.address.toLowerCase() === userAddress.toLowerCase());

      const newMember: RoomMember = {
        address: userAddress,
        inboxId: userInboxId,
        joinedAt: new Date(),
        isActive: true,
        tokenBalance: userEntry?.balance || '0',
        leaderboardRank: userEntry?.rank || 999999
      };

      // Add to conversation members
      conversation.members.push(newMember);
      this.memberCache.set(room.id, conversation.members);

      // Send join notification
      await this.sendSystemMessage(room.id, `${userAddress.slice(0, 6)}...${userAddress.slice(-4)} joined the room`);

      console.log('🎯 Room joined:', {
        event: 'room_joined',
        userAddress,
        roomId: room.id,
        memberCount: conversation.members.length
      });

      return true;
    } catch (error) {
      console.error('Failed to join room conversation:', error);
      throw error;
    }
  }

  public async sendMessage(roomId: string, content: string, senderAddress: string): Promise<RoomChatMessage> {
    if (!this.xmtpClient) {
      throw new Error('XMTP client not initialized');
    }

    const conversation = this.activeConversations.get(roomId);
    if (!conversation) {
      throw new Error('Room conversation not found');
    }

    try {
      // Process message for commands and costs
      const processingResult = await this.processMessage(content, senderAddress, roomId);

      // Handle payment requirements
      if (processingResult.requiresPayment && processingResult.totalCost > 0) {
        // For now, we'll skip payment processing and just log
        console.log(`Payment required: ${processingResult.totalCost} cents for message commands`);
        
        // In a real implementation, this would integrate with the payment system
        // await this.processMessagePayment(senderAddress, processingResult.totalCost, roomId);
      }

      // Get the XMTP group
      const conversations = await this.xmtpClient.conversations.list();
      const group = conversations.find((conv: any) => conv.id === conversation.groupId);
      
      if (!group) {
        throw new Error('XMTP group not found');
      }

      // Send message to XMTP group
      await group.send(content);
      await group.sync();

      // Create message object
      const message: RoomChatMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        content,
        senderAddress,
        senderInboxId: conversation.members.find(m => m.address.toLowerCase() === senderAddress.toLowerCase())?.inboxId || '',
        timestamp: new Date(),
        type: processingResult.commands.length > 0 ? processingResult.commands[0].type as any : 'text',
        metadata: {
          commands: processingResult.commands,
          cost: processingResult.totalCost
        }
      };

      // Process any tip commands
      for (const command of processingResult.commands) {
        if (command.type === 'tip') {
          await this.processTipCommand(command.data as unknown as TipCommand, senderAddress, roomId, message.id);
        }
      }

      // Notify listeners
      this.notifyMessageListeners(roomId, message);

      // Update conversation activity
      conversation.lastActivity = new Date();

      console.log('💬 Message sent:', {
        event: 'message_sent',
        senderAddress,
        roomId,
        messageType: message.type,
        commandCount: processingResult.commands.length,
        cost: processingResult.totalCost
      });

      return message;
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    }
  }

  public async sendSystemMessage(roomId: string, content: string): Promise<void> {
    const conversation = this.activeConversations.get(roomId);
    if (!conversation) {
      return;
    }

    const systemMessage: RoomChatMessage = {
      id: `sys_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      content,
      senderAddress: '0x0000000000000000000000000000000000000000',
      senderInboxId: 'system',
      timestamp: new Date(),
      type: 'system'
    };

    this.notifyMessageListeners(roomId, systemMessage);
  }

  public async getMessages(roomId: string, limit: number = 50): Promise<RoomChatMessage[]> {
    if (!this.xmtpClient) {
      throw new Error('XMTP client not initialized');
    }

    const conversation = this.activeConversations.get(roomId);
    if (!conversation) {
      return [];
    }

    try {
      const conversations = await this.xmtpClient.conversations.list();
      const group = conversations.find((conv: any) => conv.id === conversation.groupId);
      
      if (!group) {
        return [];
      }

      await group.sync();
      const xmtpMessages = await group.messages();

      const messages: RoomChatMessage[] = xmtpMessages
        .slice(-limit)
        .map((msg: any) => ({
          id: msg.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          content: msg.content || '',
          senderAddress: msg.senderAddress || '',
          senderInboxId: msg.senderInboxId || '',
          timestamp: msg.sent || new Date(),
          type: 'text' as const,
          metadata: {}
        }));

      return messages;
    } catch (error) {
      console.error('Failed to get messages:', error);
      return [];
    }
  }

  public async verifyRoomAccess(room: EmpireRoom, userAddress: string): Promise<boolean> {
    try {
      // Get Empire leaderboard to check if user holds tokens
      const leaderboard = await getEmpireLeaderboard(room.empireVaultAddress);
      const userEntry = leaderboard.leaderboard.find(entry => 
        entry.address.toLowerCase() === userAddress.toLowerCase()
      );

      // For now, allow access if user is on leaderboard or if room allows public access
      return !!userEntry || !room.tokenInfo.symbol; // Allow if no specific token requirement
    } catch (error) {
      console.error('Failed to verify room access:', error);
      return false;
    }
  }

  public async getRoomMembers(roomId: string): Promise<RoomMember[]> {
    const cached = this.memberCache.get(roomId);
    if (cached) {
      return cached;
    }

    const conversation = this.activeConversations.get(roomId);
    return conversation?.members || [];
  }

  public addMessageListener(roomId: string, listener: (message: RoomChatMessage) => void): void {
    const listeners = this.messageListeners.get(roomId) || [];
    listeners.push(listener);
    this.messageListeners.set(roomId, listeners);
  }

  public removeMessageListener(roomId: string, listener: (message: RoomChatMessage) => void): void {
    const listeners = this.messageListeners.get(roomId) || [];
    const filtered = listeners.filter(l => l !== listener);
    this.messageListeners.set(roomId, filtered);
  }

  private async processMessage(content: string, senderAddress: string, roomId: string): Promise<MessageProcessingResult> {
    const commands: ChatCommand[] = [];
    let totalCost = 0;

    // Parse tip commands
    const tipCommand = parseTipCommand(content);
    if (tipCommand && validateTipCommand(tipCommand)) {
      commands.push({
        type: 'tip',
        data: tipCommand as unknown as Record<string, unknown>,
        cost: 0, // Tips don't have platform costs
        requiresPayment: false
      });
    }

    // Check for other command patterns
    if (content.includes('@everyone') || content.includes('@all')) {
      commands.push({
        type: 'tag_all',
        data: { content },
        cost: 500, // 5 USDC cents for tag all
        requiresPayment: true
      });
      totalCost += 500;
    }

    if (content.includes('http://') || content.includes('https://')) {
      commands.push({
        type: 'link',
        data: { content },
        cost: 100, // 1 USDC cent for links
        requiresPayment: true
      });
      totalCost += 100;
    }

    if (content.toLowerCase().includes('game') || content.includes('🎮')) {
      commands.push({
        type: 'game',
        data: { content },
        cost: 1000, // 10 USDC cents for game invites
        requiresPayment: true
      });
      totalCost += 1000;
    }

    const message: RoomChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      content,
      senderAddress,
      senderInboxId: '',
      timestamp: new Date(),
      type: commands.length > 0 ? commands[0].type as any : 'text'
    };

    return {
      message,
      commands,
      requiresPayment: totalCost > 0,
      totalCost
    };
  }

  private async processTipCommand(tipCommand: TipCommand, senderAddress: string, roomId: string, messageId: string): Promise<void> {
    try {
      // Create tip transaction
      // Map currency to supported types
      const mappedCurrency: 'USDC' | 'ETH' | 'TOKEN' = 
        tipCommand.currency === 'ETH' ? 'ETH' :
        tipCommand.currency === 'USDC' ? 'USDC' : 'TOKEN';

      const tipTransaction = await createTipTransaction(
        senderAddress,                           // fromAddress: string
        tipCommand.recipient,                    // toAddress: string
        tipCommand.amount.toString(),            // amount: string (not number!)
        mappedCurrency,                          // currency: 'USDC' | 'ETH' | 'TOKEN'
        roomId,                                  // roomId: string
        'user',                                  // recipientType: 'user' | 'moderator' | 'owner' | 'client'
        undefined,                               // clientWalletAddress?: string
        messageId,                               // messageId?: string
        undefined,                               // splitContractAddress?: string
        undefined,                               // tokenAddress?: string
        18                                       // tokenDecimals: number = 18
      );

      // Log tip event for debugging
      console.log('💰 Tip sent:', {
        event: 'tip_sent',
        fromAddress: senderAddress,
        toAddress: tipCommand.recipient,
        amount: tipCommand.amount,
        currency: tipCommand.currency,
        roomId,
        messageId
      });

      // Send confirmation message
      await this.sendSystemMessage(roomId, 
        `💰 ${senderAddress.slice(0, 6)}...${senderAddress.slice(-4)} tipped ${tipCommand.amount} ${tipCommand.currency} to ${tipCommand.recipient}`
      );
    } catch (error) {
      console.error('Failed to process tip command:', error);
      await this.sendSystemMessage(roomId, 
        `❌ Tip failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private notifyMessageListeners(roomId: string, message: RoomChatMessage): void {
    const listeners = this.messageListeners.get(roomId) || [];
    listeners.forEach(listener => {
      try {
        listener(message);
      } catch (error) {
        console.error('Message listener error:', error);
      }
    });
  }

  public async leaveRoom(roomId: string, userAddress: string): Promise<void> {
    const conversation = this.activeConversations.get(roomId);
    if (!conversation) {
      return;
    }

    // Remove user from members
    conversation.members = conversation.members.filter(
      m => m.address.toLowerCase() !== userAddress.toLowerCase()
    );

    this.memberCache.set(roomId, conversation.members);

    // Send leave notification
    await this.sendSystemMessage(roomId, 
      `${userAddress.slice(0, 6)}...${userAddress.slice(-4)} left the room`
    );

    console.log('👋 Room left:', {
      event: 'room_left',
      userAddress,
      roomId,
      memberCount: conversation.members.length
    });
  }

  public async updateRoomSettings(roomId: string, settings: Partial<RoomSettings>): Promise<void> {
    // This would integrate with room settings storage
    console.log('Room settings updated:', { roomId, settings });
    
    await this.sendSystemMessage(roomId, 
      '⚙️ Room settings have been updated by the owner'
    );
  }

  public getActiveConversation(roomId: string): RoomConversation | null {
    return this.activeConversations.get(roomId) || null;
  }

  public isUserInRoom(roomId: string, userAddress: string): boolean {
    const conversation = this.activeConversations.get(roomId);
    if (!conversation) {
      return false;
    }

    return conversation.members.some(
      m => m.address.toLowerCase() === userAddress.toLowerCase()
    );
  }
}

// Export singleton instance
export const roomChatService = new RoomChatService();

// Export types and service
export default roomChatService;
export type { RoomChatService };