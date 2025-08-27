//--src/app/api/moderation-audit/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const { 
      roomId, 
      empireVaultAddress, 
      moderatorAddress, 
      actionType, 
      actionDetails, 
      previousValue, 
      newValue 
    }: {
      roomId: string
      empireVaultAddress: string
      moderatorAddress: string
      actionType: string
      actionDetails: any
      previousValue?: any
      newValue?: any
    } = await req.json()

    if (!roomId || !empireVaultAddress || !moderatorAddress || !actionType) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
    }

    // First, verify the moderator is authorized before logging the audit
    const response = await fetch(`${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/api/cache-management`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'get_authorized_addresses',
        empireVaultAddress
      })
    })

    const cacheData = await response.json()
    
    if (!cacheData.success || !cacheData.authorizedAddresses.includes(moderatorAddress)) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized: Address not in authorized addresses list' 
      }, { status: 403 })
    }

    // Log the moderation action
    const auditEntry = await prisma.moderationAudit.create({
      data: {
        roomId,
        empireVaultAddress,
        moderatorAddress,
        actionType,
        actionDetails,
        previousValue,
        newValue
      }
    })

    // Update moderation settings cache if this was a settings change
    if (actionType === 'settings_change' && newValue) {
      await prisma.moderationSettingsCache.upsert({
        where: { empireVaultAddress },
        update: {
          settings: newValue,
          lastUpdated: new Date(),
          updatedBy: moderatorAddress
        },
        create: {
          empireVaultAddress,
          roomId,
          settings: newValue,
          lastUpdated: new Date(),
          updatedBy: moderatorAddress
        }
      })
    }

    return NextResponse.json({
      success: true,
      auditId: auditEntry.id,
      message: 'Moderation action logged successfully'
    })

  } catch (error) {
    console.error('Error logging moderation audit:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to log moderation action' },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(req.url)
    const roomId = searchParams.get('roomId')
    const empireVaultAddress = searchParams.get('empireVaultAddress')
    const moderatorAddress = searchParams.get('moderatorAddress')
    const actionType = searchParams.get('actionType')
    const limit = parseInt(searchParams.get('limit') || '50')

    if (!roomId && !empireVaultAddress) {
      return NextResponse.json({ success: false, error: 'Room ID or Empire Vault address required' }, { status: 400 })
    }

    // Build where clause
    const where: any = {}
    if (roomId) where.roomId = roomId
    if (empireVaultAddress) where.empireVaultAddress = empireVaultAddress
    if (moderatorAddress) where.moderatorAddress = moderatorAddress
    if (actionType) where.actionType = actionType

    const auditEntries = await prisma.moderationAudit.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit
    })

    return NextResponse.json({
      success: true,
      auditEntries,
      count: auditEntries.length
    })

  } catch (error) {
    console.error('Error fetching moderation audit:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch audit entries' },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}