//--src/app/api/pinned-messages/emergency-override/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import type { EmergencyOverrideRequest } from '@/lib/services/pinnedMessages'
import pinnedMessagesService, { PLATFORM_ADMIN_ADDRESS } from '@/lib/services/pinnedMessages'

const prisma = new PrismaClient()

// Initialize service with Prisma client
pinnedMessagesService.setPrisma(prisma)

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json() as EmergencyOverrideRequest

    // Verify admin access
    if (body.adminAddress.toLowerCase() !== PLATFORM_ADMIN_ADDRESS.toLowerCase()) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized: Only platform admin can perform emergency overrides' 
      }, { status: 403 })
    }

    const updatedMessage = await pinnedMessagesService.emergencyOverride(body)

    return NextResponse.json({ 
      success: true, 
      message: updatedMessage,
      action: body.isOverride ? 'Message overridden (hidden)' : 'Override removed (restored)'
    })

  } catch (error) {
    console.error('Error performing emergency override:', error)
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to perform emergency override' 
    }, { status: 500 })
  }
}