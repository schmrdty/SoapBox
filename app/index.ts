//src/app/types/index.ts
// Central type exports for SoapBox application
export type * from './api';
export type * from './chat';
export type * from './premium';
export type * from './wallet';
export type * from './cat';

// Re-export commonly used types for convenience
export type {
  ChatRoom,
  ChatMessage,
  UserProfile,
  RoomSettings,
  EmpireVault
} from './chat';

export type {
  SubscriptionTier,
  PremiumFeatures,
  UserSubscription
} from './premium';

export type {
  WalletConnectionState,
  WalletProvider,
  WalletError
} from './wallet';

export type {
  APIError
} from './api';