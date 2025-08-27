//--src/hooks/useWalletConnect.ts
'use client';

import { useState, useEffect } from 'react';
// Dynamic XMTP types to prevent Node.js dependencies from leaking
type Signer = any; // Will be typed properly when dynamically imported
import { useXMTPClient } from '@/providers/XMTPProvider';
import { createWalletClient, custom, http } from 'viem';
import { base } from 'viem/chains';
import { toBytes } from 'viem';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { injected } from 'wagmi/connectors';

interface WalletConnectOptions {
  onConnect?: () => void;
  onError?: (error: string) => void;
  autoConnect?: boolean;
}

export function useWalletConnect(options: WalletConnectOptions = {}) {
  const { initClient } = useXMTPClient();
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();

  const [env, setEnv] = useState<'dev' | 'production' | 'local'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('xmtpEnv') as 'dev' | 'production' | 'local') || 'dev';
    }
    return 'dev';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('xmtpEnv', env);
    }
  }, [env]);

  // Create a viem wallet client. Using `custom` to wrap window.ethereum.
  const walletClient = typeof window !== 'undefined' && (window as any).ethereum 
    ? createWalletClient({
        chain: base,
        transport: custom((window as any).ethereum),
      })
    : null;

  const createSigner = (
    address: `0x${string}`,
    walletClient: any
  ): Signer => {
    return {
      type: 'EOA',
      getIdentifier: () => ({
        identifier: address.toLowerCase(),
        identifierKind: 'ethereum',
      }),
      signMessage: async (message: string) => {
        const signature = await walletClient.signMessage({
          account: address,
          message,
        });
        return toBytes(signature);
      },
    };
  };

  const connectWallet = async () => {
    setIsConnecting(true);
    setErrorMsg(null);
    setSuccessMessage(null);
    
    try {
      if (!isConnected) {
        // Connect wallet first
        connect({ connector: injected() });
        // Wait for connection
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      if (!address) {
        throw new Error('No wallet address found');
      }

      if (!walletClient) {
        throw new Error('Wallet client not available');
      }

      setSuccessMessage('Wallet Connected, please confirm signing with wallet');
      
      // Create an XMTP signer using the viem-based helper
      const xmtpSigner: Signer = createSigner(address, walletClient);
      await initClient(xmtpSigner, env);
      
      setSuccessMessage(prev => `${prev}\nXMTP Client initialized successfully`);
      
      if (options.onConnect) {
        options.onConnect();
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to connect wallet';
      setErrorMsg(error);
      if (options.onError) {
        options.onError(error);
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    disconnect();
    setSuccessMessage(null);
    setErrorMsg(null);
  };

  return {
    connectWallet,
    disconnectWallet,
    isConnecting,
    error: errorMsg,
    success: successMessage,
    address,
    isConnected,
    env,
    setEnv,
  };
}