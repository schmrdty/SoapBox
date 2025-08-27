//--src/lib/services/messageRateLimit.ts
/**
 * Message Rate Limiting Service
 * Prevents users from sending messages too frequently
 */

interface UserRateLimit {
  address: string;
  messageCount: number;
  windowStart: number;
  lastMessage: number;
}

interface RateLimitConfig {
  maxMessagesPerWindow: number;
  windowDurationMs: number;
  cooldownMs: number;
}

export class MessageRateLimiter {
  private static instance: MessageRateLimiter;
  private userLimits: Map<string, UserRateLimit> = new Map();
  private readonly config: RateLimitConfig;

  private constructor(config?: Partial<RateLimitConfig>) {
    this.config = {
      maxMessagesPerWindow: 10, // 10 messages per window
      windowDurationMs: 60000,  // 1 minute window
      cooldownMs: 2000,         // 2 second cooldown between messages
      ...config
    };

    // Clean up old entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  public static getInstance(config?: Partial<RateLimitConfig>): MessageRateLimiter {
    if (!MessageRateLimiter.instance) {
      MessageRateLimiter.instance = new MessageRateLimiter(config);
    }
    return MessageRateLimiter.instance;
  }

  /**
   * Check if user can send a message
   */
  public canSendMessage(userAddress: string, roomId: string): {
    allowed: boolean;
    reason?: string;
    retryAfter?: number;
  } {
    const key = `${userAddress}:${roomId}`;
    const now = Date.now();
    const userLimit = this.userLimits.get(key);

    if (!userLimit) {
      // First message from this user in this room
      this.userLimits.set(key, {
        address: userAddress,
        messageCount: 1,
        windowStart: now,
        lastMessage: now
      });
      return { allowed: true };
    }

    // Check cooldown
    const timeSinceLastMessage = now - userLimit.lastMessage;
    if (timeSinceLastMessage < this.config.cooldownMs) {
      return {
        allowed: false,
        reason: 'Cooldown period active',
        retryAfter: this.config.cooldownMs - timeSinceLastMessage
      };
    }

    // Check if we need to reset the window
    const windowAge = now - userLimit.windowStart;
    if (windowAge >= this.config.windowDurationMs) {
      // Reset window
      userLimit.messageCount = 1;
      userLimit.windowStart = now;
      userLimit.lastMessage = now;
      return { allowed: true };
    }

    // Check if user has exceeded message limit in current window
    if (userLimit.messageCount >= this.config.maxMessagesPerWindow) {
      const timeUntilReset = this.config.windowDurationMs - windowAge;
      return {
        allowed: false,
        reason: 'Message limit exceeded',
        retryAfter: timeUntilReset
      };
    }

    // Allow message and update limits
    userLimit.messageCount++;
    userLimit.lastMessage = now;
    return { allowed: true };
  }

  /**
   * Get user's current rate limit status
   */
  public getUserStatus(userAddress: string, roomId: string): {
    messagesRemaining: number;
    windowResetTime: number;
    cooldownRemaining: number;
  } {
    const key = `${userAddress}:${roomId}`;
    const now = Date.now();
    const userLimit = this.userLimits.get(key);

    if (!userLimit) {
      return {
        messagesRemaining: this.config.maxMessagesPerWindow,
        windowResetTime: 0,
        cooldownRemaining: 0
      };
    }

    const windowAge = now - userLimit.windowStart;
    const cooldownRemaining = Math.max(0, this.config.cooldownMs - (now - userLimit.lastMessage));
    
    if (windowAge >= this.config.windowDurationMs) {
      return {
        messagesRemaining: this.config.maxMessagesPerWindow,
        windowResetTime: 0,
        cooldownRemaining
      };
    }

    return {
      messagesRemaining: Math.max(0, this.config.maxMessagesPerWindow - userLimit.messageCount),
      windowResetTime: userLimit.windowStart + this.config.windowDurationMs,
      cooldownRemaining
    };
  }

  /**
   * Reset rate limit for specific user (admin function)
   */
  public resetUserLimit(userAddress: string, roomId: string): void {
    const key = `${userAddress}:${roomId}`;
    this.userLimits.delete(key);
  }

  /**
   * Clean up old entries
   */
  private cleanup(): void {
    const now = Date.now();
    const cutoff = now - (this.config.windowDurationMs * 2); // Keep 2 windows worth

    for (const [key, limit] of this.userLimits.entries()) {
      if (limit.windowStart < cutoff) {
        this.userLimits.delete(key);
      }
    }
  }
}

// Export singleton instance
export const messageRateLimiter = MessageRateLimiter.getInstance();