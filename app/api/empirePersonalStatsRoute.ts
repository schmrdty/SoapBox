//--src/app/api/empire-personal-stats/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { empireApiService } from '@/lib/services/empireApi'

export async function POST(request: NextRequest) {
  try {
    const { empireTokenAddress, userAddress } = await request.json()

    // Validate input
    if (!empireTokenAddress || !userAddress) {
      return NextResponse.json({
        success: false,
        error: 'Both empireTokenAddress and userAddress are required'
      }, { status: 400 })
    }

    // Validate address formats
    if (!/^0x[a-fA-F0-9]{40}$/.test(empireTokenAddress)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid empire token address format'
      }, { status: 400 })
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(userAddress)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid user address format'
      }, { status: 400 })
    }

    console.log('🔍 Empire personal stats API request:', { empireTokenAddress, userAddress })

    try {
      // Use Empire API service to get personal stats
      const personalStats = await empireApiService.getPersonalStats(empireTokenAddress, userAddress)

      console.log('✅ Empire personal stats retrieved successfully:', {
        userAddress,
        totalVaults: personalStats.totalVaults,
        totalTokensHeld: personalStats.totalTokensHeld
      })

      return NextResponse.json({
        success: true,
        data: personalStats
      })

    } catch (empireError) {
      console.warn('⚠️ Empire API personal stats failed:', empireError)

      // Return structured fallback response when Empire API fails
      const fallbackStats = {
        address: userAddress,
        totalVaults: 0,
        totalTokensHeld: '0',
        totalValueUSD: '0',
        topVaultsByValue: [],
        recentActivity: []
      }

      return NextResponse.json({
        success: true, // Still return success to avoid breaking client code
        data: fallbackStats,
        meta: {
          source: 'fallback',
          note: 'Empire API unavailable - returning default stats',
          error: empireError instanceof Error ? empireError.message : 'Empire API failed'
        }
      })
    }

  } catch (error) {
    console.error('❌ Empire personal stats API error:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get Empire personal stats'
    }, { status: 500 })
  }
}