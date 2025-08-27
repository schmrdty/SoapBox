//--src/app/api/api/admin/cleanup-test-data/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/services/prisma'

// SECURITY: Only accessible by specific admin wallet address
const ADMIN_WALLET_ADDRESS = '0x6ca3DC917cc2F006472D54c276667bd5b3ffd82B'

// Validate admin access
function validateAdminAccess(walletAddress: string): boolean {
  return walletAddress.toLowerCase() === ADMIN_WALLET_ADDRESS.toLowerCase()
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    // Extract wallet address from request headers or body
    const body = await request.json()
    const { walletAddress, vaultAddress, confirmAction } = body

    // CRITICAL: Admin wallet validation
    if (!walletAddress || !validateAdminAccess(walletAddress)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Unauthorized', 
          message: 'This endpoint is restricted to authorized admin wallets only' 
        },
        { status: 403 }
      )
    }

    // Safety confirmation required
    if (!confirmAction || confirmAction !== 'DELETE_TEST_DATA') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Confirmation required', 
          message: 'Please confirm the action with confirmAction: "DELETE_TEST_DATA"' 
        },
        { status: 400 }
      )
    }

    // Vault address validation (optional - if not provided, cleans for your test vault)
    const targetVaultAddress = vaultAddress || '0x2d26B3Da95331e169ea9F31cA8CED9fa761deb26'
    
    if (!targetVaultAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid vault address', 
          message: 'Vault address must be a valid Ethereum address' 
        },
        { status: 400 }
      )
    }

    console.log(`🧹 Admin cleanup requested by ${walletAddress} for vault ${targetVaultAddress}`)

    // Get rooms to be deleted (for logging purposes)
    const roomsToDelete = await prisma.empireRoom.findMany({
      where: {
        empireVaultAddress: targetVaultAddress
      },
      select: {
        id: true,
        name: true,
        createdBy: true,
        createdAt: true,
        messageCount: true
      }
    })

    if (roomsToDelete.length === 0) {
      return NextResponse.json({
        success: true,
        message: `No test rooms found for vault ${targetVaultAddress}`,
        deletedCount: 0,
        details: {
          vaultAddress: targetVaultAddress,
          adminWallet: walletAddress,
          timestamp: new Date().toISOString()
        }
      })
    }

    // Execute cleanup transaction
    const cleanup = await prisma.$transaction(async (tx) => {
      // Delete related data first (to maintain referential integrity)
      const chatMessages = await tx.chatMessage.deleteMany({
        where: {
          room: {
            empireVaultAddress: targetVaultAddress
          }
        }
      })

      const pinnedMessages = await tx.pinnedMessage.deleteMany({
        where: {
          room: {
            empireVaultAddress: targetVaultAddress
          }
        }
      })

      const directMessages = await tx.directMessage.deleteMany({
        where: {
          room: {
            empireVaultAddress: targetVaultAddress
          }
        }
      })

      const directMessageSetups = await tx.directMessageSetup.deleteMany({
        where: {
          room: {
            empireVaultAddress: targetVaultAddress
          }
        }
      })

      // Delete rooms
      const deletedRooms = await tx.empireRoom.deleteMany({
        where: {
          empireVaultAddress: targetVaultAddress
        }
      })

      // Clean up cache entries
      const tokenCache = await tx.tokenCache.deleteMany({
        where: {
          empireVaultAddress: targetVaultAddress
        }
      })

      const authCache = await tx.authorizedAddressCache.deleteMany({
        where: {
          empireVaultAddress: targetVaultAddress
        }
      })

      const moderationAudit = await tx.moderationAudit.deleteMany({
        where: {
          empireVaultAddress: targetVaultAddress
        }
      })

      const moderationSettings = await tx.moderationSettingsCache.deleteMany({
        where: {
          empireVaultAddress: targetVaultAddress
        }
      })

      return {
        rooms: deletedRooms.count,
        chatMessages: chatMessages.count,
        pinnedMessages: pinnedMessages.count,
        directMessages: directMessages.count,
        directMessageSetups: directMessageSetups.count,
        tokenCache: tokenCache.count,
        authCache: authCache.count,
        moderationAudit: moderationAudit.count,
        moderationSettings: moderationSettings.count
      }
    })

    // Log successful cleanup
    console.log(`✅ Admin cleanup completed:`, {
      adminWallet: walletAddress,
      vaultAddress: targetVaultAddress,
      cleanupCounts: cleanup,
      deletedRooms: roomsToDelete.map(r => ({ id: r.id, name: r.name })),
      timestamp: new Date().toISOString()
    })

    return NextResponse.json({
      success: true,
      message: `Successfully cleaned up test data for vault ${targetVaultAddress}`,
      deletedCount: cleanup.rooms,
      details: {
        vaultAddress: targetVaultAddress,
        adminWallet: walletAddress,
        timestamp: new Date().toISOString(),
        cleanupCounts: cleanup,
        deletedRooms: roomsToDelete.map(room => ({
          id: room.id,
          name: room.name,
          createdBy: room.createdBy,
          createdAt: room.createdAt,
          messageCount: room.messageCount
        }))
      }
    })

  } catch (error) {
    console.error('❌ Admin cleanup failed:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Cleanup failed', 
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        details: {
          timestamp: new Date().toISOString()
        }
      },
      { status: 500 }
    )
  }
}

// GET endpoint for checking cleanup status (admin only)
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url)
    const walletAddress = searchParams.get('walletAddress')
    const vaultAddress = searchParams.get('vaultAddress') || '0x2d26B3Da95331e169ea9F31cA8CED9fa761deb26'

    // CRITICAL: Admin wallet validation
    if (!walletAddress || !validateAdminAccess(walletAddress)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Unauthorized', 
          message: 'This endpoint is restricted to authorized admin wallets only' 
        },
        { status: 403 }
      )
    }

    // Get current test data count
    const testData = await prisma.empireRoom.findMany({
      where: {
        empireVaultAddress: vaultAddress
      },
      select: {
        id: true,
        name: true,
        createdBy: true,
        createdAt: true,
        messageCount: true,
        memberCount: true,
        isActive: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json({
      success: true,
      vaultAddress: vaultAddress,
      testRoomCount: testData.length,
      testRooms: testData,
      adminWallet: walletAddress,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Admin status check failed:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Status check failed', 
        message: error instanceof Error ? error.message : 'Unknown error occurred' 
      },
      { status: 500 }
    )
  }
}