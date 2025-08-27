//--src/app/api/empire-rooms/[id]/messages/route.ts
'use server'

import { NextRequest, NextResponse } from 'next/server'
import { chatMessagesService } from '@/lib/services/chatMessages'
import type { ChatMessage } from '@/app/types/chat'

interface MessageQuery {
  limit?: string
  before?: string
  after?: string
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id: roomId } = await params
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const before = searchParams.get('before')
    const after = searchParams.get('after')

    // Get messages from database
    const messages = await chatMessagesService.getMessages(roomId, {
      limit,
      before: before || undefined,
      after: after || undefined
    })

    return NextResponse.json({
      success: true,
      data: messages,
      pagination: {
        hasMore: messages.length >= limit,
        nextCursor: messages.length > 0 ? messages[messages.length - 1].id : null,
        prevCursor: messages.length > 0 ? messages[0].id : null
      }
    })

  } catch (error) {
    console.error('Failed to fetch room messages:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch room messages',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id: roomId } = await params
    const body = await request.json()
    const { content, senderAddress, type = 'text', imageUrl, linkUrl, tipAmount, tipCurrency, tipRecipient, replyTo, metadata } = body

    if (!content || !senderAddress) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: content, senderAddress'
        },
        { status: 400 }
      )
    }

    // Import rate limiting and moderation services
    const { messageRateLimiter } = await import('@/lib/services/messageRateLimit')
    const { gemmaModerationService } = await import('@/lib/services/gemmaModeration')

    // 1. Check rate limiting
    const rateLimitResult = messageRateLimiter.canSendMessage(senderAddress, roomId)
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Rate limit exceeded',
          message: rateLimitResult.reason,
          retryAfter: rateLimitResult.retryAfter
        },
        { status: 429 }
      )
    }

    // 2. Check message content for moderation
    const moderationResult = await gemmaModerationService.moderateContent(content)
    if (!moderationResult.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Message blocked by moderation',
          message: moderationResult.reason,
          categories: moderationResult.categories
        },
        { status: 403 }
      )
    }

    // 3. Validate user has access to the room (basic check)
    // In production, this would check Empire API for user's token balance
    
    // 4. Process any commands (tips, games, etc.) - handled by client

    // 5. Create message in database
    const newMessage = await chatMessagesService.createMessage({
      roomId,
      content,
      senderAddress,
      type,
      imageUrl,
      linkUrl,
      tipAmount,
      tipCurrency,
      tipRecipient,
      replyTo,
      metadata
    })

    // 6. Return the created message with rate limit status
    const userStatus = messageRateLimiter.getUserStatus(senderAddress, roomId)

    return NextResponse.json({
      success: true,
      data: newMessage,
      rateLimit: {
        messagesRemaining: userStatus.messagesRemaining,
        windowResetTime: userStatus.windowResetTime,
        cooldownRemaining: userStatus.cooldownRemaining
      },
      moderation: {
        confidence: moderationResult.confidence,
        categories: moderationResult.categories
      }
    })

  } catch (error) {
    console.error('Failed to create message:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create message',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}