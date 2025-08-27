/** @type {import('next').NextConfig} */

// Import bundle analyzer
import bundleAnalyzer from '@next/bundle-analyzer'

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
  openAnalyzer: false, // Don't auto-open browser
})

const nextConfig = {
  // Enable experimental features for better performance
  experimental: {
    optimizeCss: true,
    optimizePackageImports: [
      'viem', 
      '@prisma/client', 
      '@xmtp/browser-sdk',
      'lucide-react',
      '@radix-ui/react-icons',
      'framer-motion'
    ],
    // Enable server components by default
    serverComponents: true,
  },

  // Webpack configuration to aggressively prevent server-side packages from client bundles
  webpack: (config, { isServer, dev, nextRuntime }) => {
    // Comprehensive list of server-only packages that should NEVER be bundled for client
    const serverOnlyPackages = [
      // Database & ORM
      '@prisma/client',
      'prisma',
      'mysql2',
      'pg',
      'sqlite3',
      
      // Blockchain server-side libraries
      'ethers',
      'web3',
      
      // Node.js specific modules
      'fs',
      'path',
      'os',
      'crypto',
      'stream',
      'buffer',
      'util',
      'url',
      'querystring',
      'http',
      'https',
      'net',
      'tls',
      'zlib',
      'assert',
      'events',
      'child_process',
      
      // Logging & monitoring
      'winston',
      'pino',
      'pino-pretty',
      'bunyan',
      
      // Caching & databases
      'redis',
      'ioredis',
      'memcached',
      
      // Server-side analytics
      'posthog-node',
      'mixpanel',
      'segment',
      
      // Authentication libraries that use Node.js
      'jsonwebtoken',
      'passport',
      'bcryptjs',
      'bcrypt',
      
      // HTTP clients that use Node.js
      'axios',
      'node-fetch',
      'request',
      'superagent',
      
      // File system utilities
      'glob',
      'rimraf',
      'mkdirp',
      
      // Server utilities
      'dotenv',
      'cors',
      'helmet',
      'express',
      'fastify',
      
      // Our custom server services
      './lib/services/empireApi',
      './lib/services/roomDatabase',
      './lib/services/tokenInfoResolver',
      './lib/services/consolidatedSoapboxValidation',
      './lib/services/empireAuth',
      './lib/services/roomChat',
      './lib/services/tokenPricing',
      
      // RPC Configuration (server-side only)
      './lib/rpc-config',
    ]

    // Client-side bundle configuration
    if (!isServer && nextRuntime !== 'edge') {
      console.log('🔧 Configuring client-side webpack bundle...')

      // Aggressive externals configuration to exclude server packages
      config.externals = config.externals || []
      
      // Add server-only packages as externals
      serverOnlyPackages.forEach(pkg => {
        if (typeof config.externals === 'function') {
          const originalExternals = config.externals
          config.externals = (context, callback) => {
            if (context.request === pkg || context.request.startsWith(`${pkg}/`)) {
              return callback(null, `commonjs ${pkg}`)
            }
            return originalExternals(context, callback)
          }
        } else {
          config.externals.push({
            [pkg]: `commonjs ${pkg}`,
            [`${pkg}/.*`]: `commonjs ${pkg}`,
          })
        }
      })

      // Comprehensive Node.js fallbacks (disable ALL Node.js modules for client)
      config.resolve.fallback = {
        ...config.resolve.fallback,
        // Core Node.js modules
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        url: false,
        zlib: false,
        http: false,
        https: false,
        assert: false,
        os: false,
        path: false,
        querystring: false,
        buffer: false,
        util: false,
        events: false,
        child_process: false,
        cluster: false,
        dgram: false,
        dns: false,
        domain: false,
        readline: false,
        repl: false,
        stringDecoder: false,
        sys: false,
        timers: false,
        tty: false,
        vm: false,
        worker_threads: false,
        
        // Database modules
        mysql: false,
        mysql2: false,
        pg: false,
        sqlite3: false,
        
        // Additional server modules
        winston: false,
        'pino-pretty': false,
        ioredis: false,
        'posthog-node': false,
      }

      // Ignore server-side service files completely in client bundle
      config.module.rules.push({
        test: /src\/lib\/(services\/(empireApi|roomDatabase|tokenInfoResolver|consolidatedSoapboxValidation|empireAuth|roomChat|tokenPricing)|rpc-config)\.ts$/,
        use: 'ignore-loader',
      })

      // Ignore server-side API route files in client bundle
      config.module.rules.push({
        test: /src\/app\/api\/.*\/route\.ts$/,
        use: 'ignore-loader',
      })

      // Add specific handling for problematic imports
      config.module.rules.push({
        test: /node_modules\/(winston|pino|ioredis|@prisma\/client)/,
        use: 'ignore-loader',
      })

      // Replace server-side imports with empty objects in client bundle
      config.resolve.alias = {
        ...config.resolve.alias,
        // Replace server services with empty objects
        '@/lib/services/empireApi': false,
        '@/lib/services/roomDatabase': false,
        '@/lib/services/tokenInfoResolver': false,
        '@/lib/services/consolidatedSoapboxValidation': false,
        '@/lib/rpc-config': false,
      }

      // Optimize client bundle chunks
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          ...config.optimization.splitChunks,
          cacheGroups: {
            ...config.optimization.splitChunks?.cacheGroups,
            // Separate chunk for blockchain libraries
            blockchain: {
              test: /[\\/]node_modules[\\/](viem|wagmi|@wagmi)[\\/]/,
              name: 'blockchain',
              chunks: 'all',
              priority: 30,
            },
            // Separate chunk for UI libraries
            ui: {
              test: /[\\/]node_modules[\\/](@radix-ui|lucide-react|framer-motion)[\\/]/,
              name: 'ui',
              chunks: 'all',
              priority: 20,
            },
          },
        },
      }
    }

    // Server-side configuration
    if (isServer) {
      console.log('🖥️ Configuring server-side webpack bundle...')
      
      // Server can use all packages normally
      // But optimize for performance
      config.externals = config.externals || []
      
      // Externalize heavy dependencies on server to reduce bundle size
      config.externals.push('canvas', 'jsdom', 'puppeteer')
    }

    // Development-specific configuration
    if (dev) {
      console.log('🔧 Development mode webpack optimizations enabled')
      
      // Faster builds in development
      config.optimization = {
        ...config.optimization,
        removeAvailableModules: false,
        removeEmptyChunks: false,
        splitChunks: false,
      }
    }

    // Bundle analyzer configuration
    if (process.env.ANALYZE === 'true' && !isServer) {
      console.log('📊 Bundle analyzer will run after build completes')
      console.log('💡 Check .next/analyze/ folder for bundle reports')
    }

    // Log configuration summary
    console.log(`📦 Webpack configured for ${isServer ? 'server' : 'client'} (${dev ? 'development' : 'production'})`)
    
    return config
  },

  // Enhanced build configuration
  experimental: {
    ...nextConfig?.experimental,
    // Optimize server-side rendering
    serverMinification: true,
    // Better tree shaking
    optimizeCss: true,
    // Reduce JavaScript bundle size
    modularizeImports: {
      'lucide-react': {
        transform: 'lucide-react/dist/esm/icons/{{member}}',
      },
      '@radix-ui/react-icons': {
        transform: '@radix-ui/react-icons/dist/{{member}}',
      },
    },
  },

  // Performance optimizations
  compress: true,
  poweredByHeader: false,
  
  // Image optimization
  images: {
    domains: ['empire-builder.world', 'api.0x.org'],
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60,
  },

  // Headers for security and performance
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=()',
          },
        ],
      },
      // Cache static assets aggressively
      {
        source: '/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ]
  },

  // Redirects for better SEO
  async redirects() {
    return [
      // Add any redirects here if needed
    ]
  },

  // Environment variables
  env: {
    CUSTOM_KEY: 'my-value',
  },

  // TypeScript configuration
  typescript: {
    // Don't fail build on type errors in production (handle them separately)
    ignoreBuildErrors: false,
  },

  // ESLint configuration
  eslint: {
    ignoreDuringBuilds: false,
  },

  // Output configuration for deployment
  output: 'standalone',
  
  // Logging configuration
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
}

export default withBundleAnalyzer(nextConfig)