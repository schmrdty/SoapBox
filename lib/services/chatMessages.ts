//--src/lib/services/chatMessages.ts
import { PrismaClient, type Prisma } from '@prisma/client'
import type { ChatMessage } from '@/app/types/chat'

interface CreateChatMessageData {
  roomId: string
  content: string
  senderAddress: string
  senderName?: string
  type?: string
  imageUrl?: string
  linkUrl?: string
  tipAmount?: string
  tipCurrency?: string
  tipRecipient?: string
  replyTo?: string
  isSystemMessage?: boolean
  isPinned?: boolean
  pinnedBy?: string
  moderationScore?: number
  moderationFlags?: string[]
  metadata?: Record<string, unknown>
}

interface GetMessagesOptions {
  limit?: number
  before?: string
  after?: string
  senderAddress?: string
}

export class ChatMessagesService {
  private prisma: PrismaClient

  constructor() {
    this.prisma = new PrismaClient()
  }

  async createMessage(data: CreateChatMessageData): Promise<ChatMessage> {
    try {
      console.log('💾 Creating persistent chat message:', { 
        roomId: data.roomId, 
        content: data.content.slice(0, 50) + '...', 
        senderAddress: data.senderAddress 
      })
      
      const message = await this.prisma.chatMessage.create({
        data: {
          roomId: data.roomId,
          content: data.content,
          senderAddress: data.senderAddress,
          senderName: data.senderName,
          type: data.type || 'text',
          imageUrl: data.imageUrl,
          linkUrl: data.linkUrl,
          tipAmount: data.tipAmount,
          tipCurrency: data.tipCurrency,
          tipRecipient: data.tipRecipient,
          replyTo: data.replyTo,
          isSystemMessage: data.isSystemMessage || false,
          isPinned: data.isPinned || false,
          pinnedBy: data.pinnedBy,
          moderationScore: data.moderationScore,
          moderationFlags: data.moderationFlags || [],
          metadata: (data.metadata as Prisma.InputJsonValue) || undefined
        }
      })
      
      console.log('✅ Chat message saved to database:', message.id)

      // Update room message count
      await this.prisma.empireRoom.update({
        where: { id: data.roomId },
        data: {
          messageCount: {
            increment: 1
          }
        }
      })

      return {
        id: message.id,
        roomId: message.roomId,
        senderId: message.senderAddress,
        senderAddress: message.senderAddress,
        content: message.content,
        type: message.type as 'text' | 'image' | 'system' | 'tip' | 'game_invite' | 'dm',
        timestamp: message.timestamp,
        isDeleted: message.isDeleted,
        deletedBy: message.deletedBy || undefined,
        replyTo: message.replyTo || undefined,
        attachments: this.buildAttachments(message)
      }
    } catch (error) {
      console.error('❌ Failed to create chat message:', error)
      throw new Error('Failed to create message')
    }
  }

  async getMessages(roomId: string, options: GetMessagesOptions = {}): Promise<ChatMessage[]> {
    try {
      console.log('📖 Loading persistent chat messages for room:', roomId)
      
      const {
        limit = 50,
        before,
        after,
        senderAddress
      } = options

      const where: any = {
        roomId,
        isDeleted: false
      }

      if (senderAddress) {
        where.senderAddress = senderAddress
      }

      if (before) {
        where.timestamp = {
          lt: new Date(before)
        }
      }

      if (after) {
        where.timestamp = {
          gt: new Date(after)
        }
      }

      const messages = await this.prisma.chatMessage.findMany({
        where,
        orderBy: {
          timestamp: 'desc'
        },
        take: limit
      })

      console.log(`✅ Loaded ${messages.length} persistent messages from database`)

      return messages.map(message => ({
        id: message.id,
        roomId: message.roomId,
        senderId: message.senderAddress,
        senderAddress: message.senderAddress,
        content: message.content,
        type: message.type as 'text' | 'image' | 'system' | 'tip' | 'game_invite' | 'dm',
        timestamp: message.timestamp,
        isDeleted: message.isDeleted,
        deletedBy: message.deletedBy || undefined,
        replyTo: message.replyTo || undefined,
        attachments: this.buildAttachments(message)
      })).reverse() // Return in chronological order
    } catch (error) {
      console.error('❌ Failed to get chat messages:', error)
      throw new Error('Failed to get messages')
    }
  }

  async deleteMessage(messageId: string, deletedBy: string): Promise<boolean> {
    try {
      await this.prisma.chatMessage.update({
        where: { id: messageId },
        data: {
          isDeleted: true,
          deletedBy,
          content: '[Message deleted]'
        }
      })

      return true
    } catch (error) {
      console.error('Failed to delete chat message:', error)
      return false
    }
  }

  async getMessageCount(roomId: string): Promise<number> {
    try {
      return await this.prisma.chatMessage.count({
        where: {
          roomId,
          isDeleted: false
        }
      })
    } catch (error) {
      console.error('Failed to get message count:', error)
      return 0
    }
  }

  async getLatestMessage(roomId: string): Promise<ChatMessage | null> {
    try {
      const message = await this.prisma.chatMessage.findFirst({
        where: {
          roomId,
          isDeleted: false
        },
        orderBy: {
          timestamp: 'desc'
        }
      })

      if (!message) return null

      return {
        id: message.id,
        roomId: message.roomId,
        senderId: message.senderAddress,
        senderAddress: message.senderAddress,
        content: message.content,
        type: message.type as 'text' | 'image' | 'system' | 'tip' | 'game_invite' | 'dm',
        timestamp: message.timestamp,
        isDeleted: message.isDeleted,
        deletedBy: message.deletedBy || undefined,
        replyTo: message.replyTo || undefined,
        attachments: this.buildAttachments(message)
      }
    } catch (error) {
      console.error('Failed to get latest message:', error)
      return null
    }
  }

  async searchMessages(roomId: string, query: string, limit: number = 20): Promise<ChatMessage[]> {
    try {
      const messages = await this.prisma.chatMessage.findMany({
        where: {
          roomId,
          isDeleted: false,
          content: {
            contains: query,
            mode: 'insensitive'
          }
        },
        orderBy: {
          timestamp: 'desc'
        },
        take: limit
      })

      return messages.map(message => ({
        id: message.id,
        roomId: message.roomId,
        senderId: message.senderAddress,
        senderAddress: message.senderAddress,
        content: message.content,
        type: message.type as 'text' | 'image' | 'system' | 'tip' | 'game_invite' | 'dm',
        timestamp: message.timestamp,
        isDeleted: message.isDeleted,
        deletedBy: message.deletedBy || undefined,
        replyTo: message.replyTo || undefined,
        attachments: this.buildAttachments(message)
      }))
    } catch (error) {
      console.error('Failed to search messages:', error)
      return []
    }
  }

  async pinMessage(messageId: string, pinnedBy: string): Promise<boolean> {
    try {
      await this.prisma.chatMessage.update({
        where: { id: messageId },
        data: {
          isPinned: true,
          pinnedBy,
          pinnedAt: new Date()
        }
      })

      return true
    } catch (error) {
      console.error('Failed to pin message:', error)
      return false
    }
  }

  async unpinMessage(messageId: string): Promise<boolean> {
    try {
      await this.prisma.chatMessage.update({
        where: { id: messageId },
        data: {
          isPinned: false,
          pinnedBy: null,
          pinnedAt: null
        }
      })

      return true
    } catch (error) {
      console.error('Failed to unpin message:', error)
      return false
    }
  }

  async getPinnedMessages(roomId: string): Promise<ChatMessage[]> {
    try {
      const messages = await this.prisma.chatMessage.findMany({
        where: {
          roomId,
          isDeleted: false,
          isPinned: true
        },
        orderBy: {
          pinnedAt: 'desc'
        }
      })

      return messages.map(message => ({
        id: message.id,
        roomId: message.roomId,
        senderId: message.senderAddress,
        senderAddress: message.senderAddress,
        content: message.content,
        type: message.type as 'text' | 'image' | 'system' | 'tip' | 'game_invite' | 'dm',
        timestamp: message.timestamp,
        isDeleted: message.isDeleted,
        deletedBy: message.deletedBy || undefined,
        replyTo: message.replyTo || undefined,
        attachments: this.buildAttachments(message)
      }))
    } catch (error) {
      console.error('Failed to get pinned messages:', error)
      return []
    }
  }

  private buildAttachments(message: any): ChatMessage['attachments'] {
    const attachments: any[] = []

    if (message.imageUrl) {
      attachments.push({
        type: 'image',
        url: message.imageUrl,
        metadata: {}
      })
    }

    if (message.linkUrl) {
      attachments.push({
        type: 'link',
        url: message.linkUrl,
        metadata: {}
      })
    }

    return attachments.length > 0 ? attachments : undefined
  }

  async cleanup(): Promise<void> {
    await this.prisma.$disconnect()
  }
}

// Export singleton instance
export const chatMessagesService = new ChatMessagesService()
export default chatMessagesService