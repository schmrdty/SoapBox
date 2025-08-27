//--src/app/api/pinned-messages/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import type { CreatePinnedMessageRequest, UpdatePinnedMessageRequest, EmergencyOverrideRequest } from '@/lib/services/pinnedMessages'
import pinnedMessagesService, { PLATFORM_ADMIN_ADDRESS } from '@/lib/services/pinnedMessages'

const prisma = new PrismaClient()

// Initialize service with Prisma client
pinnedMessagesService.setPrisma(prisma)

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url)
    const roomId = searchParams.get('roomId')
    const type = searchParams.get('type') // 'splash', 'signin', or room-specific

    if (type === 'splash') {
      const messages = await pinnedMessagesService.getSplashScreenMessages()
      return NextResponse.json({ success: true, messages })
    }

    if (type === 'signin') {
      const messages = await pinnedMessagesService.getSignInScreenMessages()
      return NextResponse.json({ success: true, messages })
    }

    if (roomId) {
      const messages = await pinnedMessagesService.getPinnedMessagesForRoom(roomId)
      return NextResponse.json({ success: true, messages })
    }

    return NextResponse.json({ 
      success: false, 
      error: 'Missing required parameters: roomId or type' 
    }, { status: 400 })

  } catch (error) {
    console.error('Error fetching pinned messages:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to fetch pinned messages' 
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json() as CreatePinnedMessageRequest & { 
      userAddress: string 
    }

    // Check if user has permission to pin messages in this room
    const permissions = await pinnedMessagesService.checkUserPermissions(
      body.userAddress, 
      body.roomId
    )

    if (!permissions.canPin) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized: Only room owners and moderators can pin messages' 
      }, { status: 403 })
    }

    const pinnedMessage = await pinnedMessagesService.createPinnedMessage({
      roomId: body.roomId,
      content: body.content,
      authorAddress: body.userAddress,
      authorName: body.authorName,
      showOnSplash: body.showOnSplash,
      showOnSignIn: body.showOnSignIn,
      displayOrder: body.displayOrder
    })

    return NextResponse.json({ 
      success: true, 
      message: pinnedMessage 
    })

  } catch (error) {
    console.error('Error creating pinned message:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to create pinned message' 
    }, { status: 500 })
  }
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json() as UpdatePinnedMessageRequest & { 
      userAddress: string 
    }

    // Get the pinned message to check room ownership
    const existingMessage = await prisma.pinnedMessage.findUnique({
      where: { id: body.id },
      include: { room: true }
    })

    if (!existingMessage) {
      return NextResponse.json({ 
        success: false, 
        error: 'Pinned message not found' 
      }, { status: 404 })
    }

    // Check permissions
    const permissions = await pinnedMessagesService.checkUserPermissions(
      body.userAddress, 
      existingMessage.roomId
    )

    if (!permissions.canPin) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized: Only room owners and moderators can modify pinned messages' 
      }, { status: 403 })
    }

    const updatedMessage = await pinnedMessagesService.updatePinnedMessage(body)

    return NextResponse.json({ 
      success: true, 
      message: updatedMessage 
    })

  } catch (error) {
    console.error('Error updating pinned message:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to update pinned message' 
    }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url)
    const messageId = searchParams.get('messageId')
    const userAddress = searchParams.get('userAddress')

    if (!messageId || !userAddress) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required parameters: messageId and userAddress' 
      }, { status: 400 })
    }

    // Get the pinned message to check room ownership
    const existingMessage = await prisma.pinnedMessage.findUnique({
      where: { id: messageId },
      include: { room: true }
    })

    if (!existingMessage) {
      return NextResponse.json({ 
        success: false, 
        error: 'Pinned message not found' 
      }, { status: 404 })
    }

    // Check permissions
    const permissions = await pinnedMessagesService.checkUserPermissions(
      userAddress, 
      existingMessage.roomId
    )

    if (!permissions.canPin) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized: Only room owners and moderators can delete pinned messages' 
      }, { status: 403 })
    }

    await pinnedMessagesService.deletePinnedMessage(messageId)

    return NextResponse.json({ 
      success: true, 
      message: 'Pinned message deleted successfully' 
    })

  } catch (error) {
    console.error('Error deleting pinned message:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to delete pinned message' 
    }, { status: 500 })
  }
}