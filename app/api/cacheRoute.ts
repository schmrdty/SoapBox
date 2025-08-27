//--src/app/api/cache-management/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Cache refresh interval: 24 hours in milliseconds
const CACHE_REFRESH_INTERVAL = 24 * 60 * 60 * 1000

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const { action, empireVaultAddress, roomId, baseTokenAddress, tokenData }: {
      action: 'cache_token' | 'refresh_authorized_addresses' | 'get_authorized_addresses'
      empireVaultAddress?: string
      roomId?: string
      baseTokenAddress?: string
      tokenData?: {
        tokenSymbol: string
        tokenName?: string
        tokenDecimals?: number
      }
    } = await req.json()

    switch (action) {
      case 'cache_token':
        if (!baseTokenAddress || !empireVaultAddress || !roomId || !tokenData) {
          return NextResponse.json({ success: false, error: 'Missing required fields for token caching' }, { status: 400 })
        }

        // Cache the token contract address for quick lookup
        await prisma.tokenCache.upsert({
          where: { baseTokenAddress },
          update: {
            empireVaultAddress,
            roomId,
            tokenSymbol: tokenData.tokenSymbol,
            tokenName: tokenData.tokenName,
            tokenDecimals: tokenData.tokenDecimals,
            updatedAt: new Date()
          },
          create: {
            baseTokenAddress,
            empireVaultAddress,
            roomId,
            tokenSymbol: tokenData.tokenSymbol,
            tokenName: tokenData.tokenName,
            tokenDecimals: tokenData.tokenDecimals
          }
        })

        return NextResponse.json({ success: true, message: 'Token cached successfully' })

      case 'refresh_authorized_addresses':
        if (!empireVaultAddress) {
          return NextResponse.json({ success: false, error: 'Empire vault address required' }, { status: 400 })
        }

        // Check if refresh is already in progress
        const existingCache = await prisma.authorizedAddressCache.findUnique({
          where: { empireVaultAddress }
        })

        if (existingCache?.refreshInProgress) {
          return NextResponse.json({ success: false, error: 'Refresh already in progress' }, { status: 429 })
        }

        // Set refresh in progress flag
        await prisma.authorizedAddressCache.upsert({
          where: { empireVaultAddress },
          update: { refreshInProgress: true },
          create: {
            empireVaultAddress,
            authorizedAddresses: [],
            refreshInProgress: true
          }
        })

        try {
          // Call getAuthorizedAddresses from Empire API
          const response = await fetch(`${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/api/proxy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              protocol: 'https',
              origin: 'empire-api.xyz', // Replace with actual Empire API domain
              path: '/getAuthorizedAddresses',
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: { empireVaultAddress }
            })
          })

          const data = await response.json()
          
          if (data.success && Array.isArray(data.authorizedAddresses)) {
            // Update cache with fresh authorized addresses
            await prisma.authorizedAddressCache.upsert({
              where: { empireVaultAddress },
              update: {
                authorizedAddresses: data.authorizedAddresses,
                lastRefreshed: new Date(),
                refreshInProgress: false
              },
              create: {
                empireVaultAddress,
                authorizedAddresses: data.authorizedAddresses,
                lastRefreshed: new Date(),
                refreshInProgress: false
              }
            })

            return NextResponse.json({
              success: true,
              authorizedAddresses: data.authorizedAddresses,
              refreshed: true
            })
          } else {
            throw new Error('Invalid response from Empire API')
          }
        } catch (error) {
          // Clear refresh in progress flag on error
          await prisma.authorizedAddressCache.update({
            where: { empireVaultAddress },
            data: { refreshInProgress: false }
          })
          throw error
        }

      case 'get_authorized_addresses':
        if (!empireVaultAddress) {
          return NextResponse.json({ success: false, error: 'Empire vault address required' }, { status: 400 })
        }

        const cachedAddresses = await prisma.authorizedAddressCache.findUnique({
          where: { empireVaultAddress }
        })

        if (!cachedAddresses) {
          // No cache exists, trigger refresh
          return NextResponse.json({
            success: false,
            error: 'No cached addresses found',
            needsRefresh: true
          })
        }

        const now = new Date()
        const cacheAge = now.getTime() - cachedAddresses.lastRefreshed.getTime()

        if (cacheAge > CACHE_REFRESH_INTERVAL) {
          // Cache is stale, trigger refresh but return current cache
          // Don't await this - let it refresh in background
          fetch(`${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/api/cache-management`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'refresh_authorized_addresses',
              empireVaultAddress
            })
          }).catch(console.error)

          return NextResponse.json({
            success: true,
            authorizedAddresses: cachedAddresses.authorizedAddresses,
            isStale: true,
            lastRefreshed: cachedAddresses.lastRefreshed
          })
        }

        return NextResponse.json({
          success: true,
          authorizedAddresses: cachedAddresses.authorizedAddresses,
          isStale: false,
          lastRefreshed: cachedAddresses.lastRefreshed
        })

      default:
        return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
    }

  } catch (error) {
    console.error('Error in cache management:', error)
    return NextResponse.json(
      { success: false, error: 'Cache management failed' },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}