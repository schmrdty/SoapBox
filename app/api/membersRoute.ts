//--src/app/api/empire-rooms/[id]/members/route.ts
'use server'

import { NextRequest, NextResponse } from 'next/server'
import { empireApiService } from '@/lib/services/empireApi'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface RoomMember {
  address: string
  displayName?: string
  avatar?: string
  isOwner: boolean
  isModerator: boolean
  tokenBalance: string
  rank: number
  lastActive: Date
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id: roomId } = await params

    // Get real room data from database
    const room = await prisma.empireRoom.findUnique({
      where: { id: roomId }
    })

    if (!room) {
      return NextResponse.json({
        success: false,
        error: 'Room not found'
      }, { status: 404 })
    }

    try {
      // Get Empire leaderboard data using real room vault address
      const leaderboard = await empireApiService.getLeaderboard(room.empireVaultAddress)
      
      if (!leaderboard || !leaderboard.leaderboard) {
        return NextResponse.json({
          success: true,
          data: []
        })
      }

      // Transform leaderboard data to room members
      const members: RoomMember[] = leaderboard.leaderboard.slice(0, 100).map(holder => ({
        address: holder.address,
        displayName: undefined, // Empire API doesn't provide display names
        avatar: undefined,
        isOwner: holder.address.toLowerCase() === room.createdBy.toLowerCase(),
        isModerator: room.moderators?.includes(holder.address.toLowerCase()) || false,
        tokenBalance: holder.balance,
        rank: holder.rank,
        lastActive: new Date()
      }))

      return NextResponse.json({
        success: true,
        data: members
      })

    } catch (empireError) {
      console.error('Empire API error:', empireError)
      
      // Return empty members list if Empire API fails
      return NextResponse.json({
        success: true,
        data: []
      })
    }

  } catch (error) {
    console.error('Failed to fetch room members:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch room members',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}