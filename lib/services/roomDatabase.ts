//--src/lib/services/roomDatabase.ts
import { prisma } from './prisma'
import type { EmpireRoom, Prisma } from '@prisma/client'

export interface RoomCreationData {
  name: string
  description?: string
  empireVaultAddress: string
  tokenAddress: string
  tokenInfo: any // Token metadata JSON
  createdBy: string
  moderators?: string[]
  settings?: any // RoomSettings JSON
  splitContractAddress?: string
  splitId?: string
  groupId?: string
  setupperAddress?: string
  isSetupperAuthorized?: boolean
}

export interface RoomUpdateData {
  name?: string
  description?: string
  isActive?: boolean
  moderators?: string[]
  settings?: any
  memberCount?: number
  messageCount?: number
  splitContractAddress?: string
  splitId?: string
  isSetupperAuthorized?: boolean
}

export class RoomDatabaseService {
  /**
   * Create a new Empire room with full SoapBox configuration
   */
  async createRoom(data: RoomCreationData): Promise<EmpireRoom> {
    try {
      console.log('🏗️ Creating new Empire room:', data.name)
      
      const room = await prisma.empireRoom.create({
        data: {
          name: data.name,
          description: data.description,
          empireVaultAddress: data.empireVaultAddress,
          tokenAddress: data.tokenAddress,
          tokenInfo: data.tokenInfo,
          createdBy: data.createdBy,
          moderators: data.moderators || [],
          isActive: true,
          memberCount: 1,
          messageCount: 0,
          settings: data.settings || {
            backgroundType: 'solid',
            backgroundSolidColor: '#f9fafb',
            backgroundOpacity: 100,
            roomName: data.name,
            roomDescription: data.description,
            sfwLevel: 'moderate',
            maxMessageLength: 500,
            cooldownSeconds: 4,
            allowImages: true,
            allowLinks: true,
            allowGames: true,
            ownerMessageCost: 100,
            moderatorMessageCost: 100,
            tagAllCost: 100,
            imageCost: 100,
            linkCost: 100,
            gameCost: 100,
            directMessageCost: 1000
          },
          splitContractAddress: data.splitContractAddress,
          splitId: data.splitId,
          groupId: data.groupId,
          setupperAddress: data.setupperAddress,
          isSetupperAuthorized: data.isSetupperAuthorized || false
        }
      })

      console.log('✅ Empire room created successfully:', room.id)
      return room
    } catch (error) {
      console.error('❌ Failed to create Empire room:', error)
      throw new Error(`Failed to create room: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get room by ID
   */
  async getRoomById(roomId: string): Promise<EmpireRoom | null> {
    try {
      const room = await prisma.empireRoom.findUnique({
        where: { id: roomId }
      })
      return room
    } catch (error) {
      console.error('❌ Failed to get room by ID:', error)
      return null
    }
  }

  /**
   * Get room by Empire vault address
   */
  async getRoomByVaultAddress(empireVaultAddress: string): Promise<EmpireRoom | null> {
    try {
      const room = await prisma.empireRoom.findFirst({
        where: { 
          empireVaultAddress: empireVaultAddress,
          isActive: true
        }
      })
      return room
    } catch (error) {
      console.error('❌ Failed to get room by vault address:', error)
      return null
    }
  }

  /**
   * Get rooms by creator
   */
  async getRoomsByCreator(createdBy: string): Promise<EmpireRoom[]> {
    try {
      const rooms = await prisma.empireRoom.findMany({
        where: { 
          createdBy: createdBy,
          isActive: true
        },
        orderBy: { createdAt: 'desc' }
      })
      return rooms
    } catch (error) {
      console.error('❌ Failed to get rooms by creator:', error)
      return []
    }
  }

  /**
   * Get all active rooms with pagination
   */
  async getAllRooms(limit: number = 50, offset: number = 0): Promise<EmpireRoom[]> {
    try {
      const rooms = await prisma.empireRoom.findMany({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      })
      return rooms
    } catch (error) {
      console.error('❌ Failed to get all rooms:', error)
      return []
    }
  }

  /**
   * Update room data
   */
  async updateRoom(roomId: string, updates: RoomUpdateData): Promise<EmpireRoom | null> {
    try {
      const room = await prisma.empireRoom.update({
        where: { id: roomId },
        data: {
          ...updates,
          updatedAt: new Date()
        }
      })
      
      console.log('✅ Room updated successfully:', roomId)
      return room
    } catch (error) {
      console.error('❌ Failed to update room:', error)
      return null
    }
  }

  /**
   * Increment message count for a room
   */
  async incrementMessageCount(roomId: string): Promise<void> {
    try {
      await prisma.empireRoom.update({
        where: { id: roomId },
        data: {
          messageCount: {
            increment: 1
          }
        }
      })
    } catch (error) {
      console.error('❌ Failed to increment message count:', error)
    }
  }

  /**
   * Update member count for a room
   */
  async updateMemberCount(roomId: string, count: number): Promise<void> {
    try {
      await prisma.empireRoom.update({
        where: { id: roomId },
        data: {
          memberCount: count
        }
      })
    } catch (error) {
      console.error('❌ Failed to update member count:', error)
    }
  }

  /**
   * Soft delete a room (set isActive to false)
   */
  async deleteRoom(roomId: string): Promise<boolean> {
    try {
      await prisma.empireRoom.update({
        where: { id: roomId },
        data: {
          isActive: false,
          updatedAt: new Date()
        }
      })
      
      console.log('✅ Room soft deleted successfully:', roomId)
      return true
    } catch (error) {
      console.error('❌ Failed to delete room:', error)
      return false
    }
  }

  /**
   * Search rooms by name or description
   */
  async searchRooms(query: string, limit: number = 20): Promise<EmpireRoom[]> {
    try {
      const rooms = await prisma.empireRoom.findMany({
        where: {
          AND: [
            { isActive: true },
            {
              OR: [
                { name: { contains: query, mode: 'insensitive' } },
                { description: { contains: query, mode: 'insensitive' } }
              ]
            }
          ]
        },
        orderBy: { createdAt: 'desc' },
        take: limit
      })
      return rooms
    } catch (error) {
      console.error('❌ Failed to search rooms:', error)
      return []
    }
  }

  /**
   * Get rooms statistics
   */
  async getRoomsStats(): Promise<{
    totalRooms: number
    activeRooms: number
    totalMessages: number
    totalMembers: number
  }> {
    try {
      const [totalRooms, activeRooms, messageStats] = await Promise.all([
        prisma.empireRoom.count(),
        prisma.empireRoom.count({ where: { isActive: true } }),
        prisma.empireRoom.aggregate({
          where: { isActive: true },
          _sum: {
            messageCount: true,
            memberCount: true
          }
        })
      ])

      return {
        totalRooms,
        activeRooms,
        totalMessages: messageStats._sum.messageCount || 0,
        totalMembers: messageStats._sum.memberCount || 0
      }
    } catch (error) {
      console.error('❌ Failed to get rooms stats:', error)
      return {
        totalRooms: 0,
        activeRooms: 0,
        totalMessages: 0,
        totalMembers: 0
      }
    }
  }

  /**
   * Check if user can access room (is creator or moderator)
   */
  async canUserModerateRoom(roomId: string, userAddress: string): Promise<boolean> {
    try {
      const room = await prisma.empireRoom.findUnique({
        where: { id: roomId },
        select: { createdBy: true, moderators: true }
      })

      if (!room) return false

      const userAddressLower = userAddress.toLowerCase()
      return (
        room.createdBy.toLowerCase() === userAddressLower ||
        room.moderators.some(mod => mod.toLowerCase() === userAddressLower)
      )
    } catch (error) {
      console.error('❌ Failed to check user moderation rights:', error)
      return false
    }
  }
}

// Export singleton instance
export const roomDatabaseService = new RoomDatabaseService()
export default roomDatabaseService