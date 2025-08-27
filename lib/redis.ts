//--src/lib/redis.ts
// Redis configuration for high-scale messaging (500K-5M concurrent users)
// Server-side only - do not import in client components
import Redis from 'ioredis'

interface RedisConfig {
  host: string
  port: number
  password?: string
  retryDelayOnFailover: number
  enableReadyCheck: boolean
  maxRetriesPerRequest: number
  lazyConnect: boolean
  maxMemoryPolicy: string
  keyPrefix: string
}

interface CachedMessage {
  id: string
  roomId: string
  content: string
  sender: string
  timestamp: number
  encrypted: boolean
}

interface RoomSession {
  roomId: string
  userId: string
  connectedAt: number
  lastActivity: number
  connectionId: string
}

// High-performance Redis configuration for massive scale
const redisConfig: RedisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  maxMemoryPolicy: 'allkeys-lru', // Evict least recently used keys when memory limit reached
  keyPrefix: 'soapbox:' // Namespace all keys
}

// Singleton Redis client for performance
let redisClient: Redis | null = null
let pubClient: Redis | null = null
let subClient: Redis | null = null

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(redisConfig)
    
    redisClient.on('connect', () => {
      console.log('✅ Redis client connected')
    })
    
    redisClient.on('error', (error) => {
      console.error('❌ Redis client error:', error)
    })
  }
  
  return redisClient
}

export function getPubSubClients(): { pub: Redis; sub: Redis } {
  if (!pubClient || !subClient) {
    pubClient = new Redis(redisConfig)
    subClient = new Redis(redisConfig)
    
    pubClient.on('connect', () => {
      console.log('✅ Redis pub client connected')
    })
    
    subClient.on('connect', () => {
      console.log('✅ Redis sub client connected')
    })
  }
  
  return { pub: pubClient, sub: subClient }
}

// Message caching for high throughput
export class MessageCache {
  private redis: Redis
  private readonly MESSAGE_TTL = 24 * 60 * 60 // 24 hours
  private readonly ROOM_SESSION_TTL = 60 * 60 // 1 hour
  
  constructor() {
    this.redis = getRedisClient()
  }

  // Cache message with automatic expiration
  async cacheMessage(message: CachedMessage): Promise<void> {
    const key = `message:${message.roomId}:${message.id}`
    
    try {
      await this.redis.setex(
        key,
        this.MESSAGE_TTL,
        JSON.stringify({
          ...message,
          cachedAt: Date.now()
        })
      )
      
      // Add to room message list (for pagination)
      await this.redis.zadd(
        `room_messages:${message.roomId}`,
        message.timestamp,
        message.id
      )
      
      // Trim room message list to last 1000 messages
      await this.redis.zremrangebyrank(
        `room_messages:${message.roomId}`,
        0,
        -1001
      )
      
    } catch (error) {
      console.error('Failed to cache message:', error)
    }
  }

  // Get recent messages for a room
  async getRoomMessages(roomId: string, limit: number = 50, offset: number = 0): Promise<CachedMessage[]> {
    try {
      // Get message IDs in reverse chronological order
      const messageIds = await this.redis.zrevrange(
        `room_messages:${roomId}`,
        offset,
        offset + limit - 1
      )
      
      if (messageIds.length === 0) return []
      
      // Get message data in parallel
      const pipeline = this.redis.pipeline()
      messageIds.forEach(id => {
        pipeline.get(`message:${roomId}:${id}`)
      })
      
      const results = await pipeline.exec()
      
      return results
        ?.filter(([error, result]) => !error && result)
        .map(([, result]) => JSON.parse(result as string))
        .filter(Boolean) || []
        
    } catch (error) {
      console.error('Failed to get room messages:', error)
      return []
    }
  }

  // Track active room sessions for scaling insights
  async trackRoomSession(session: RoomSession): Promise<void> {
    try {
      const key = `session:${session.roomId}:${session.userId}`
      
      await this.redis.setex(
        key,
        this.ROOM_SESSION_TTL,
        JSON.stringify({
          ...session,
          updatedAt: Date.now()
        })
      )
      
      // Add to active users set
      await this.redis.sadd(`active_users:${session.roomId}`, session.userId)
      await this.redis.expire(`active_users:${session.roomId}`, this.ROOM_SESSION_TTL)
      
    } catch (error) {
      console.error('Failed to track room session:', error)
    }
  }

  // Get active user count for a room
  async getActiveUserCount(roomId: string): Promise<number> {
    try {
      return await this.redis.scard(`active_users:${roomId}`)
    } catch (error) {
      console.error('Failed to get active user count:', error)
      return 0
    }
  }

  // Clean up expired sessions
  async removeRoomSession(roomId: string, userId: string): Promise<void> {
    try {
      await this.redis.del(`session:${roomId}:${userId}`)
      await this.redis.srem(`active_users:${roomId}`, userId)
    } catch (error) {
      console.error('Failed to remove room session:', error)
    }
  }

  // Get room statistics for monitoring
  async getRoomStats(roomId: string): Promise<{
    activeUsers: number
    messageCount: number
    lastActivity: number
  }> {
    try {
      const [activeUsers, messageCount, lastMessageTime] = await Promise.all([
        this.redis.scard(`active_users:${roomId}`),
        this.redis.zcard(`room_messages:${roomId}`),
        this.redis.zrevrange(`room_messages:${roomId}`, 0, 0, 'WITHSCORES')
      ])
      
      return {
        activeUsers,
        messageCount,
        lastActivity: lastMessageTime[1] ? parseInt(lastMessageTime[1]) : 0
      }
    } catch (error) {
      console.error('Failed to get room stats:', error)
      return { activeUsers: 0, messageCount: 0, lastActivity: 0 }
    }
  }
}

// Pub/Sub for real-time messaging at scale
export class RealTimeMessaging {
  private pub: Redis
  private sub: Redis
  private subscriptions: Map<string, Set<(message: any) => void>> = new Map()
  
  constructor() {
    const { pub, sub } = getPubSubClients()
    this.pub = pub
    this.sub = sub
    
    // Handle incoming messages
    this.sub.on('message', (channel, message) => {
      const callbacks = this.subscriptions.get(channel)
      if (callbacks) {
        try {
          const parsedMessage = JSON.parse(message)
          callbacks.forEach(callback => {
            try {
              callback(parsedMessage)
            } catch (error) {
              console.error('Callback error:', error)
            }
          })
        } catch (error) {
          console.error('Failed to parse message:', error)
        }
      }
    })
  }

  // Subscribe to room messages
  async subscribeToRoom(roomId: string, callback: (message: any) => void): Promise<void> {
    const channel = `room:${roomId}`
    
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set())
      await this.sub.subscribe(channel)
    }
    
    this.subscriptions.get(channel)?.add(callback)
  }

  // Unsubscribe from room messages
  async unsubscribeFromRoom(roomId: string, callback: (message: any) => void): Promise<void> {
    const channel = `room:${roomId}`
    const callbacks = this.subscriptions.get(channel)
    
    if (callbacks) {
      callbacks.delete(callback)
      
      if (callbacks.size === 0) {
        this.subscriptions.delete(channel)
        await this.sub.unsubscribe(channel)
      }
    }
  }

  // Publish message to room
  async publishToRoom(roomId: string, message: any): Promise<void> {
    try {
      await this.pub.publish(`room:${roomId}`, JSON.stringify({
        ...message,
        publishedAt: Date.now()
      }))
    } catch (error) {
      console.error('Failed to publish message:', error)
    }
  }

  // Disconnect clients
  async disconnect(): Promise<void> {
    await Promise.all([
      this.pub.disconnect(),
      this.sub.disconnect()
    ])
  }
}

// Export singleton instances
export const messageCache = new MessageCache()
export const realTimeMessaging = new RealTimeMessaging()

export default {
  getRedisClient,
  getPubSubClients,
  messageCache,
  realTimeMessaging
}