//--/src/app/soapbox/[tokenSymbol]/page.tsx
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import RSSTickerFeed from '@/components/RSSTickerFeed'

interface TokenTickerPageProps {
  params: { tokenSymbol: string }
}

async function getTokenData(tokenSymbol: string) {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/soapbox/${tokenSymbol}/ticker`, {
      next: { revalidate: 30 } // Revalidate every 30 seconds
    })
    
    if (!response.ok) {
      return null
    }
    
    return await response.json()
  } catch (error) {
    console.error('Failed to fetch token data:', error)
    return null
  }
}

export async function generateMetadata({ params }: TokenTickerPageProps): Promise<Metadata> {
  const tokenSymbol = decodeURIComponent(params.tokenSymbol).replace('$', '').toUpperCase()
  const tokenData = await getTokenData(tokenSymbol)
  
  if (!tokenData) {
    return {
      title: 'Token Not Found - SoapBox',
      description: 'The requested token feed could not be found.'
    }
  }

  const { messages, roomCount, totalMessages } = tokenData
  const latestMessage = messages[0]?.content || 'No recent updates'
  
  return {
    title: `$${tokenSymbol} Live Community Feed - SoapBox`,
    description: `Live updates from ${roomCount} $${tokenSymbol} community rooms. ${totalMessages} pinned messages. Latest: ${latestMessage}`,
    keywords: [`${tokenSymbol}`, 'crypto', 'community', 'chat', 'live feed', 'SoapBox'],
    
    openGraph: {
      title: `$${tokenSymbol} SoapBox Feed`,
      description: `${totalMessages} live updates from ${roomCount} community rooms`,
      type: 'website',
      url: `${process.env.NEXT_PUBLIC_APP_URL}/soapbox/${tokenSymbol}`,
      images: [
        {
          url: `${process.env.NEXT_PUBLIC_APP_URL}/api/og-ticker/${tokenSymbol}`,
          width: 1200,
          height: 630,
          alt: `$${tokenSymbol} Live Community Feed`
        }
      ],
      siteName: 'SoapBox'
    },
    
    twitter: {
      card: 'summary_large_image',
      title: `$${tokenSymbol} Live Feed`,
      description: `${totalMessages} community updates from ${roomCount} rooms`,
      images: [`${process.env.NEXT_PUBLIC_APP_URL}/api/og-ticker/${tokenSymbol}`],
      creator: '@soapbox'
    },

    // Discord-specific meta tags
    other: {
      'theme-color': '#8B5CF6',
      'og:site_name': 'SoapBox',
      'twitter:domain': process.env.NEXT_PUBLIC_DOMAIN || 'schmidtiest.xyz'
    }
  }
}

export default async function TokenTickerPage({ params }: TokenTickerPageProps) {
  const tokenSymbol = decodeURIComponent(params.tokenSymbol).replace('$', '').toUpperCase()
  const tokenData = await getTokenData(tokenSymbol)
  
  if (!tokenData) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-black relative">
      {/* Platform-optimized ticker display */}
      <RSSTickerFeed 
        tokenSymbol={tokenSymbol}
        messages={tokenData.messages}
        variant="embed"
        showSoapBoxBackground={true}
        autoRefresh={true}
        refreshInterval={30000}
        className="platform-optimized"
      />
      
      {/* Invisible content for SEO/crawlers */}
      <div className="sr-only">
        <h1>$${tokenSymbol} Live Community Feed</h1>
        <p>{tokenData.totalMessages} pinned messages from ${tokenSymbol} community</p>
        <ul>
          {tokenData.messages.slice(0, 5).map((message: any) => (
            <li key={message.id}>{message.content}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}
