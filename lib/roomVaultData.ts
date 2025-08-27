//--src/app/api/api/clear-vault-data/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { roomDatabaseService } from '@/lib/services/roomDatabase'

// Simple vault data clearing for development/testing
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json()
    const { vaultAddress, adminAddress } = body

    // Simple validation
    if (!vaultAddress || !adminAddress) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    console.log(`🗑️ Clearing test data for vault: ${vaultAddress}`)

    // Get existing room to check
    const existingRoom = await roomDatabaseService.getRoomByVaultAddress(vaultAddress)
    
    if (!existingRoom) {
      return NextResponse.json({
        success: true,
        message: 'No data to clear for this vault',
        cleared: false
      })
    }

    // Delete the room and related data
    const deleted = await roomDatabaseService.deleteRoom(existingRoom.id)
    
    if (deleted) {
      console.log(`✅ Cleared test room: ${existingRoom.name} (${existingRoom.id})`)
      
      return NextResponse.json({
        success: true,
        message: `Cleared test data for vault ${vaultAddress}`,
        cleared: true,
        clearedRoom: {
          id: existingRoom.id,
          name: existingRoom.name
        }
      })
    } else {
      return NextResponse.json(
        { success: false, error: 'Failed to clear data' },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('Clear vault data error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to clear vault data',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}