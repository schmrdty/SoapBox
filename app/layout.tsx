//--layout.tsx
import type { Metadata } from 'next';
import '@coinbase/onchainkit/styles.css';
import './globals.css';
import { Providers } from '../components/providers';

export const metadata: Metadata = {
  title: 'SoapBox',
  description: 'Token-gated XMTP group chats for Empire Builder vault-authorized communities',
  other: {
    'fc:frame': JSON.stringify({
      version: 'next',
      imageUrl: 'https://bafybeif5xkywbobrs4zjbvwjpurvnk57xrvwfb2ksxffzzk2hr4dc6sofi.ipfs.w3s.link/EmpireSoapBox.png',
      button: {
        title: 'Open with Ohara',
        action: {
          type: 'launch_frame',
          name: 'SoapBox',
          url: 'https://travel-wonderful-998.preview.series.engineering',
          splashImageUrl: 'https://bafybeif5xkywbobrs4zjbvwjpurvnk57xrvwfb2ksxffzzk2hr4dc6sofi.ipfs.w3s.link/EmpireSoapBox.png',
          splashBackgroundColor: '#000000'
        }
      }
    })
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-black text-white">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}