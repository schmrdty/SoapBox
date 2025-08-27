//--src/components/LoadingBoundary.tsx
'use client'

import { ReactNode, Suspense } from 'react'
import { SoapBoxErrorBoundary } from './SoapBoxErrorBoundary'

interface LoadingBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  error?: ReactNode
  className?: string
  loadingText?: string
  errorTitle?: string
  errorDescription?: string
  onError?: (error: Error, errorInfo: any) => void
}

/**
 * Loading state component for blockchain operations
 */
function BlockchainLoadingState({ 
  text = 'Loading blockchain data...', 
  className = '' 
}: { 
  text?: string 
  className?: string 
}) {
  return (
    <div className={`flex items-center justify-center py-8 ${className}`}>
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">{text}</p>
        <p className="text-sm text-gray-500 mt-2">
          This may take a moment while we fetch data from the blockchain...
        </p>
      </div>
    </div>
  )
}

/**
 * Loading state component for API operations
 */
function ApiLoadingState({ 
  text = 'Loading data...', 
  className = '' 
}: { 
  text?: string 
  className?: string 
}) {
  return (
    <div className={`flex items-center justify-center py-6 ${className}`}>
      <div className="text-center">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600 mx-auto mb-3"></div>
        <p className="text-gray-600 text-sm">{text}</p>
      </div>
    </div>
  )
}

/**
 * Loading state component for token operations
 */
function TokenLoadingState({ 
  text = 'Resolving token metadata...', 
  className = '' 
}: { 
  text?: string 
  className?: string 
}) {
  return (
    <div className={`flex items-center justify-center py-4 ${className}`}>
      <div className="text-center">
        <div className="animate-pulse rounded-full h-4 w-4 bg-green-600 mx-auto mb-2"></div>
        <p className="text-gray-600 text-xs">{text}</p>
      </div>
    </div>
  )
}

/**
 * Error state component for client-side errors
 */
function ClientErrorState({ 
  title = 'Something went wrong',
  description = 'We encountered an error while loading this content.',
  onRetry,
  className = ''
}: { 
  title?: string
  description?: string
  onRetry?: () => void
  className?: string 
}) {
  return (
    <div className={`flex items-center justify-center py-8 ${className}`}>
      <div className="text-center max-w-md">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-red-500 text-2xl">⚠️</span>
        </div>
        <h3 className="text-lg font-semibold text-red-600 mb-2">{title}</h3>
        <p className="text-gray-600 mb-4">{description}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * Comprehensive loading boundary with error handling
 */
export function LoadingBoundary({
  children,
  fallback,
  error,
  className = '',
  loadingText = 'Loading...',
  errorTitle = 'Loading Error',
  errorDescription = 'Failed to load content. Please try again.',
  onError
}: LoadingBoundaryProps) {
  const defaultFallback = fallback || <ApiLoadingState text={loadingText} />
  const defaultError = error || (
    <ClientErrorState 
      title={errorTitle} 
      description={errorDescription}
    />
  )

  return (
    <div className={className}>
      <SoapBoxErrorBoundary 
        onError={onError}
      >
        <Suspense fallback={defaultFallback}>
          {children}
        </Suspense>
      </SoapBoxErrorBoundary>
    </div>
  )
}

/**
 * Specialized loading boundary for blockchain operations
 */
export function BlockchainLoadingBoundary({
  children,
  className = '',
  loadingText = 'Loading blockchain data...',
  onError
}: {
  children: ReactNode
  className?: string
  loadingText?: string
  onError?: (error: Error, errorInfo: any) => void
}) {
  return (
    <LoadingBoundary
      className={className}
      fallback={<BlockchainLoadingState text={loadingText} />}
      error={
        <ClientErrorState 
          title="Blockchain Error"
          description="Failed to load blockchain data. This might be due to network issues or RPC failures."
        />
      }
      onError={onError}
    >
      {children}
    </LoadingBoundary>
  )
}

/**
 * Specialized loading boundary for token operations
 */
export function TokenLoadingBoundary({
  children,
  className = '',
  loadingText = 'Resolving token metadata...',
  onError
}: {
  children: ReactNode
  className?: string
  loadingText?: string
  onError?: (error: Error, errorInfo: any) => void
}) {
  return (
    <LoadingBoundary
      className={className}
      fallback={<TokenLoadingState text={loadingText} />}
      error={
        <ClientErrorState 
          title="Token Resolution Error"
          description="Failed to resolve token metadata. The token might not be available or network issues occurred."
        />
      }
      onError={onError}
    >
      {children}
    </LoadingBoundary>
  )
}

/**
 * Specialized loading boundary for Empire API operations
 */
export function EmpireApiLoadingBoundary({
  children,
  className = '',
  loadingText = 'Loading Empire data...',
  onError
}: {
  children: ReactNode
  className?: string
  loadingText?: string
  onError?: (error: Error, errorInfo: any) => void
}) {
  return (
    <LoadingBoundary
      className={className}
      fallback={<ApiLoadingState text={loadingText} />}
      error={
        <ClientErrorState 
          title="Empire API Error"
          description="Failed to load Empire data. The Empire API might be temporarily unavailable."
        />
      }
      onError={onError}
    >
      {children}
    </LoadingBoundary>
  )
}

// Export individual loading states for direct use
export {
  BlockchainLoadingState,
  ApiLoadingState,
  TokenLoadingState,
  ClientErrorState
}