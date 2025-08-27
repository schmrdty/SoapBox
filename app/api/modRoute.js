//--src/app/api/moderator-check/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userAddress = searchParams.get('userAddress')

    if (!userAddress) {
      return NextResponse.json({ error: 'User address is required' }, { status: 400 })
    }

    // Check if user is a moderator of any room
    const moderatedRooms = await prisma.empireRoom.findMany({
      where: {
        createdBy: userAddress.toLowerCase(),
      },
      select: {
        id: true,
        name: true,
        empireVaultAddress: true,
      }
    })

    const isModerator = moderatedRooms.length > 0

    return NextResponse.json({
      isModerator,
      moderatedRooms: moderatedRooms.map(room => ({
        id: room.id,
        name: room.name,
        vaultAddress: room.empireVaultAddress
      }))
    })

  } catch (error) {
    console.error('Error checking moderator status:', error)
    return NextResponse.json(
      { error: 'Failed to check moderator status' },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}