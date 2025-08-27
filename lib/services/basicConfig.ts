//--config.ts
'use client';

import { createConfig, http } from 'wagmi';
import { base } from 'wagmi/chains';
import { injected } from 'wagmi/connectors';

export const config = createConfig({
  chains: [base],
  connectors: [
    injected({
      target: 'metaMask',
    }),
  ],
  transports: {
    [base.id]: http(),
  },
});