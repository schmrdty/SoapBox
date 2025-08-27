//--README.MD
# SoapBox 🧼

> **Token-gated XMTP group chats for Empire Builder vault-authorized communities**

SoapBox is a sophisticated decentralized messaging application that combines real-time chat capabilities with blockchain-based authorization, creating exclusive community spaces for token holders and vault participants.

## 🏗️ **Architecture Overview**

SoapBox integrates multiple cutting-edge technologies to deliver a seamless Web3 messaging experience:

- **Frontend**: Next.js 15 + React 19 + TypeScript
- **Database**: PostgreSQL + Prisma ORM
- **Caching**: Redis with pub/sub for massive scale (500K-5M users)
- **Real-time**: XMTP SDK + SpacetimeDB for decentralized messaging
- **Blockchain**: Wagmi + Viem + OnchainKit (Base chain)
- **UI**: Tailwind CSS + Shadcn/ui + Radix UI primitives

## 📁 **Project Structure**

```
soapbox/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # Server-side API routes (30+ endpoints)
│   │   │   ├── auth/          # Authentication & user management
│   │   │   ├── empire-*/      # Empire API integrations
│   │   │   ├── rooms/         # Room management & access control
│   │   │   └── proxy/         # External API proxy
│   │   ├── fonts/             # Geist font assets
│   │   ├── types/             # Global TypeScript interfaces
│   │   ├── globals.css        # Global styles
│   │   ├── layout.tsx         # Root layout with providers
│   │   └── page.tsx           # Main application entry point
│   │
│   ├── components/            # React components
│   │   ├── ui/               # Shadcn/ui component library (50+ components)
│   │   ├── enhanced/         # Enhanced admin & management components
│   │   ├── wallet/           # Wallet connection components
│   │   └── providers.tsx     # Application providers
│   │
│   ├── hooks/                 # Custom React hooks
│   │   ├── useAuth.ts        # Authentication logic
│   │   ├── useXMTPChat.ts    # XMTP messaging integration
│   │   ├── useEmpireApi.ts   # Empire API interactions
│   │   └── useWalletConnect.ts # Wallet connection management
│   │
│   ├── lib/                   # Utility libraries & services
│   │   ├── services/         # Core business logic (20+ services)
│   │   │   ├── prisma.ts     # Database client & operations
│   │   │   ├── empireApi.ts  # Empire API service layer
│   │   │   ├── realAnalytics.ts # Analytics & monitoring
│   │   │   └── tokenPricing.ts  # Token price resolution
│   │   ├── wagmi/           # Blockchain configuration
│   │   ├── redis.ts         # High-performance Redis setup
│   │   └── utils/           # Utility functions
│   │
│   ├── providers/            # Context providers
│   │   └── XMTPProvider.tsx  # XMTP messaging context
│   │
│   └── spacetime_module_bindings/ # SpacetimeDB auto-generated bindings
│       ├── index.ts          # Main exports
│       ├── *_table.ts        # Table interfaces
│       └── *_reducer.ts      # Reducer functions
│
├── spacetime-server/          # SpacetimeDB Rust backend
│   └── src/lib.rs            # Database schema & server-side logic
│
├── prisma/                    # Database schema & migrations
│   └── schema.prisma         # PostgreSQL schema definition
│
├── next.config.js            # Next.js configuration
├── tailwind.config.ts        # Tailwind CSS configuration
└── package.json              # Dependencies & scripts
```

## 🚀 **Getting Started**

### Prerequisites

- **Node.js** 18+ with npm/yarn
- **PostgreSQL** database
- **Redis** server (for scaling)
- **SpacetimeDB** (optional, for real-time features)

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd soapbox
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment setup**
   ```bash
   cp .env.example .env.local
   ```

4. **Database setup**
   ```bash
   npx prisma migrate dev
   npx prisma generate
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

## 🔧 **Required Dependencies**

### Core Framework
```json
{
  "next": "15.3.4",
  "react": "19.1.0",
  "react-dom": "19.1.0",
  "typescript": "5.8.3"
}
```

### Blockchain & Web3
```json
{
  "@coinbase/onchainkit": "^0.38.17",
  "@base-org/account": "^1.1.1",
  "@base-org/account-ui": "^1.0.1",
  "wagmi": "^2.16.3",
  "viem": "^2.33.3",
  "@tanstack/react-query": "^5.85.3",
  "@reown/appkit": "^1.7.19",
  "@reown/appkit-adapter-wagmi": "^1.7.19"
}
```

### Messaging & Real-time
```json
{
  "@xmtp/browser-sdk": "^2.0.0",
  "@farcaster/miniapp-sdk": "^0.1.7",
  "@farcaster/miniapp-wagmi-connector": "^1.0.0",
  "@farcaster/quick-auth": "0.0.7",
  "ioredis": "^5.6.1"
}
```

### Database & ORM
```json
{
  "@prisma/client": "^6.13.0",
  "prisma": "^6.13.0"
}
```

### UI & Styling
```json
{
  "tailwindcss": "^3.4.1",
  "@radix-ui/react-*": "^1.x.x",
  "lucide-react": "^0.511.0",
  "framer-motion": "^12.12.1",
  "sonner": "^2.0.3"
}
```

### Development Tools
```json
{
  "@types/node": "20.17.47",
  "@types/react": "19.1.8",
  "@types/react-dom": "19.1.6",
  "autoprefixer": "^10.4.21",
  "postcss": "^8"
}
```

## 🌍 **Environment Variables**

### Database & Redis
```bash
DATABASE_URL="postgresql://username:password@localhost:5432/soapbox"
REDIS_HOST="localhost"
REDIS_PORT="6379"
REDIS_PASSWORD="your-redis-password"
```

### Blockchain RPCs (Client-accessible)
```bash
NEXT_PUBLIC_ALCHEMY1="your-alchemy-api-key-1"
NEXT_PUBLIC_ALCHEMY2="your-alchemy-api-key-2"
NEXT_PUBLIC_PIMLICO1="your-pimlico-api-key-1"
NEXT_PUBLIC_BASE_PRIVATE_RPC_URL="your-primary-rpc-url"
```

### API Keys & Services
```bash
OPENAI_API_KEY="your-openai-key"
EMPIRE_API_KEY="your-empire-api-key"
POSTHOG_PROJECT_ID="your-posthog-id"
POSTHOG_HOST="https://app.posthog.com"
```

## 🎯 **Key Features**

- **🔐 Token-gated Access**: Vault-based authorization system
- **💬 Real-time Messaging**: XMTP + SpacetimeDB integration
- **🎮 Interactive Elements**: Games, tipping, rich media
- **🔧 Admin Controls**: Comprehensive moderation tools
- **⚡ High Performance**: Redis caching for 500K-5M users
- **🌐 Cross-platform**: Telegram, Discord, Slack integrations
- **📊 Analytics**: Built-in monitoring and insights

## 🧪 **Development Scripts**

```bash
npm run dev                 # Start development server
npm run build              # Production build
npm run start              # Start production server
npm run lint               # ESLint checking
npm run test               # Run test suite
npm run deps:analyze       # Analyze dependencies
npm run build:analyze      # Bundle size analysis
```

## 🗂️ **Database Schema**

The application uses PostgreSQL with the following core entities:

- **EmpireRoom**: Chat rooms tied to Empire vaults
- **ChatMessage**: Persistent message storage with moderation
- **DirectMessage**: Private messaging between users
- **RoomSettings**: Configurable room parameters
- **TokenCache**: Token information caching
- **AuthorizedAddressCache**: Vault authorization caching
- **ModerationAudit**: Moderation action tracking

## 🏛️ **SpacetimeDB Integration**

SpacetimeDB provides real-time, decentralized data synchronization with:

- **Tables**: Users, Rooms, Messages, Vaults, Fees
- **Reducers**: Server-side business logic in Rust
- **Real-time Subscriptions**: Live data updates
- **Decentralized Compute**: Database-embedded logic

## 🎨 **UI/UX Framework**

Built with a comprehensive design system:

- **50+ Shadcn/ui components** (buttons, forms, dialogs, etc.)
- **Radix UI primitives** for accessibility
- **Tailwind CSS** for styling
- **Dark/light mode support**
- **Mobile-responsive design**
- **Error boundaries** for stability

## 🔧 **Service Architecture**

Modular service layer with:

- **Authentication**: JWT + wallet-based auth
- **Empire API**: Decentralized model integration
- **Token Resolution**: Base token information
- **Moderation**: Software + AI-powered content filtering
- **Analytics**: PostHog integration
- **Caching**: Multi-layer Redis caching

## 🚨 **Production Considerations**

- **Environment Variables**: Secure all API keys
- **Database**: Set up PostgreSQL with proper indices
- **Redis**: Configure for high availability
- **RPC Endpoints**: Use private/authenticated RPCs
- **Monitoring**: Enable PostHog analytics
- **Error Handling**: Comprehensive error boundaries

## 📖 **Additional Resources**

- **XMTP Docs**: https://docs.xmtp.org/
- **SpacetimeDB Docs**: https://spacetimedb.com/docs
- **Wagmi Docs**: https://wagmi.sh/
- **Prisma Docs**: https://www.prisma.io/docs
- **Base Docs**: https://docs.base.org/

---

**Happy Building! 🚀**