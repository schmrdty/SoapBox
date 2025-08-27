//--src/app/api/room-settings/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Room Settings API for saving room configuration
export async function PUT(request: NextRequest) {
  try {
    const data = await request.json();
    const { roomId, settings, freeGamesLimit } = data;

    if (!roomId || !settings) {
      return NextResponse.json({ error: 'Room ID and settings are required' }, { status: 400 });
    }

    // Update room settings in database
    const updatedRoom = await prisma.empireRoom.update({
      where: { id: roomId },
      data: {
        settings: settings,
        updatedAt: new Date()
      }
    });

    console.log('✅ Room settings saved successfully:', roomId);
    
    return NextResponse.json({ 
      success: true, 
      data: updatedRoom 
    });

  } catch (error) {
    console.error('Error saving room settings:', error);
    return NextResponse.json({ 
      error: 'Failed to save room settings',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('roomId');

    if (!roomId) {
      return NextResponse.json({ error: 'Room ID is required' }, { status: 400 });
    }

    const room = await prisma.empireRoom.findUnique({
      where: { id: roomId }
    });

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      data: room.settings 
    });

  } catch (error) {
    console.error('Error fetching room settings:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch room settings',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}