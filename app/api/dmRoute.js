//--src/app/api/direct-messages/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const roomId = searchParams.get('roomId')
    const userAddress = searchParams.get('userAddress')
    const recipientAddress = searchParams.get('recipientAddress')

    if (!roomId || !userAddress || !recipientAddress) {
      return NextResponse.json({
        success: false,
        error: 'Room ID, user address, and recipient address are required'
      }, { status: 400 })
    }

    // Check if user has DM access
    const setupRecord = await prisma.directMessageSetup.findFirst({
      where: {
        roomId: roomId,
        userAddress: userAddress.toLowerCase(),
        setupFeePaid: true
      }
    })

    if (!setupRecord) {
      return NextResponse.json({
        success: false,
        error: 'Direct message access not activated'
      }, { status: 403 })
    }

    // Get direct messages between the two users in this room context
    const messages = await prisma.directMessage.findMany({
      where: {
        roomId: roomId,
        OR: [
          {
            fromAddress: userAddress.toLowerCase(),
            toAddress: recipientAddress.toLowerCase()
          },
          {
            fromAddress: recipientAddress.toLowerCase(),
            toAddress: userAddress.toLowerCase()
          }
        ]
      },
      orderBy: {
        timestamp: 'asc'
      }
    })

    return NextResponse.json({
      success: true,
      data: messages
    })

  } catch (error) {
    console.error('Error fetching direct messages:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch direct messages',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  } finally {
    await prisma.$disconnect()
  }
}

export async function POST(request: NextRequest) {
  try {
    const { roomId, fromAddress, toAddress, content } = await request.json()

    if (!roomId || !fromAddress || !toAddress || !content) {
      return NextResponse.json({
        success: false,
        error: 'Room ID, from address, to address, and content are required'
      }, { status: 400 })
    }

    // Check if sender has DM access
    const setupRecord = await prisma.directMessageSetup.findFirst({
      where: {
        roomId: roomId,
        userAddress: fromAddress.toLowerCase(),
        setupFeePaid: true
      }
    })

    if (!setupRecord) {
      return NextResponse.json({
        success: false,
        error: 'Direct message access not activated'
      }, { status: 403 })
    }

    // Check if room has DMs enabled
    const room = await prisma.empireRoom.findUnique({
      where: { id: roomId }
    })

    const roomSettings = room?.settings as any
    if (!room || !roomSettings?.directMessagesEnabled) {
      return NextResponse.json({
        success: false,
        error: 'Direct messages are disabled in this room'
      }, { status: 403 })
    }

    // Create the direct message
    const directMessage = await prisma.directMessage.create({
      data: {
        fromAddress: fromAddress.toLowerCase(),
        toAddress: toAddress.toLowerCase(),
        content: content.trim(),
        roomId: roomId,
        timestamp: new Date(),
        isRead: false
      }
    })

    return NextResponse.json({
      success: true,
      data: directMessage,
      message: 'Direct message sent successfully'
    })

  } catch (error) {
    console.error('Error sending direct message:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to send direct message',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  } finally {
    await prisma.$disconnect()
  }
}