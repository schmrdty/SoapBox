//--src/app/api/empire-token-info/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { empireApiService } from '@/lib/services/empireApi'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const address = searchParams.get('address')

    // Validate input
    if (!address) {
      return NextResponse.json({
        success: false,
        error: 'Token address is required'
      }, { status: 400 })
    }

    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid token address format'
      }, { status: 400 })
    }

    console.log('🔍 Empire token info API request:', address)

    try {
      // Use Empire API service to get comprehensive token info
      const tokenInfo = await empireApiService.getTokenInfo(address)

      console.log('✅ Empire token info retrieved successfully:', {
        address,
        symbol: tokenInfo.symbol,
        name: tokenInfo.name,
        verified: tokenInfo.isVerified
      })

      return NextResponse.json({
        success: true,
        data: tokenInfo
      })

    } catch (empireError) {
      console.warn('⚠️ Empire API failed, attempting fallback via tokenUtils:', empireError)

      // Fallback to tokenUtils if Empire API fails
      try {
        const { tokenUtils } = await import('@/lib/tokenUtils')
        const fallbackTokenInfo = await tokenUtils.fetchTokenInfo(address)

        const tokenInfo = {
          address,
          symbol: fallbackTokenInfo.symbol,
          name: fallbackTokenInfo.name,
          decimals: fallbackTokenInfo.decimals,
          logoURI: fallbackTokenInfo.logoURI,
          priceUSD: undefined,
          marketCap: undefined,
          volume24h: undefined,
          isVerified: false // tokenUtils doesn't provide verification status
        }

        console.log('✅ Fallback token info retrieved successfully:', tokenInfo)

        return NextResponse.json({
          success: true,
          data: tokenInfo,
          meta: {
            source: 'fallback',
            note: 'Retrieved via tokenUtils fallback after Empire API failed'
          }
        })

      } catch (fallbackError) {
        console.error('❌ Both Empire API and tokenUtils fallback failed:', fallbackError)

        // Return structured error response
        const shortAddress = address.slice(-8)
        const errorTokenInfo = {
          address,
          symbol: `ERROR_${shortAddress}`,
          name: `Token Info Unavailable (${shortAddress})`,
          decimals: 18,
          logoURI: undefined,
          priceUSD: undefined,
          marketCap: undefined,
          volume24h: undefined,
          isVerified: false
        }

        return NextResponse.json({
          success: true, // Still return success to avoid breaking client code
          data: errorTokenInfo,
          meta: {
            source: 'error_fallback',
            empireError: empireError instanceof Error ? empireError.message : 'Empire API failed',
            fallbackError: fallbackError instanceof Error ? fallbackError.message : 'TokenUtils fallback failed'
          }
        })
      }
    }

  } catch (error) {
    console.error('❌ Empire token info API error:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get Empire token info'
    }, { status: 500 })
  }
}