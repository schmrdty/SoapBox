//--next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@prisma/client', 'prisma', 'crypto'],
  images: {
    domains: ['localhost', 'vercel.app'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  webpack: (config, { isServer }) => {
    // AGGRESSIVE test file exclusion - prevent ANY test files from being bundled
    const originalExternals = config.externals || []
    config.externals = [...originalExternals]
    
    if (!isServer) {
      // Block all test files from client-side bundles
      config.externals.push((context, request, callback) => {
        if (request.includes('__tests__') || 
            request.includes('.test.') || 
            request.includes('.spec.') ||
            request.includes('jest.config') ||
            request.includes('/jest/') ||
            request.endsWith('.test') ||
            request.endsWith('.spec')) {
          return callback(null, 'void 0')
        }
        callback()
      })
      
      // CRITICAL: Exclude server-only API routes from client bundle
      config.externals.push((context, request, callback) => {
        if (request.includes('/api/deployment-status') ||
            request.includes('databaseBackup') ||
            request.includes('deploymentReadiness') ||
            request.includes('/services/')) {
          return callback(null, 'void 0')
        }
        callback()
      })
      
      // These packages should only be used on the client side  
      config.externals.push({
        '@farcaster/miniapp-sdk': 'commonjs @farcaster/miniapp-sdk',
        '@xmtp/browser-sdk': 'commonjs @xmtp/browser-sdk',
        'posthog-js': 'commonjs posthog-js'
      })
      
      // Exclude server-only Node.js modules from client bundle
      config.externals.push({
        'crypto': 'crypto',
        'fs': 'fs',
        'path': 'path',
        'os': 'os',
        'request': 'request',
        'winston': 'winston',
        'ioredis': 'ioredis',
        'tough-cookie': 'tough-cookie',
        'prisma': 'prisma',
        '@prisma/client': '@prisma/client'
      })
    }
    
    // Exclude test files from webpack processing
    config.module.rules.push({
      test: /\.(js|ts|tsx)$/,
      exclude: [
        /node_modules/,
        /__tests__/,
        /\.test\./,
        /\.spec\./,
        /jest\.config\./
      ]
    })
    
    // Add ignore-loader for test files
    config.module.rules.push({
      test: /\.(test|spec)\.(js|jsx|ts|tsx)$/,
      loader: 'ignore-loader'
    })
    
    // Completely exclude test directories and files from webpack processing
    config.module.rules.push({
      test: /(__tests__|\.test\.|\.spec\.)/,
      loader: 'ignore-loader'
    })
    
    // Ensure test files are completely excluded from client bundle
    config.externals = config.externals || []
    if (!isServer) {
      config.externals.push((context, request, callback) => {
        if (request.includes('__tests__') || request.includes('.test.') || request.includes('.spec.')) {
          return callback(null, 'commonjs ' + request)
        }
        callback()
      })
    }
    
    // Handle modules that might cause SSR issues
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    }
    
    return config
  },
  // Disable static optimization for problematic pages
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
        ],
      },
    ]
  }
}

module.exports = nextConfig