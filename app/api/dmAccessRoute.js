//--src/app/api/direct-messages/access/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const roomId = searchParams.get('roomId')
    const userAddress = searchParams.get('userAddress')

    if (!roomId || !userAddress) {
      return NextResponse.json({
        success: false,
        error: 'Room ID and user address are required'
      }, { status: 400 })
    }

    // Get room to check DM settings
    const room = await prisma.empireRoom.findUnique({
      where: { id: roomId }
    })

    if (!room) {
      return NextResponse.json({
        success: false,
        error: 'Room not found'
      }, { status: 404 })
    }

    // Check if DMs are enabled by moderator
    const roomSettings = room.settings as any
    if (!roomSettings?.directMessagesEnabled) {
      return NextResponse.json({
        success: true,
        data: {
          hasAccess: false,
          reason: 'disabled',
          message: 'Direct messages are disabled in this room'
        }
      })
    }

    // Check if user has paid setup fee
    const setupRecord = await prisma.directMessageSetup.findFirst({
      where: {
        roomId: roomId,
        userAddress: userAddress.toLowerCase()
      }
    })

    const hasAccess = !!setupRecord?.setupFeePaid

    return NextResponse.json({
      success: true,
      data: {
        hasAccess,
        reason: hasAccess ? 'paid' : 'unpaid',
        setupCost: roomSettings?.directMessageSetupCost || 500,
        paidAt: setupRecord?.paidAt || null
      }
    })

  } catch (error) {
    console.error('Error checking DM access:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to check direct message access',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  } finally {
    await prisma.$disconnect()
  }
}