//--src/app/api/empire-rooms/route.ts
//review for modularity?
import { NextRequest, NextResponse } from 'next/server'
import { empireApiService } from '@/lib/services/empireApi'
import { realAnalyticsService } from '@/lib/services/realAnalytics'
import { consolidatedSoapboxValidation } from '@/lib/services/consolidatedSoapboxValidation'
import { createResilientPublicClient } from '@/lib/rpc-config'
import { tokenUtils } from '@/lib/tokenUtils'
import { roomDatabaseService } from '@/lib/services/roomDatabase'
import { tokenInfoResolver } from '@/lib/services/tokenInfoResolver'
import type { EmpireRoom as PrismaEmpireRoom } from '@prisma/client'

export interface EmpireRoom {
  id: string
  name: string
  description: string
  empireVaultAddress: string
  tokenAddress: string
  tokenInfo: {
    symbol: string
    name: string
    logoURI?: string
  }
  vaultType: 'clanker' | 'glanker'
  createdBy: string
  createdAt: string
  memberCount: number
  isActive: boolean
  settings: any
  splitContractAddress?: string
  // NEW: Enhanced 4-way split fields  
  groupId?: string
  setupperAddress?: string
  isSetupperAuthorized?: boolean
  splitPercentages?: {
    empireVault: number
    setupper: number
    devWallet: number
    myuVault: number
  }
  // NEW: Multi-room and token-gating support
  roomType: 'standard' | 'premium' | 'leaderboard'
  tokenGating?: {
    enabled: boolean
    minimumTokenBalance: string
    topHoldersOnly: boolean
    maxHolderRank: number
    leaderboardOnly: boolean
  }
}

interface CreateEmpireRoomRequest {
  name: string
  description: string
  empireVaultAddress: string
  roomType: 'standard' | 'premium' | 'leaderboard' // NEW: Allow multiple rooms per vault including leaderboard
  settings: {
    sfwLevel: 'strict' | 'moderate' | 'relaxed'
    maxMessageLength: number
    cooldownSeconds: number
    allowImages: boolean
    allowLinks: boolean
    allowGames: boolean
    tagAllCost: number
    imageCost: number
    linkCost: number
    gameCost: number
    // NEW: Token Gating Settings
    tokenGating: {
      enabled: boolean
      minimumTokenBalance: string
      topHoldersOnly: boolean
      maxHolderRank: number // Customizable rank limit (10-250)
      leaderboardOnly: boolean // Restrict to leaderboard users only
    }
  }
  createdBy: string
}

// In-memory storage as fallback when database is not available
let memoryStorage: EmpireRoom[] = []

// Redis client (optional)
let redis: any = null
const CACHE_PREFIX = 'soapbox:empire-rooms:'
const CACHE_TTL = 300 // 5 minutes

// Initialize Redis if available
const initRedis = async (): Promise<void> => {
  if (typeof window !== 'undefined') return // Client-side guard
  
  try {
    if (process.env.REDIS_USERNAME && process.env.REDIS_PASSWORD && process.env.REDIS_PUBLIC_API && !redis) {
      const Redis = (await import('ioredis')).default
      
      const redisUrl = `redis://${process.env.REDIS_USERNAME}:${process.env.REDIS_PASSWORD}@${process.env.REDIS_PUBLIC_API}`
      redis = new Redis(redisUrl)
      
      redis.on('error', (error: Error) => {
        console.warn('Redis connection error:', error.message)
        redis = null
      })
      
      await redis.ping()
      console.log('✅ Redis connected for Empire rooms API')
    }
  } catch (error) {
    console.warn('⚠️ Redis initialization failed, using memory storage:', error)
    redis = null
  }
}

// Get rooms from database with Redis caching
const getRoomsFromStorage = async (includeInactive: boolean = false): Promise<EmpireRoom[]> => {
  const cacheKey = includeInactive ? `${CACHE_PREFIX}all-admin` : `${CACHE_PREFIX}all`
  
  // Try Redis cache first
  if (redis) {
    try {
      const cached = await redis.get(cacheKey)
      if (cached) {
        const cachedRooms = JSON.parse(cached) as EmpireRoom[]
        // Filter based on admin access
        return includeInactive ? cachedRooms : cachedRooms.filter(room => room.isActive)
      }
    } catch (error) {
      console.warn('Failed to get Empire rooms from Redis:', error)
    }
  }
  
  // Get from database
  try {
    const dbRooms = await roomDatabaseService.getAllRooms(100, 0)
    
    // Resolve token info for all rooms in parallel to eliminate UNKNOWN placeholders
    const roomsWithTokenInfo = await Promise.all(
      dbRooms.map(async (room) => {
        const settings = typeof room.settings === 'object' ? room.settings : {}
        
        // Resolve real token info instead of using UNKNOWN placeholders
        const resolvedTokenInfo = await tokenInfoResolver.resolveTokenInfoFromRoom({
          tokenInfo: room.tokenInfo,
          empireVaultAddress: room.empireVaultAddress,
          tokenAddress: room.tokenAddress
        })
        
        return {
          id: room.id,
          name: room.name,
          description: room.description || '',
          empireVaultAddress: room.empireVaultAddress,
          tokenAddress: room.tokenAddress,
          tokenInfo: {
            symbol: resolvedTokenInfo.symbol,
            name: resolvedTokenInfo.name,
            logoURI: resolvedTokenInfo.logoURI
          },
        vaultType: 'clanker' as const,
        createdBy: room.createdBy,
        createdAt: room.createdAt.toISOString(),
        memberCount: room.memberCount,
        isActive: room.isActive,
        settings: settings,
        splitContractAddress: room.splitContractAddress || undefined,
        groupId: room.groupId || undefined,
        setupperAddress: room.setupperAddress || undefined,
        isSetupperAuthorized: room.isSetupperAuthorized || false,
        splitPercentages: room.isSetupperAuthorized ? {
          empireVault: 40,
          setupper: 20,
          devWallet: 20,
          myuVault: 20
        } : undefined,
        // NEW: Required fields for enhanced API (with fallback for missing schema field)
        roomType: ((room as any).roomType as 'standard' | 'premium' | 'leaderboard') || 'standard',
        tokenGating: (settings && typeof settings === 'object' && !Array.isArray(settings) && (settings as any).tokenGating) || {
          enabled: false,
          minimumTokenBalance: '0',
          topHoldersOnly: false,
          maxHolderRank: 250,
          leaderboardOnly: false
        }
        }
      })
    )
    
    const rooms: EmpireRoom[] = roomsWithTokenInfo
    
    // Cache in Redis with appropriate key
    if (redis) {
      try {
        await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(rooms))
      } catch (error) {
        console.warn('Failed to cache rooms in Redis:', error)
      }
    }
    
    // Return based on admin access
    return includeInactive ? rooms : rooms.filter(room => room.isActive)
  } catch (error) {
    console.error('Failed to get rooms from database:', error)
    const fallbackRooms = includeInactive ? memoryStorage : memoryStorage.filter(room => room.isActive)
    return fallbackRooms
  }
}

// Clear cache when rooms are updated
const clearRoomsCache = async (): Promise<void> => {
  if (redis) {
    try {
      // Clear both admin and regular caches
      await redis.del(`${CACHE_PREFIX}all`)
      await redis.del(`${CACHE_PREFIX}all-admin`)
      // Clear any vault-specific caches
      const keys = await redis.keys(`${CACHE_PREFIX}vault:*`)
      if (keys.length > 0) {
        await redis.del(...keys)
      }
      console.log('✅ All room caches (including admin cache) cleared successfully')
    } catch (error) {
      console.warn('Failed to clear rooms cache:', error)
    }
  }
  // Also clear memory storage
  memoryStorage = memoryStorage.filter(room => room.isActive)
}

// Validate Empire room data
const validateEmpireRoom = (data: any): data is CreateEmpireRoomRequest => {
  return (
    typeof data.name === 'string' &&
    data.name.trim().length > 0 &&
    typeof data.description === 'string' &&
    typeof data.empireVaultAddress === 'string' &&
    data.empireVaultAddress.match(/^0x[a-fA-F0-9]{40}$/) &&
    typeof data.createdBy === 'string' &&
    data.createdBy.match(/^0x[a-fA-F0-9]{40}$/) &&
    typeof data.settings === 'object' &&
    typeof data.settings.sfwLevel === 'string' &&
    ['strict', 'moderate', 'relaxed'].includes(data.settings.sfwLevel)
  )
}

// GET /api/empire-rooms - List all SoapBoxes (Empire-powered rooms)
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await initRedis()
    
    const { searchParams } = new URL(request.url)
    const filter = searchParams.get('filter') || 'all'
    const search = searchParams.get('search') || ''
    const vaultType = searchParams.get('vaultType') as 'clanker' | 'glanker' | null
    
    // Admin access check for viewing inactive rooms
    const includeInactive = filter === 'admin-all'
    let rooms = await getRoomsFromStorage(includeInactive)
    
    // Apply vault type filter
    if (vaultType) {
      rooms = rooms.filter(room => room.vaultType === vaultType)
    }
    
    // Apply search
    if (search) {
      const searchLower = search.toLowerCase()
      rooms = rooms.filter(room =>
        room.name.toLowerCase().includes(searchLower) ||
        room.description.toLowerCase().includes(searchLower) ||
        room.tokenInfo.name.toLowerCase().includes(searchLower) ||
        room.tokenInfo.symbol.toLowerCase().includes(searchLower)
      )
    }
    
    // Apply activity filter
    if (filter === 'active') {
      rooms = rooms.filter(room => room.isActive)
    } else if (filter === 'inactive') {
      rooms = rooms.filter(room => !room.isActive)
    }
    
    return NextResponse.json({
      success: true,
      data: rooms,
      total: rooms.length,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('GET /api/empire-rooms error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch Empire rooms',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// POST /api/empire-rooms - Create a new SoapBox (Empire-powered room)
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    await initRedis()
    
    const body = await request.json()
    
    if (!validateEmpireRoom(body)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid Empire room data',
          message: 'Required fields: name, description, empireVaultAddress, settings, createdBy'
        },
        { status: 400 }
      )
    }
    
    // 🔒 ENHANCED SERVER-SIDE VALIDATION with improved error handling
    console.log('🔍 Starting server-side SoapBox creation validation...', {
      empireVaultAddress: body.empireVaultAddress,
      createdBy: body.createdBy,
      timestamp: new Date().toISOString()
    })
    
    let validationResult
    try {
      // FIXED: Correct parameter order for validation service
      validationResult = await consolidatedSoapboxValidation.validateSoapBoxCreation(
        body.empireVaultAddress,
        body.createdBy, // userAddress - the wallet creating the room
        '0', // minimumTokenBalance - default to 0 for now
        body.createdBy // setupperAddress same as creator for now
      )
      console.log('🔍 Server validation result:', {
        isValid: validationResult.isValid,
        isAuthorized: validationResult.isAuthorized,
        hasTokenBalance: validationResult.hasTokenBalance,
        tokenBalance: validationResult.tokenBalance,
        tokenSymbol: validationResult.tokenSymbol,
        tokenName: validationResult.tokenName,
        tokenVerified: validationResult.tokenVerified,
        tokenMetadataSource: validationResult.tokenMetadataSource,
        error: validationResult.error
      })
    } catch (validationError) {
      console.error('❌ Server validation threw error:', validationError)
      return NextResponse.json(
        {
          success: false,
          error: 'Validation Error',
          message: 'Server validation failed - please check RPC connection and try again',
          details: validationError instanceof Error ? validationError.message : 'Unknown validation error'
        },
        { status: 500 }
      )
    }

    // ENHANCED: More detailed validation failure handling
    if (!validationResult.isValid) {
      let errorMessage = 'SoapBox creation validation failed'
      let statusCode = 403
      const debugInfo = {
        empireVaultAddress: body.empireVaultAddress,
        walletAddress: body.createdBy,
        isAuthorized: validationResult.isAuthorized,
        hasTokenBalance: validationResult.hasTokenBalance,
        tokenBalance: validationResult.tokenBalance,
        tokenSymbol: validationResult.tokenSymbol,
        tokenName: validationResult.tokenName,
        tokenVerified: validationResult.tokenVerified,
        authorizedCount: validationResult.authorizedAddresses?.length || 0,
        isSetupperAuthorized: validationResult.isSetupperAuthorized
      }

      if (!validationResult.isAuthorized) {
        errorMessage = `Authorization failed: Wallet ${body.createdBy} is not in the authorized addresses list for Empire vault ${body.empireVaultAddress}. Only authorized addresses can create SoapBoxes.`
        statusCode = 403
      } else if (!validationResult.hasTokenBalance) {
        errorMessage = `Token balance check failed: You need to hold ${validationResult.tokenSymbol} tokens to create a SoapBox for this vault.`
        statusCode = 403
      } else if (validationResult.error) {
        errorMessage = `Validation error: ${validationResult.error}`
        statusCode = 400
      }

      console.error('❌ Server-side SoapBox creation blocked:', {
        reason: errorMessage,
        debugInfo
      })
      
      return NextResponse.json(
        {
          success: false,
          error: 'Authorization Failed',
          message: errorMessage,
          validationDetails: {
            ...debugInfo,
            authorizedAddresses: validationResult.authorizedAddresses?.slice(0, 5) || [] // Limit for response size
          }
        },
        { status: statusCode }
      )
    }

    console.log('✅ Server-side validation passed - proceeding with SoapBox creation')

    // Use resilient RPC client to avoid rate limiting - no need to set client here
    // The validation service already uses the resilient client
    
    // Get comprehensive token info from validation result
    const baseTokenAddress = validationResult.details.baseTokenAddress
    const vaultTokenInfo = {
      address: baseTokenAddress,
      symbol: validationResult.tokenSymbol,
      name: validationResult.tokenName || validationResult.tokenSymbol,
      logoURI: validationResult.tokenLogoURI
    }

    const vaultData = {
      tokenAddress: vaultTokenInfo.address, // Real baseToken address from vault
      tokenInfo: {
        symbol: vaultTokenInfo.symbol,
        name: vaultTokenInfo.name,
        logoURI: vaultTokenInfo.logoURI
      },
      vaultType: 'clanker' as const,
      isSupported: true
    }
    
    console.log('🐛 DEBUG #3: Checking room limits and implementing multi-chat support (1→2 per vault)')
    
    // NEW: Enhanced room limit check - Allow 2 rooms per vault (standard + premium)
    await clearRoomsCache()
    
    const existingRooms = await roomDatabaseService.getRoomsByVaultAddress(body.empireVaultAddress)
    const activeRooms = existingRooms.filter(room => room.isActive)
    const requestedRoomType = body.roomType || 'standard'
    
    console.log('🔍 Room limit analysis:', {
      vaultAddress: body.empireVaultAddress,
      requestedRoomType,
      totalActiveRooms: activeRooms.length,
      existingRoomTypes: activeRooms.map(r => ({ id: r.id, type: (r as any).roomType || 'standard', name: r.name }))
    })
    
    // Check if room type already exists for this vault
    const existingRoomOfType = activeRooms.find(room => ((room as any).roomType || 'standard') === requestedRoomType)
    if (existingRoomOfType) {
      console.log(`❌ SoapBox creation blocked - ${requestedRoomType} room exists:`, {
        existingRoomId: existingRoomOfType.id,
        existingRoomName: existingRoomOfType.name,
        roomType: requestedRoomType,
        vaultAddress: body.empireVaultAddress,
        createdBy: existingRoomOfType.createdBy
      })
      
      return NextResponse.json(
        {
          success: false,
          error: 'SoapBox type already exists',
          message: `An active ${requestedRoomType} SoapBox for this Empire vault already exists. Try creating a different room type instead.`,
          existingRoom: {
            id: existingRoomOfType.id,
            name: existingRoomOfType.name,
            roomType: requestedRoomType,
            createdBy: existingRoomOfType.createdBy
          },
          availableTypes: ['standard', 'premium', 'leaderboard'].filter(type => 
            type !== requestedRoomType && !activeRooms.some(room => ((room as any).roomType || 'standard') === type)
          )
        },
        { status: 409 }
      )
    }
    
    // Allow up to 3 rooms per vault (one of each type: standard, premium, leaderboard)
    if (activeRooms.length >= 3) {
      console.log(`❌ SoapBox creation blocked - vault room limit reached (3/3):`, {
        vaultAddress: body.empireVaultAddress,
        activeRoomsCount: activeRooms.length,
        existingRooms: activeRooms.map(r => ({ type: (r as any).roomType || 'standard', name: r.name }))
      })
      
      return NextResponse.json(
        {
          success: false,
          error: 'Vault room limit reached',
          message: 'This Empire vault already has the maximum of 3 active SoapBoxes (1 standard + 1 premium + 1 leaderboard)',
          activeRooms: activeRooms.map(room => ({
            id: room.id,
            name: room.name,
            roomType: (room as any).roomType || 'standard',
            createdBy: room.createdBy
          }))
        },
        { status: 409 }
      )
    }
    
    console.log('✅ No existing active room found for vault, proceeding with creation')
    
    // 🏭 CREATE 4-WAY SPLITS CONTRACT FOR REVENUE SHARING using correct SoapboxSplitsFactory interface
    let splitContractAddress: string | undefined;
    let splitId: string | undefined;
    let isSetupperAuthorized = false;
    const groupId = `empire_room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const { soapboxSplitsFactory, getVaultBaseToken } = await import('@/lib/contracts/soapboxSplitsFactory');
      
      // Get base token from Empire Vault (required for createSplit)
      const baseToken = await getVaultBaseToken(body.empireVaultAddress as `0x${string}`);
      
      // Use authorization result from validation
      isSetupperAuthorized = validationResult.isSetupperAuthorized;
      
      console.log('🔍 4-way split preparation:', {
        empireVaultAddress: body.empireVaultAddress,
        baseToken,
        groupId,
        setupperAddress: body.createdBy,
        isAuthorized: isSetupperAuthorized
      });
      
      // ENHANCED: Prepare splits info - actual contract creation happens client-side when first needed
      if (isSetupperAuthorized && validationResult.isValid) {
        console.log('✅ SoapboxSplitsFactory 4-way split ready for creation:', {
          empireVaultAddress: body.empireVaultAddress,
          baseToken,
          groupId,
          setupperAddress: body.createdBy,
          splitPercentages: { empireVault: 40, roomCreator: 20, devWallet: 20, myuVault: 20 }
        });
        
        // Store the parameters needed for client-side splits creation
        // Actual contract deployment will happen when first payment is processed
      } else {
        console.warn('⚠️ Setupper not authorized on Empire Vault - 4-way split will be disabled for this SoapBox');
        // Don't block creation, just disable splits
      }
    } catch (splitError) {
      console.error('❌ SoapboxSplitsFactory 4-way split preparation failed:', splitError);
      
      // ENHANCED: Don't block room creation for splits issues - log and continue
      console.warn('⚠️ Continuing room creation without splits due to preparation error');
      splitContractAddress = undefined;
      splitId = undefined;
      isSetupperAuthorized = false;
      
      // Continue with splits disabled rather than blocking creation
    }

    console.log('🐛 DEBUG #4: Creating room with token-gating and leaderboard features')
    
    // NEW: Enhanced room creation with token-gating support
    const enhancedSettings = {
      ...body.settings,
      tokenGating: body.settings.tokenGating || {
        enabled: false,
        minimumTokenBalance: '0',
        topHoldersOnly: false,
        maxHolderRank: 250,
        leaderboardOnly: false
      }
    }
    
    console.log('🔐 Token-gating configuration:', {
      enabled: enhancedSettings.tokenGating.enabled,
      minimumBalance: enhancedSettings.tokenGating.minimumTokenBalance,
      rankLimit: enhancedSettings.tokenGating.maxHolderRank,
      topHoldersOnly: enhancedSettings.tokenGating.topHoldersOnly,
      leaderboardOnly: enhancedSettings.tokenGating.leaderboardOnly
    })
    
    // Create room in database with enhanced fields
    const newRoom = await roomDatabaseService.createRoom({
      name: body.name.trim(),
      description: body.description.trim(),
      empireVaultAddress: body.empireVaultAddress,
      tokenAddress: vaultData.tokenAddress,
      tokenInfo: vaultData.tokenInfo,
      createdBy: body.createdBy,
      moderators: [body.createdBy],
      settings: enhancedSettings,
      splitContractAddress,
      splitId, // Will be set when actual splits contract is deployed
      groupId, // Use groupId as per database schema
      setupperAddress: body.createdBy,
      isSetupperAuthorized,
      roomType: requestedRoomType // NEW: Track room type
    })
    
    // Convert to enhanced API format with new features
    const newSoapBox: EmpireRoom = {
      id: newRoom.id,
      name: newRoom.name,
      description: newRoom.description || '',
      empireVaultAddress: newRoom.empireVaultAddress,
      tokenAddress: newRoom.tokenAddress,
      tokenInfo: typeof newRoom.tokenInfo === 'object' ? newRoom.tokenInfo as any : vaultData.tokenInfo,
      vaultType: vaultData.vaultType,
      createdBy: newRoom.createdBy,
      createdAt: newRoom.createdAt.toISOString(),
      memberCount: newRoom.memberCount,
      isActive: newRoom.isActive,
      settings: typeof newRoom.settings === 'object' ? newRoom.settings : enhancedSettings,
      splitContractAddress,
      groupId: newRoom.groupId || undefined,
      setupperAddress: newRoom.setupperAddress || undefined,
      isSetupperAuthorized: newRoom.isSetupperAuthorized,
      splitPercentages: newRoom.isSetupperAuthorized ? {
        empireVault: 40,
        setupper: 20,
        devWallet: 20,
        myuVault: 20
      } : undefined,
      // NEW: Enhanced room features
      roomType: requestedRoomType,
      tokenGating: enhancedSettings.tokenGating
    }
    
    // Clear cache
    await clearRoomsCache()
    
    // Track SoapBox creation in analytics
    try {
      await realAnalyticsService.trackRoomActivity({
        roomId: newSoapBox.id,
        userAddress: body.createdBy,
        activityType: 'create',
        metadata: {
          empireVaultAddress: newSoapBox.empireVaultAddress,
          vaultType: newSoapBox.vaultType,
          tokenSymbol: newSoapBox.tokenInfo.symbol,
          tokenName: newSoapBox.tokenInfo.name,
          tokenVerified: validationResult.tokenVerified,
          userTokenBalance: validationResult.tokenBalance,
          isSetupperAuthorized: validationResult.isSetupperAuthorized
        }
      })
    } catch (analyticsError) {
      console.warn('Failed to track SoapBox creation:', analyticsError)
      // Don't fail the request if analytics fails
    }
    
    console.log('🎉 SoapBox created successfully in database:', {
      id: newSoapBox.id,
      name: newSoapBox.name,
      createdBy: body.createdBy,
      tokenSymbol: validationResult.tokenSymbol,
      tokenName: validationResult.tokenName,
      tokenVerified: validationResult.tokenVerified,
      tokenMetadataSource: validationResult.tokenMetadataSource,
      isSetupperAuthorized: validationResult.isSetupperAuthorized,
      roomId: newRoom.id
    })
    
    return NextResponse.json({
      success: true,
      data: newSoapBox,
      message: 'SoapBox created successfully with proper authorization and token validation'
    }, { status: 201 })
    
  } catch (error) {
    console.error('POST /api/empire-rooms error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create SoapBox',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// PUT /api/empire-rooms - Update a room
export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    await initRedis()
    
    const body = await request.json()
    const { id, updatedBy, ...updateData } = body
    
    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid room ID',
          message: 'Room ID is required'
        },
        { status: 400 }
      )
    }
    
    if (!updatedBy || typeof updatedBy !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
          message: 'User address is required'
        },
        { status: 401 }
      )
    }
    
    // Get room from database
    const existingRoom = await roomDatabaseService.getRoomById(id)
    
    if (!existingRoom) {
      return NextResponse.json(
        {
          success: false,
          error: 'Room not found',
          message: 'Room with specified ID does not exist'
        },
        { status: 404 }
      )
    }
    
    // Check if user has permission to update
    if (existingRoom.createdBy !== updatedBy) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
          message: 'You can only update rooms you created'
        },
        { status: 403 }
      )
    }
    
    // Update room in database
    const updatedRoom = await roomDatabaseService.updateRoom(id, {
      name: updateData.name,
      description: updateData.description,
      isActive: updateData.isActive,
      settings: updateData.settings,
      moderators: updateData.moderators
    })
    
    if (!updatedRoom) {
      return NextResponse.json(
        {
          success: false,
          error: 'Update failed',
          message: 'Failed to update room in database'
        },
        { status: 500 }
      )
    }
    
    // Clear cache
    await clearRoomsCache()
    
    // Convert to API format
    const settings = typeof updatedRoom.settings === 'object' ? updatedRoom.settings : {}
    const apiRoom: EmpireRoom = {
      id: updatedRoom.id,
      name: updatedRoom.name,
      description: updatedRoom.description || '',
      empireVaultAddress: updatedRoom.empireVaultAddress,
      tokenAddress: updatedRoom.tokenAddress,
      tokenInfo: await (async () => {
        const resolvedTokenInfo = await tokenInfoResolver.resolveTokenInfoFromRoom({
          tokenInfo: updatedRoom.tokenInfo,
          empireVaultAddress: updatedRoom.empireVaultAddress,
          tokenAddress: updatedRoom.tokenAddress
        })
        return {
          symbol: resolvedTokenInfo.symbol,
          name: resolvedTokenInfo.name,
          logoURI: resolvedTokenInfo.logoURI
        }
      })(),
      vaultType: 'clanker' as const,
      createdBy: updatedRoom.createdBy,
      createdAt: updatedRoom.createdAt.toISOString(),
      memberCount: updatedRoom.memberCount,
      isActive: updatedRoom.isActive,
      settings: settings,
      splitContractAddress: updatedRoom.splitContractAddress || undefined,
      groupId: updatedRoom.groupId || undefined,
      setupperAddress: updatedRoom.setupperAddress || undefined,
      isSetupperAuthorized: updatedRoom.isSetupperAuthorized,
      splitPercentages: updatedRoom.isSetupperAuthorized ? {
        empireVault: 40,
        setupper: 20,
        devWallet: 20,
        myuVault: 20
      } : undefined,
      // Required fields for enhanced API
      roomType: ((updatedRoom as any).roomType as 'standard' | 'premium' | 'leaderboard') || 'standard',
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
      data: apiRoom,
      message: 'Empire room updated successfully'
    })
    
  } catch (error) {
    console.error('PUT /api/empire-rooms error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update Empire room',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// DELETE /api/empire-rooms - Delete a room
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    await initRedis()
    
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const deletedBy = searchParams.get('deletedBy')
    
    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid room ID',
          message: 'Room ID is required'
        },
        { status: 400 }
      )
    }
    
    if (!deletedBy) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
          message: 'User address is required'
        },
        { status: 401 }
      )
    }
    
    // Get room from database
    const roomToDelete = await roomDatabaseService.getRoomById(id)
    
    if (!roomToDelete) {
      return NextResponse.json(
        {
          success: false,
          error: 'Room not found',
          message: 'Room with specified ID does not exist'
        },
        { status: 404 }
      )
    }
    
    // Check if user has permission to delete
    if (roomToDelete.createdBy !== deletedBy) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
          message: 'You can only delete rooms you created'
        },
        { status: 403 }
      )
    }
    
    // Delete room from database (soft delete)
    const deleted = await roomDatabaseService.deleteRoom(id)
    if (!deleted) {
      return NextResponse.json(
        {
          success: false,
          error: 'Delete failed',
          message: 'Failed to delete room from database'
        },
        { status: 500 }
      )
    }
    
    // Clear cache
    await clearRoomsCache()
    
    // Convert to API format
    const settings = typeof roomToDelete.settings === 'object' ? roomToDelete.settings : {}
    const apiRoom: EmpireRoom = {
      id: roomToDelete.id,
      name: roomToDelete.name,
      description: roomToDelete.description || '',
      empireVaultAddress: roomToDelete.empireVaultAddress,
      tokenAddress: roomToDelete.tokenAddress,
      tokenInfo: await (async () => {
        const resolvedTokenInfo = await tokenInfoResolver.resolveTokenInfoFromRoom({
          tokenInfo: roomToDelete.tokenInfo,
          empireVaultAddress: roomToDelete.empireVaultAddress,
          tokenAddress: roomToDelete.tokenAddress
        })
        return {
          symbol: resolvedTokenInfo.symbol,
          name: resolvedTokenInfo.name,
          logoURI: resolvedTokenInfo.logoURI
        }
      })(),
      vaultType: 'clanker' as const,
      createdBy: roomToDelete.createdBy,
      createdAt: roomToDelete.createdAt.toISOString(),
      memberCount: roomToDelete.memberCount,
      isActive: roomToDelete.isActive,
      settings: settings,
      splitContractAddress: roomToDelete.splitContractAddress || undefined,
      groupId: roomToDelete.groupId || undefined,
      setupperAddress: roomToDelete.setupperAddress || undefined,
      isSetupperAuthorized: roomToDelete.isSetupperAuthorized,
      splitPercentages: roomToDelete.isSetupperAuthorized ? {
        empireVault: 40,
        setupper: 20,
        devWallet: 20,
        myuVault: 20
      } : undefined,
      // NEW: Required fields that were missing from DELETE endpoint
      roomType: ((roomToDelete as any).roomType as 'standard' | 'premium' | 'leaderboard') || 'standard',
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
      data: apiRoom,
      message: 'Empire room deleted successfully'
    })
    
  } catch (error) {
    console.error('DELETE /api/empire-rooms error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete Empire room',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}