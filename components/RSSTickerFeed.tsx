//--/src/components/RSSTickerFeed.tsx
'use client'

import type { ReactNode } from 'react'
import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge' 
import { ScrollArea } from '@/components/ui/scroll-area'
import { Pin, MessageSquare, Users, Activity } from 'lucide-react'
import { detectPlatformEnvironment } from '@/lib/platformDetection'

export interface TickerMessage {
  id: string
  content: string
  authorName?: string
  authorAddress: string
  roomName: string
  roomId: string
  timestamp: Date
  isEmergencyOverride?: boolean
}

export interface TickerData {
  messages: TickerMessage[]
  roomCount: number
  totalMessages: number
  tokenSymbol: string
  lastUpdated: Date
}

interface RSSTickerFeedProps {
  tokenSymbol?: string
  fetchUrl?: string
  messages?: TickerMessage[]
  className?: string
  variant?: 'splash' | 'signin' | 'embed' | 'card'
  showSoapBoxBackground?: boolean
  autoRefresh?: boolean
  refreshInterval?: number
}

export default function RSSTickerFeed({ 
  tokenSymbol,
  fetchUrl,
  messages: initialMessages,
  className = '',
  variant = 'signin',
  showSoapBoxBackground = false,
  autoRefresh = false,
  refreshInterval = 30000
}: RSSTickerFeedProps): ReactNode {
  const [currentIndex, setCurrentIndex] = useState<number>(0)
  const [tickerData, setTickerData] = useState<TickerData | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(fetchUrl))
  const platform = detectPlatformEnvironment()

  // Use either fetched data or passed messages
  const messages = tickerData?.messages || initialMessages || []
  const roomCount = tickerData?.roomCount || 0
  const totalMessages = tickerData?.totalMessages || messages.length

  // Auto-rotating ticker effect
  useEffect(() => {
    if (messages.length === 0) return

    let timeoutId: NodeJS.Timeout
    let lastUpdate = Date.now()
    
    const updateIndex = () => {
      const now = Date.now()
      if (now - lastUpdate >= 4000) {
        setCurrentIndex((prev) => (prev + 1) % messages.length)
        lastUpdate = now
      }
      timeoutId = setTimeout(updateIndex, 1000)
    }
    
    timeoutId = setTimeout(updateIndex, 4000)
    return () => clearTimeout(timeoutId)
  }, [messages.length])

  // Live data fetching
  useEffect(() => {
    if (!fetchUrl && !tokenSymbol) return

    const url = fetchUrl || `/api/soapbox/${tokenSymbol}/ticker`
    
    const fetchData = async () => {
      try {
        setIsLoading(true)
        const response = await fetch(url)
        if (response.ok) {
          const data = await response.json()
          setTickerData(data)
        }
      } catch (error) {
        console.error('Failed to fetch ticker data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
    
    if (autoRefresh) {
      const interval = setInterval(fetchData, refreshInterval)
      return () => clearInterval(interval)
    }
  }, [fetchUrl, tokenSymbol, autoRefresh, refreshInterval])

  if (messages.length === 0 && !isLoading) {
    return null
  }

  // Platform-specific styling adjustments
  const platformClasses = {
    telegram: 'telegram-webapp-safe-area',
    discord: 'discord-activity-safe-area',
    slack: 'slack-app-safe-area',
    farcaster: 'farcaster-miniapp-safe-area',
    web: '',
    world: 'world-app-safe-area'
  }

  // Splash/Embed variant (full screen ticker)
  if (variant === 'splash' || variant === 'embed') {
    return (
      <div className={`fixed inset-0 pointer-events-none z-10 ${platformClasses[platform.platform]} ${className}`}>
        {/* Background */}
        {showSoapBoxBackground && (
          <div 
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage: 'url(https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/358ee116-d505-4e83-a80d-d7e1baa68a2c-WGSZ7Usr6xI14zZDPgXcDRL8IlFZ2E)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat'
            }}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
          </div>
        )}

        {/* Stats Header */}
        <div className="absolute top-4 right-4 flex items-center space-x-4 text-white/80 text-sm">
          {tokenSymbol && (
            <div className="flex items-center space-x-2">
              <Activity className="h-4 w-4" />
              <span className="font-bold">${tokenSymbol}</span>
            </div>
          )}
          {roomCount > 0 && (
            <div className="flex items-center space-x-1">
              <Users className="h-3 w-3" />
              <span>{roomCount}</span>
            </div>
          )}
          <div className="flex items-center space-x-1">
            <Pin className="h-3 w-3" />
            <span>{totalMessages}</span>
          </div>
        </div>
        
        {/* Scrolling Messages */}
        <div className="absolute bottom-20 left-0 right-0 overflow-hidden">
          <div className="whitespace-nowrap animate-scroll-left">
            <div className="inline-flex space-x-8">
              {messages.map((message, index) => (
                <div
                  key={`${message.id}-${index}`}
                  className={`inline-flex items-center space-x-3 backdrop-blur-sm rounded-full px-6 py-3 border ${
                    message.isEmergencyOverride 
                      ? 'bg-red-500/80 border-red-400/50' 
                      : 'bg-black/80 border-purple-500/30'
                  }`}
                >
                  <Pin className={`h-4 w-4 flex-shrink-0 ${
                    message.isEmergencyOverride ? 'text-red-300' : 'text-purple-400'
                  }`} />
                  <span className="text-white font-medium text-sm">
                    {message.content}
                  </span>
                  <Badge variant="outline" className={`text-xs ${
                    message.isEmergencyOverride 
                      ? 'border-red-400/50 text-red-200' 
                      : 'border-purple-500/30 text-purple-300'
                  }`}>
                    {message.roomName}
                  </Badge>
                  {message.authorName && (
                    <span className="text-white/70 text-xs">
                      by {message.authorName}
                    </span>
                  )}
                </div>
              ))}
              {/* Duplicate for seamless loop */}
              {messages.map((message, index) => (
                <div
                  key={`${message.id}-duplicate-${index}`}
                  className={`inline-flex items-center space-x-3 backdrop-blur-sm rounded-full px-6 py-3 border ${
                    message.isEmergencyOverride 
                      ? 'bg-red-500/80 border-red-400/50' 
                      : 'bg-black/80 border-purple-500/30'
                  }`}
                >
                  <Pin className={`h-4 w-4 flex-shrink-0 ${
                    message.isEmergencyOverride ? 'text-red-300' : 'text-purple-400'
                  }`} />
                  <span className="text-white font-medium text-sm">
                    {message.content}
                  </span>
                  <Badge variant="outline" className={`text-xs ${
                    message.isEmergencyOverride 
                      ? 'border-red-400/50 text-red-200' 
                      : 'border-purple-500/30 text-purple-300'
                  }`}>
                    {message.roomName}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Card variant (existing functionality)
  return (
    <Card className={`bg-slate-800/50 backdrop-blur-xl border-slate-700/50 ${className}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <MessageSquare className="h-4 w-4 text-purple-400" />
            <span className="text-sm font-medium text-purple-300">
              {tokenSymbol ? `$${tokenSymbol} Feed` : 'SoapBox Feed'}
            </span>
            <Badge variant="outline" className="text-xs border-slate-600 text-slate-400">
              {totalMessages} pinned
            </Badge>
          </div>
          {roomCount > 0 && (
            <div className="flex items-center space-x-1 text-slate-400 text-xs">
              <Users className="h-3 w-3" />
              <span>{roomCount} rooms</span>
            </div>
          )}
        </div>
        
        <ScrollArea className="h-32">
          <div className="space-y-2">
            {isLoading && messages.length === 0 ? (
              <div className="text-center text-slate-500 py-4">
                Loading feed...
              </div>
            ) : (
              messages.map((message, index) => (
                <div
                  key={message.id}
                  className={`p-3 rounded-lg border transition-all duration-300 ${
                    index === currentIndex
                      ? 'bg-purple-500/20 border-purple-500/30 transform scale-105'
                      : message.isEmergencyOverride
                      ? 'bg-red-500/20 border-red-500/30'
                      : 'bg-slate-700/30 border-slate-600/30'
                  }`}
                >
                  <div className="flex items-start justify-between space-x-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-medium mb-1 truncate">
                        {message.content}
                      </p>
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline" className={`text-xs ${
                          message.isEmergencyOverride 
                            ? 'border-red-500/50 text-red-300'
                            : 'border-slate-600 text-slate-400'
                        }`}>
                          {message.roomName}
                        </Badge>
                        {message.authorName && (
                          <span className="text-xs text-slate-500">
                            by {message.authorName}
                          </span>
                        )}
                      </div>
                    </div>
                    <Pin className={`h-3 w-3 flex-shrink-0 mt-1 ${
                      message.isEmergencyOverride ? 'text-red-400' : 'text-purple-400'
                    }`} />
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}