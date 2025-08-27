//--src/app/api/user-access-check/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface TokenBalance {
  address: string
  symbol: string
  balance: string
  decimals: number
}

interface AvailableRoom {
  id: string
  name: string
  description?: string
  tokenSymbol: string
  memberCount: number
  empireVaultAddress: string
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const { userAddress }: { userAddress: string } = await req.json()

    if (!userAddress) {
      return NextResponse.json({ success: false, error: 'User address required' }, { status: 400 })
    }

    // Get all cached token contracts for quick lookup
    const cachedTokens = await prisma.tokenCache.findMany()

    if (cachedTokens.length === 0) {
      return NextResponse.json({
        success: true,
        tokenBalances: [],
        availableRooms: []
      })
    }

    // Build array of token addresses to check
    const tokenAddresses = cachedTokens.map(cache => cache.baseTokenAddress)

    // Check user's token balances via direct BaseScan API calls (server-side)
    const balanceChecks = await Promise.allSettled(
      tokenAddresses.map(async (tokenAddress) => {
        try {
          const apiUrl = new URL('https://api.basescan.org/api')
          apiUrl.searchParams.set('module', 'account')
          apiUrl.searchParams.set('action', 'tokenbalance')
          apiUrl.searchParams.set('contractaddress', tokenAddress)
          apiUrl.searchParams.set('address', userAddress)
          apiUrl.searchParams.set('tag', 'latest')
          apiUrl.searchParams.set('apikey', process.env.BASESCAN_API_KEY || 'YourApiKeyToken')

          const response = await fetch(apiUrl.toString(), {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
            },
            timeout: 8000 // 8 second timeout
          } as any)

          if (!response.ok) {
            throw new Error(`BaseScan API responded with status ${response.status}`)
          }

          const data = await response.json()
          
          if (data.status === '1' && parseFloat(data.result) > 0) {
            const tokenCache = cachedTokens.find(cache => cache.baseTokenAddress === tokenAddress)
            return {
              address: tokenAddress,
              symbol: tokenCache?.tokenSymbol || 'Unknown',
              balance: (parseFloat(data.result) / Math.pow(10, tokenCache?.tokenDecimals || 18)).toString(),
              decimals: tokenCache?.tokenDecimals || 18
            }
          }
          return null
        } catch (error) {
          console.warn(`Failed to fetch balance for ${tokenAddress}:`, error)
          return null
        }
      })
    )

    // Filter successful balance checks and non-zero balances
    const tokenBalances: TokenBalance[] = balanceChecks
      .filter((result): result is PromiseFulfilledResult<TokenBalance | null> => 
        result.status === 'fulfilled' && result.value !== null
      )
      .map(result => result.value)
      .filter((balance): balance is TokenBalance => balance !== null)

    // Get available rooms based on user's token holdings
    const tokensUserHolds = cachedTokens.filter(cache => 
      tokenBalances.some(balance => balance.address === cache.baseTokenAddress)
    )

    // Fetch room data for tokens user holds
    const roomIds = tokensUserHolds.map(cache => cache.roomId)
    const rooms = roomIds.length > 0 ? await prisma.empireRoom.findMany({
      where: {
        id: { in: roomIds },
        isActive: true
      },
      select: {
        id: true,
        name: true,
        description: true,
        memberCount: true,
        empireVaultAddress: true
      }
    }) : []

    // Map rooms with token symbols
    const availableRooms: AvailableRoom[] = rooms.map(room => {
      const tokenCache = tokensUserHolds.find(cache => cache.roomId === room.id)
      return {
        id: room.id,
        name: room.name,
        description: room.description || undefined,
        tokenSymbol: tokenCache?.tokenSymbol || 'Unknown',
        memberCount: room.memberCount,
        empireVaultAddress: room.empireVaultAddress
      }
    })

    return NextResponse.json({
      success: true,
      tokenBalances,
      availableRooms
    })

  } catch (error) {
    console.error('Error checking user access:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to check user access' },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}