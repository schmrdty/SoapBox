//--src/app/api/api/auth/me/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const authorization = request.headers.get('Authorization')
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 })
    }

    const token = authorization.split(' ')[1]
    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 401 })
    }

    // Dynamic import to prevent client bundling
    const { createClient, Errors } = await import('@farcaster/quick-auth')
    const client = createClient()
    
    // Verify JWT token with Farcaster
    const payload = await client.verifyJwt({
      token,
      domain: process.env.NEXT_PUBLIC_HOST || "localhost"
    })

    // Get user data from Farcaster API
    const userResponse = await fetch(
      `https://api.farcaster.xyz/v2/user?fid=${payload.sub}`,
      {
        headers: {
          'api-key': process.env.FARCASTER_API_KEY || 'NEYNAR_FROG_FM'
        }
      }
    )

    if (!userResponse.ok) {
      // Return basic user info if API call fails
      return NextResponse.json({
        fid: payload.sub,
        username: `user-${payload.sub}`,
        displayName: `User ${payload.sub}`
      })
    }

    const userData = await userResponse.json()
    const user = userData.result?.user || userData.user

    return NextResponse.json({
      fid: user.fid || payload.sub,
      username: user.username,
      displayName: user.display_name || user.displayName,
      pfpUrl: user.pfp_url || user.pfpUrl,
      bio: user.profile?.bio?.text || user.bio,
      location: user.profile?.location ? {
        placeId: user.profile.location.place_id,
        description: user.profile.location.description
      } : undefined
    })
  } catch (error) {
    console.error('Authentication error:', error)
    
    // Dynamic import for error checking
    const { Errors } = await import('@farcaster/quick-auth')
    if (error instanceof Errors.InvalidTokenError) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}