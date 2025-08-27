//--src/app/api/token-info-batch/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { tokenInfoResolver } from '@/lib/services/tokenInfoResolver'

interface BatchTokenRequest {
  vaultAddress?: string
  tokenAddress?: string
  fallbackPrefix?: string
}

export async function POST(request: NextRequest) {
  try {
    const { requests }: { requests: BatchTokenRequest[] } = await request.json()

    // Validate input
    if (!requests || !Array.isArray(requests) || requests.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Requests array is required and must not be empty'
      }, { status: 400 })
    }

    if (requests.length > 50) {
      return NextResponse.json({
        success: false,
        error: 'Maximum 50 requests allowed per batch'
      }, { status: 400 })
    }

    console.log('🔍 Batch token info API request:', requests.length, 'requests')

    // Process all token info requests in parallel
    const resolvedTokens = await Promise.all(
      requests.map(async (req, index) => {
        try {
          const { vaultAddress, tokenAddress, fallbackPrefix = 'TOKEN' } = req

          if (!vaultAddress && !tokenAddress) {
            console.warn(`⚠️ Batch request ${index}: Missing vaultAddress or tokenAddress`)
            return {
              symbol: `ERROR_${index}`,
              name: `Request ${index} Error`,
              verified: false,
              source: 'error',
              error: 'Either vaultAddress or tokenAddress is required'
            }
          }

          return await tokenInfoResolver.resolveTokenInfo({
            vaultAddress,
            tokenAddress,
            fallbackPrefix: `${fallbackPrefix}_${index}`
          })

        } catch (error) {
          console.error(`❌ Batch request ${index} failed:`, error)
          return {
            symbol: `ERROR_${index}`,
            name: `Token ${index} Error`,
            verified: false,
            source: 'error',
            error: error instanceof Error ? error.message : 'Token resolution failed'
          }
        }
      })
    )

    const successCount = resolvedTokens.filter(token => token.source !== 'error').length
    const errorCount = resolvedTokens.length - successCount

    console.log('✅ Batch token info resolved:', {
      total: resolvedTokens.length,
      successful: successCount,
      errors: errorCount
    })

    return NextResponse.json({
      success: true,
      data: resolvedTokens,
      meta: {
        total: resolvedTokens.length,
        successful: successCount,
        errors: errorCount
      }
    })

  } catch (error) {
    console.error('❌ Batch token info API error:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to resolve batch token info'
    }, { status: 500 })
  }
}