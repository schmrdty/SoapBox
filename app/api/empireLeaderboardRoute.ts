//--src/app/api/empire-leaderboard/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { empireApiService } from '@/lib/services/empireApi';

/**
 * GET /api/empire-leaderboard - Validate Empire Vault has leaderboard data
 * Query params:
 *   - vault: string (required) - Vault address to check
 *   - limit: number (optional) - Number of leaderboard entries to fetch (default: 1)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const vaultAddress = searchParams.get('vault');
    const limit = parseInt(searchParams.get('limit') || '1');

    if (!vaultAddress) {
      return NextResponse.json({
        success: false,
        error: 'Vault address is required',
        details: 'Please provide a vault address in the query parameters'
      }, { status: 400 });
    }

    console.log('🏆 Validating Empire Vault leaderboard:', { vaultAddress, limit });

    // Use empireApiService to get leaderboard and validate vault
    const vaultData = await empireApiService.getLeaderboard(vaultAddress, { limit });

    console.log('✅ Empire Vault leaderboard confirmed:', vaultData.leaderboard.length);

    return NextResponse.json({
      success: true,
      data: vaultData.leaderboard,
      count: vaultData.leaderboard.length,
      vaultAddress,
      tokenInfo: vaultData.tokenInfo,
      hasLeaderboard: vaultData.leaderboard.length > 0
    });

  } catch (error) {
    console.error('❌ Empire Vault leaderboard validation error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to validate Empire Vault leaderboard',
      details: error instanceof Error ? error.message : 'Invalid vault or no leaderboard data',
      vaultAddress: new URL(request.url).searchParams.get('vault')
    }, { status: 500 });
  }
}