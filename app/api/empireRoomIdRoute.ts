//--src/app/api/empire-rooms/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { roomDatabaseService } from '@/lib/services/roomDatabase'
import { tokenInfoResolver } from '@/lib/services/tokenInfoResolver'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id: roomId } = await params

    // Get room data from database
    const room = await roomDatabaseService.getRoomById(roomId)

    if (!room) {
      return NextResponse.json({
        success: false,
        error: 'Room not found'
      }, { status: 404 })
    }

    // Convert to API format
    const settings = typeof room.settings === 'object' ? room.settings : {}
    const apiRoom = {
      id: room.id,
      name: room.name,
      description: room.description || '',
      empireVaultAddress: room.empireVaultAddress,
      tokenAddress: room.tokenAddress,
      tokenInfo: await (async () => {
        const resolvedTokenInfo = await tokenInfoResolver.resolveTokenInfoFromRoom({
          tokenInfo: room.tokenInfo,
          empireVaultAddress: room.empireVaultAddress,
          tokenAddress: room.tokenAddress
        })
        return {
          symbol: resolvedTokenInfo.symbol,
          name: resolvedTokenInfo.name,
          logoURI: resolvedTokenInfo.logoURI
        }
      })(),
      vaultType: 'clanker' as const,
      createdBy: room.createdBy,
      createdAt: room.createdAt.toISOString(),
      memberCount: room.memberCount,
      isActive: room.isActive,
      settings: settings,
      splitContractAddress: room.splitContractAddress || undefined,
      groupId: room.groupId || undefined,
      setupperAddress: room.setupperAddress || undefined,
      isSetupperAuthorized: room.isSetupperAuthorized,
      splitPercentages: room.isSetupperAuthorized ? {
        empireVault: 40,
        setupper: 20,
        devWallet: 20,
        myuVault: 20
      } : undefined,
      roomType: ((room as any).roomType as 'standard' | 'premium' | 'leaderboard') || 'standard',
      tokenGating: (settings && typeof settings === 'object' && !Array.isArray(settings) && (settings as any).tokenGating) || {
        enabled: false,
        minimumTokenBalance: '0',
        topHoldersOnly: false,
        maxHolderRank: 250,
        leaderboardOnly: false
      }
    }

    return NextResponse.json({
      success: true,
      data: apiRoom
    })

  } catch (error) {
    console.error('Failed to fetch room data:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch room data',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}