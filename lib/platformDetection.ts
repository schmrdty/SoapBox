//--/src/lib/platformDetection.ts
'use client'

export interface PlatformEnvironment {
  isFarcasterMiniApp: boolean
  isTelegramWebApp: boolean
  isDiscordActivity: boolean
  isSlackApp: boolean
  isWorldApp: boolean
  isMobile: boolean
  platform: 'farcaster' | 'telegram' | 'discord' | 'slack' | 'world' | 'web'
}

export function detectPlatformEnvironment(): PlatformEnvironment {
  if (typeof window === 'undefined') {
    return {
      isFarcasterMiniApp: false,
      isTelegramWebApp: false, 
      isDiscordActivity: false,
      isSlackApp: false,
      isWorldApp: false,
      isMobile: false,
      platform: 'web'
    }
  }

  // Farcaster detection
  const isFarcasterMiniApp = !!(window as any).fc || 
    window.location.hostname.includes('warpcast') ||
    window.parent !== window && document.referrer.includes('warpcast')

  // Telegram Web App detection
  const isTelegramWebApp = !!(window as any).Telegram?.WebApp

  // Discord Activity detection  
  const isDiscordActivity = !!(window as any).DiscordSDK ||
    window.location.hostname.includes('discord') ||
    window.parent !== window && document.referrer.includes('discord')

  // Slack App detection
  const isSlackApp = window.location.hostname.includes('slack-files') ||
    window.parent !== window && document.referrer.includes('slack')

  // World App detection
  const isWorldApp = !!(window as any).WorldApp || 
    navigator.userAgent.includes('WorldApp')

  // Mobile detection
  const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    window.innerWidth < 768

  // Determine primary platform
  let platform: PlatformEnvironment['platform'] = 'web'
  if (isFarcasterMiniApp) platform = 'farcaster'
  else if (isTelegramWebApp) platform = 'telegram' 
  else if (isDiscordActivity) platform = 'discord'
  else if (isSlackApp) platform = 'slack'
  else if (isWorldApp) platform = 'world'

  return {
    isFarcasterMiniApp,
    isTelegramWebApp,
    isDiscordActivity, 
    isSlackApp,
    isWorldApp,
    isMobile,
    platform
  }
}

export function getTelegramWebApp() {
  return typeof window !== 'undefined' ? (window as any).Telegram?.WebApp : null
}

export function getDiscordSDK() {
  return typeof window !== 'undefined' ? (window as any).DiscordSDK : null
}
