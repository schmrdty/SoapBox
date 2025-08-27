//--src/app/types/wallet.ts
export interface WalletConnectionState {
  isConnected: boolean;
  address: string | null;
  balance: string | null;
  chainId: number | null;
  isConnecting: boolean;
  error: string | null;
}

export interface WalletProvider {
  id: string;
  name: string;
  icon: string;
  description: string;
  isAvailable: boolean;
}

export interface WalletConnectionProps {
  walletState: WalletConnectionState;
  onConnected?: () => void;
  onError?: (error: string) => void;
  onDisconnect?: () => void;
}

export interface WalletConnectionHookReturn {
  connectionState: WalletConnectionState;
  connect: (providerId: string) => Promise<void>;
  disconnect: () => Promise<void>;
  isSupported: (providerId: string) => boolean;
  availableProviders: WalletProvider[];
}

export type WalletConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface WalletError {
  code: string;
  message: string;
  details?: string;
}

export interface WalletBalance {
  value: string;
  formatted: string;
  symbol: string;
  decimals: number;
}

export interface WalletChain {
  id: number;
  name: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: string[];
  blockExplorers?: {
    name: string;
    url: string;
  }[];
}