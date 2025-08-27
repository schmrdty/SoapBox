//--providers.tsx
'use client';

import type { ReactNode } from 'react';
import { OnchainKitProvider } from '@coinbase/onchainkit';
import { base } from 'wagmi/chains';
import { SoapBoxErrorBoundary } from './SoapBoxErrorBoundary';
import { XMTPProvider } from '@/providers/XMTPProvider';
import { WagmiProvider } from 'wagmi';
import { config } from '@/lib/wagmi/config';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <SoapBoxErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={config}>
          <OnchainKitProvider
            apiKey="EUK6nliWVdB5Nkt4VuNXUsAV7VwBmtwR"
            projectId="1d0226d4-9f84-48d6-9486-b4381e220d9f"
            chain={base}
            config={{
              appearance: {
                name: 'SoapBox',
                logo: 'https://bafybeif5xkywbobrs4zjbvwjpurvnk57xrvwfb2ksxffzzk2hr4dc6sofi.ipfs.w3s.link/EmpireSoapBox.png',
                mode: 'auto',
                theme: 'default',
              },
            }}
          >
            <XMTPProvider>
              {children}
            </XMTPProvider>
          </OnchainKitProvider>
        </WagmiProvider>
      </QueryClientProvider>
    </SoapBoxErrorBoundary>
  );
}