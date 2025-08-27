//--chat.ts
// Chat and Room Types
export interface ChatRoom {
  id: string;
  name: string;
  description: string;
  empireVaultAddress: string;
  requiredToken: string;
  owner: string;
  moderators: string[];
  isActive: boolean;
  messageCount: number;
  memberCount: number;
  settings: RoomSettings;
  createdAt: Date;
  splitContractAddress?: string; // 0xSplits contract for revenue sharing
  baseToken?: {
    address: string;
    symbol: string;
    decimals: number;
  };
}

export interface RoomSettings {
  sfwLevel: 'strict' | 'moderate' | 'relaxed';
  maxMessageLength: number;
  cooldownSeconds: number;
  allowImages: boolean;
  allowLinks: boolean;
  allowGames: boolean;
  
  // All users can message for free - no per-message charges
  
  // Feature costs (apply to all users when enabled)
  tagAllCost: number; // in USDC cents
  imageCost: number; // in USDC cents
  linkCost: number; // in USDC cents
  gameCost: number; // in USDC cents
  
  // Direct message settings
  directMessagesEnabled: boolean; // Controlled by moderator
  directMessageSetupCost: number; // One-time fee per wallet (default $5 = 500 cents)
  directMessagePaidUsers: string[]; // Users who have paid the DM setup fee
}

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderAddress: string;
  content: string;
  type: 'text' | 'image' | 'system' | 'tip' | 'game_invite' | 'dm';
  timestamp: Date;
  isDeleted: boolean;
  deletedBy?: string;
  replyTo?: string;
  attachments?: MessageAttachment[];
}

export interface MessageAttachment {
  type: 'image' | 'link' | 'game';
  url: string;
  metadata?: Record<string, unknown>;
}

export interface UserProfile {
  address: string;
  displayName?: string;
  avatar?: string;
  reputation: number;
  warningCount: number;
  mutedUntil?: Date;
  isBanned: boolean;
  joinedAt: Date;
  lastActive: Date;
}

export interface TipTransaction {
  id: string;
  fromAddress: string;
  toAddress: string;
  amount: string;
  token: string;
  messageId?: string;
  roomId: string;
  status: 'pending' | 'completed' | 'failed';
  txHash?: string;
  timestamp: Date;
}

export interface EmpireVault {
  address: string;
  tokenAddress: string;
  authorizedUsers: string[];
  clankerProxy: string;
  glankerProxy: string;
  clankerSupported: boolean;
  glankerSupported: boolean;
  moderationDefaults: RoomSettings;
}

// Direct Message Types
export interface DirectMessage {
  id: string;
  fromAddress: string;
  toAddress: string;
  content: string;
  timestamp: Date;
  isRead: boolean;
  roomId?: string; // Optional room context
}

export interface DirectMessageSetup {
  userAddress: string;
  roomId: string;
  setupFeePaid: boolean;
  paidAt: Date;
  txHash: string;
}