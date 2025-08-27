//--/src/lib/wagmi/config.ts
'use client'

import { createConfig, http } from 'wagmi'
import { base, mainnet } from 'wagmi/chains'
import { injected, walletConnect, coinbaseWallet } from 'wagmi/connectors'
import { farcasterConnector } from '@farcaster/miniapp-wagmi-connector'
import { detectPlatformEnvironment } from '@/lib/platformDetection'

export function getOptimalConnectors() {
  const env = detectPlatformEnvironment()
  const connectors = []

  // Platform-specific connectors
  if (env.isFarcasterMiniApp) {
    connectors.push(
      farcasterConnector({
        chainId: base.id,
        rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || 'https://mainnet.base.org',
        metadata: {
          name: 'SoapBox',
          description: 'Token-gated XMTP group chats',
          url: process.env.NEXT_PUBLIC_APP_URL || 'https://schmidtiest.xyz',
          icons: [`${process.env.NEXT_PUBLIC_APP_URL}/icon.png`]
        }
      })
    )
  }

  if (env.isWorldApp) {
    connectors.push(injected({ target: 'worldApp' }))
  }

  // Universal connectors
  connectors.push(
    coinbaseWallet({
      appName: 'SoapBox',
      appLogoUrl: `${process.env.NEXT_PUBLIC_APP_URL}/icon.png`,
      chains: [base, mainnet]
    })
  )

  if (env.isMobile) {
    connectors.push(
      walletConnect({
        projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!,
        metadata: {
          name: 'SoapBox',
          description: 'Cross-platform token community feeds',
          url: process.env.NEXT_PUBLIC_APP_URL || 'https://schmidtiest.xyz',
          icons: [`${process.env.NEXT_PUBLIC_APP_URL}/icon.png`]
        }
      })
    )
  }

  connectors.push(injected())

  return connectors
}

export const config = createConfig({
  chains: [base, mainnet],
  connectors: getOptimalConnectors(),
  transports: {
    [base.id]: http(process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org'),
    [mainnet.id]: http(process.env.NEXT_PUBLIC_MAINNET_RPC_URL)
  },
  ssr: true
})
