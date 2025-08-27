//--posthog.js
export interface PostHogEvent {
  event: string;
  distinctId: string;
  properties?: Record<string, any>;
  timestamp?: Date;
}

interface PostHogConfig {
  apiKey: string;
  host?: string;
  debug?: boolean;
  capturePageview?: boolean;
  capturePageleave?: boolean;
}

// Mock PostHog Service - All methods are no-ops
class MockPostHogService {
  private client: any | null = null;
  private isInitialized: boolean = false;
  private eventQueue: PostHogEvent[] = [];

  constructor() {
    console.log('📊 Analytics completely disabled - MockPostHogService initialized');
    // No initialization, no processing, no external calls
  }

  // All methods below are no-ops that return immediately
  private initializeClient(): void {
    // No-op: Prevents any external API initialization
  }

  private flushEventQueue(): void {
    // No-op: Prevents queue processing
  }

  private queueEvent(event: PostHogEvent): void {
    // No-op: Prevents event queuing
  }

  public trackEvent(event: PostHogEvent): void {
    // No-op: Prevents any tracking
  }

  public identify(userId: string, properties?: Record<string, any>): void {
    // No-op: Prevents user identification
  }

  public setUserProperties(properties: Record<string, any>): void {
    // No-op: Prevents property setting
  }

  public getFeatureFlag(flagKey: string): boolean | string | undefined {
    // No-op: Always returns undefined
    return undefined;
  }

  public isFeatureEnabled(flagKey: string): boolean {
    // No-op: Always returns false
    return false;
  }

  // Room-related tracking methods - all no-ops
  public trackRoomCreated(event: {
    distinctId: string;
    roomId: string;
    roomName: string;
    empireVaultAddress: string;
    settings: any;
  }): void {
    // No-op: Room tracking disabled
  }

  public trackRoomJoined(event: {
    distinctId: string;
    roomId: string;
    roomName: string;
  }): void {
    // No-op: Room tracking disabled
  }

  public trackRoomLeft(event: {
    distinctId: string;
    roomId: string;
    sessionDuration: number;
  }): void {
    // No-op: Room tracking disabled
  }

  // Wallet-related tracking methods - all no-ops
  public trackWalletConnected(event: {
    distinctId: string;
    walletType: string;
    connectionMethod: string;
  }): void {
    // No-op: Wallet tracking disabled
  }

  public trackWalletDisconnected(event: {
    distinctId: string;
    sessionDuration: number;
  }): void {
    // No-op: Wallet tracking disabled
  }

  // Game-related tracking methods - all no-ops
  public trackGameLaunched(event: {
    distinctId: string;
    gameId: string;
    roomId: string;
    paymentAmount?: number;
  }): void {
    // No-op: Game tracking disabled
  }

  public trackGameCompleted(event: {
    distinctId: string;
    gameId: string;
    score: number;
    duration: number;
    roomId: string;
  }): void {
    // No-op: Game tracking disabled
  }

  // Tipping-related tracking methods - all no-ops
  public trackTipSent(event: {
    distinctId: string;
    recipientId: string;
    amount: number;
    currency: string;
    roomId: string;
    messageId?: string;
  }): void {
    // No-op: Tip tracking disabled
  }

  public trackTipReceived(event: {
    distinctId: string;
    senderId: string;
    amount: number;
    currency: string;
    roomId: string;
  }): void {
    // No-op: Tip tracking disabled
  }

  // Message-related tracking methods - all no-ops
  public trackMessageSent(event: {
    distinctId: string;
    roomId: string;
    messageLength: number;
    hasImage: boolean;
    hasLink: boolean;
    paymentAmount?: number;
  }): void {
    // No-op: Message tracking disabled
  }

  public trackMessageReaction(event: {
    distinctId: string;
    roomId: string;
    messageId: string;
    reactionType: string;
  }): void {
    // No-op: Message tracking disabled
  }

  // Feature usage tracking methods - all no-ops
  public trackFeatureUsed(event: {
    distinctId: string;
    featureName: string;
    context?: string;
    properties?: Record<string, any>;
  }): void {
    // No-op: Feature tracking disabled
  }

  public trackSubscriptionUpgrade(event: {
    distinctId: string;
    fromTier: string;
    toTier: string;
    amount: number;
  }): void {
    // No-op: Subscription tracking disabled
  }

  // Error tracking methods - all no-ops
  public trackError(event: {
    distinctId: string;
    errorType: string;
    errorMessage: string;
    context?: string;
    stack?: string;
  }): void {
    // No-op: Error tracking disabled
  }

  // Performance tracking methods - all no-ops
  public trackPerformance(event: {
    distinctId: string;
    metric: string;
    value: number;
    context?: string;
  }): void {
    // No-op: Performance tracking disabled
  }

  public reset(): void {
    // No-op: Reset disabled
  }
}

// Export singleton instance - now using MockPostHogService
export const posthogService = new MockPostHogService();

// Export convenience functions - all no-ops
export const trackEvent = (event: PostHogEvent) => {
  // No-op: Tracking completely disabled
};

export const identifyUser = (userId: string, properties?: Record<string, any>) => {
  // No-op: User identification disabled
};

export const setUserProperties = (properties: Record<string, any>) => {
  // No-op: Property setting disabled
};

export const getFeatureFlag = (flagKey: string) => {
  // No-op: Always returns undefined
  return undefined;
};

export const isFeatureEnabled = (flagKey: string) => {
  // No-op: Always returns false
  return false;
};

// Export tracking methods - all no-ops
export const trackRoomCreated = (event: Parameters<typeof posthogService.trackRoomCreated>[0]) => {
  // No-op: Room tracking disabled
};

export const trackRoomJoined = (event: Parameters<typeof posthogService.trackRoomJoined>[0]) => {
  // No-op: Room tracking disabled
};

export const trackWalletConnected = (event: Parameters<typeof posthogService.trackWalletConnected>[0]) => {
  // No-op: Wallet tracking disabled
};

export const trackGameLaunched = (event: Parameters<typeof posthogService.trackGameLaunched>[0]) => {
  // No-op: Game tracking disabled
};

export const trackTipSent = (event: Parameters<typeof posthogService.trackTipSent>[0]) => {
  // No-op: Tip tracking disabled
};

export const trackMessageSent = (event: Parameters<typeof posthogService.trackMessageSent>[0]) => {
  // No-op: Message tracking disabled
};

export const trackFeatureUsed = (event: Parameters<typeof posthogService.trackFeatureUsed>[0]) => {
  // No-op: Feature tracking disabled
};

export const trackError = (event: Parameters<typeof posthogService.trackError>[0]) => {
  // No-op: Error tracking disabled
};

export default posthogService;