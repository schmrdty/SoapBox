//--src/app/api/direct-messages/setup/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
  try {
    const { roomId, userAddress, txHash } = await request.json()

    if (!roomId || !userAddress || !txHash) {
      return NextResponse.json({
        success: false,
        error: 'Room ID, user address, and transaction hash are required'
      }, { status: 400 })
    }

    // Get room to verify setup cost
    const room = await prisma.empireRoom.findUnique({
      where: { id: roomId }
    })

    if (!room) {
      return NextResponse.json({
        success: false,
        error: 'Room not found'
      }, { status: 404 })
    }

    // Check if already setup
    const existingSetup = await prisma.directMessageSetup.findFirst({
      where: {
        roomId: roomId,
        userAddress: userAddress.toLowerCase()
      }
    })

    if (existingSetup?.setupFeePaid) {
      return NextResponse.json({
        success: true,
        data: existingSetup,
        message: 'Direct message access already active'
      })
    }

    // Record the setup payment
    const setupRecord = await prisma.directMessageSetup.upsert({
      where: {
        userAddress_roomId: {
          userAddress: userAddress.toLowerCase(),
          roomId: roomId
        }
      },
      update: {
        setupFeePaid: true,
        paidAt: new Date(),
        txHash: txHash
      },
      create: {
        userAddress: userAddress.toLowerCase(),
        roomId: roomId,
        setupFeePaid: true,
        paidAt: new Date(),
        txHash: txHash
      }
    })

    // Add user to room's DM paid users list
    const roomSettings = room.settings as any
    const updatedSettings = {
      ...roomSettings,
      directMessagePaidUsers: [
        ...(roomSettings?.directMessagePaidUsers || []),
        userAddress.toLowerCase()
      ].filter((addr, index, arr) => arr.indexOf(addr) === index) // Remove duplicates
    }

    await prisma.empireRoom.update({
      where: { id: roomId },
      data: { settings: updatedSettings }
    })

    return NextResponse.json({
      success: true,
      data: setupRecord,
      message: 'Direct message access activated successfully'
    })

  } catch (error) {
    console.error('Error recording DM setup:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to record direct message setup',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  } finally {
    await prisma.$disconnect()
  }
}