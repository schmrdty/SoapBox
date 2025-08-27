//--pinnedMessages.ts
//--**Maybe improved upon with RSSFeeds.ts
import type { PrismaClient } from '@prisma/client'

export interface PinnedMessage {
  id: string
  roomId: string
  content: string
  authorAddress: string
  authorName: string | null
  isActive: boolean
  showOnSplash: boolean
  showOnSignIn: boolean
  displayOrder: number
  isEmergencyOverride: boolean
  overrideReason: string | null
  createdAt: Date
  updatedAt: Date
}

export interface CreatePinnedMessageRequest {
  roomId: string
  content: string
  authorAddress: string
  authorName?: string
  showOnSplash?: boolean
  showOnSignIn?: boolean
  displayOrder?: number
}

export interface UpdatePinnedMessageRequest {
  id: string
  content?: string
  isActive?: boolean
  showOnSplash?: boolean
  showOnSignIn?: boolean
  displayOrder?: number
}

export interface EmergencyOverrideRequest {
  messageId: string
  isOverride: boolean
  reason?: string | null
  adminAddress: string // Must be platform admin
}

// Platform admin address for emergency overrides (replace with your address)
export const PLATFORM_ADMIN_ADDRESS = '0x742d35Cc6634C0532925a3b8c2d84b4E2C7EE56e' // Replace with your actual address

class PinnedMessagesService {
  private prisma: PrismaClient | null = null

  constructor() {
    // Prisma client will be injected in API routes
  }

  private getPrisma(): PrismaClient {
    if (!this.prisma) {
      throw new Error('Prisma client not initialized')
    }
    return this.prisma
  }

  public setPrisma(client: PrismaClient): void {
    this.prisma = client
  }

  public async createPinnedMessage(data: CreatePinnedMessageRequest): Promise<PinnedMessage> {
    const prisma = this.getPrisma()
    
    return await prisma.pinnedMessage.create({
      data: {
        roomId: data.roomId,
        content: data.content,
        authorAddress: data.authorAddress,
        authorName: data.authorName ?? null,
        showOnSplash: data.showOnSplash || false,
        showOnSignIn: data.showOnSignIn || false,
        displayOrder: data.displayOrder || 0,
        isActive: true,
        isEmergencyOverride: false
      }
    })
  }

  public async updatePinnedMessage(data: UpdatePinnedMessageRequest): Promise<PinnedMessage> {
    const prisma = this.getPrisma()
    
    return await prisma.pinnedMessage.update({
      where: { id: data.id },
      data: {
        content: data.content,
        isActive: data.isActive,
        showOnSplash: data.showOnSplash,
        showOnSignIn: data.showOnSignIn,
        displayOrder: data.displayOrder,
        updatedAt: new Date()
      }
    })
  }

  public async deletePinnedMessage(messageId: string): Promise<void> {
    const prisma = this.getPrisma()
    
    await prisma.pinnedMessage.delete({
      where: { id: messageId }
    })
  }

  public async getPinnedMessagesForRoom(roomId: string): Promise<PinnedMessage[]> {
    const prisma = this.getPrisma()
    
    return await prisma.pinnedMessage.findMany({
      where: {
        roomId,
        isActive: true
      },
      orderBy: [
        { displayOrder: 'asc' },
        { createdAt: 'desc' }
      ]
    })
  }

  public async getSplashScreenMessages(): Promise<PinnedMessage[]> {
    const prisma = this.getPrisma()
    
    return await prisma.pinnedMessage.findMany({
      where: {
        showOnSplash: true,
        isActive: true
      },
      orderBy: [
        { displayOrder: 'asc' },
        { createdAt: 'desc' }
      ],
      take: 10 // Limit to prevent overflow
    })
  }

  public async getSignInScreenMessages(): Promise<PinnedMessage[]> {
    const prisma = this.getPrisma()
    
    return await prisma.pinnedMessage.findMany({
      where: {
        showOnSignIn: true,
        isActive: true
      },
      orderBy: [
        { displayOrder: 'asc' },
        { createdAt: 'desc' }
      ],
      take: 5 // Limit for sign-in screen
    })
  }

  public async emergencyOverride(data: EmergencyOverrideRequest): Promise<PinnedMessage> {
    const prisma = this.getPrisma()
    
    // Verify admin access
    if (data.adminAddress.toLowerCase() !== PLATFORM_ADMIN_ADDRESS.toLowerCase()) {
      throw new Error('Unauthorized: Only platform admin can perform emergency overrides')
    }
    
    return await prisma.pinnedMessage.update({
      where: { id: data.messageId },
      data: {
        isActive: !data.isOverride, // If override is true, make inactive
        isEmergencyOverride: data.isOverride,
        overrideReason: data.reason,
        updatedAt: new Date()
      }
    })
  }

  public async checkUserPermissions(userAddress: string, roomId: string): Promise<{
    canPin: boolean
    isModerator: boolean
    isOwner: boolean
  }> {
    const prisma = this.getPrisma()
    
    const room = await prisma.empireRoom.findUnique({
      where: { id: roomId }
    })
    
    if (!room) {
      return { canPin: false, isModerator: false, isOwner: false }
    }
    
    const isOwner = room.createdBy.toLowerCase() === userAddress.toLowerCase()
    const isModerator = room.moderators.some(mod => mod.toLowerCase() === userAddress.toLowerCase())
    const canPin = isOwner || isModerator
    
    return { canPin, isModerator, isOwner }
  }
}

export const pinnedMessagesService = new PinnedMessagesService()
export default pinnedMessagesService