//--src/app/api/token-info/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { tokenInfoResolver } from '@/lib/services/tokenInfoResolver'

export async function POST(request: NextRequest) {
  try {
    const { vaultAddress, tokenAddress, fallbackPrefix = 'TOKEN' } = await request.json()

    // Validate input
    if (!vaultAddress && !tokenAddress) {
      return NextResponse.json({
        success: false,
        error: 'Either vaultAddress or tokenAddress is required'
      }, { status: 400 })
    }

    console.log('🔍 Token info API request:', { vaultAddress, tokenAddress, fallbackPrefix })

    // Use the token info resolver to get comprehensive token metadata
    const resolvedTokenInfo = await tokenInfoResolver.resolveTokenInfo({
      vaultAddress,
      tokenAddress,
      fallbackPrefix
    })

    console.log('✅ Token info resolved successfully:', resolvedTokenInfo)

    return NextResponse.json({
      success: true,
      data: resolvedTokenInfo
    })

  } catch (error) {
    console.error('❌ Token info API error:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to resolve token info'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const vaultAddress = searchParams.get('vault')
  const tokenAddress = searchParams.get('token')
  const fallbackPrefix = searchParams.get('prefix') || 'TOKEN'

  try {
    // Validate input
    if (!vaultAddress && !tokenAddress) {
      return NextResponse.json({
        success: false,
        error: 'Either vault or token parameter is required'
      }, { status: 400 })
    }

    console.log('🔍 Token info GET API request:', { vaultAddress, tokenAddress, fallbackPrefix })

    // Use the token info resolver to get comprehensive token metadata
    const resolvedTokenInfo = await tokenInfoResolver.resolveTokenInfo({
      vaultAddress: vaultAddress || undefined,
      tokenAddress: tokenAddress || undefined,
      fallbackPrefix
    })

    console.log('✅ Token info resolved successfully via GET:', resolvedTokenInfo)

    return NextResponse.json({
      success: true,
      data: resolvedTokenInfo
    })

  } catch (error) {
    console.error('❌ Token info GET API error:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to resolve token info'
    }, { status: 500 })
  }
}