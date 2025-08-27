//--src/app/page.tsx
'use client'

import { useEffect } from 'react'
import dynamic from 'next/dynamic'

// Dynamic import with no SSR to prevent hydration issues
const SoapBoxMain = dynamic(() => import('../components/SoapBoxMain'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
        <p className="text-white">Loading SoapBox...</p>
      </div>
    </div>
  )
})

export default function HomePage() {
  useEffect(() => {
    const initFarcaster = async () => {
      if (typeof window !== 'undefined') {
        try {
          const { sdk } = await import('@farcaster/miniapp-sdk')
          sdk.actions.ready()
          console.log('Farcaster SDK initialized successfully')
        } catch (error) {
          console.error('Failed to initialize Farcaster SDK:', error)
        }
      }
    }
    
    initFarcaster()
  }, [])

  return <SoapBoxMain />
}