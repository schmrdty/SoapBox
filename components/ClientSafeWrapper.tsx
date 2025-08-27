//--src/components/ClientSafeWrapper.tsx
'use client'

import React, { Suspense, type ComponentType, type ReactNode } from 'react'
import { ErrorBoundary } from 'react-error-boundary'

// Error fallback component
function ErrorFallback({ 
  error, 
  resetErrorBoundary 
}: { 
  error: Error
  resetErrorBoundary: () => void 
}): React.ReactElement {
  return (
    <div className="min-h-[200px] flex items-center justify-center p-4">
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md w-full">
        <div className="flex items-center space-x-2 mb-3">
          <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
            <span className="text-white text-xs font-bold">!</span>
          </div>
          <h3 className="text-red-800 font-semibold">Component Error</h3>
        </div>
        
        <p className="text-red-700 text-sm mb-4">
          Something went wrong loading this component.
        </p>
        
        {process.env.NODE_ENV === 'development' && (
          <details className="mb-4">
            <summary className="text-red-600 text-xs cursor-pointer hover:text-red-800">
              View technical details
            </summary>
            <pre className="text-xs bg-red-100 p-2 rounded mt-2 overflow-auto text-red-800">
              {error.message}
            </pre>
          </details>
        )}
        
        <button
          onClick={resetErrorBoundary}
          className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded text-sm font-medium transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  )
}

// Loading fallback component
function LoadingFallback({ message = "Loading..." }: { message?: string }): React.ReactElement {
  return (
    <div className="min-h-[200px] flex items-center justify-center p-4">
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 max-w-md w-full">
        <div className="flex items-center space-x-3">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-blue-500"></div>
          <span className="text-gray-700 font-medium">{message}</span>
        </div>
      </div>
    </div>
  )
}

// Props for the ClientSafeWrapper
interface ClientSafeWrapperProps {
  children: ReactNode
  fallback?: ReactNode
  errorFallback?: ComponentType<{ error: Error; resetErrorBoundary: () => void }>
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
  className?: string
}

/**
 * ClientSafeWrapper - Wraps components with error boundaries and Suspense
 * 
 * This component provides:
 * - Error boundary protection for client-side components
 * - Suspense wrapper for loading states
 * - Graceful fallbacks when components fail to load
 * - Development-friendly error reporting
 */
export function ClientSafeWrapper({
  children,
  fallback = <LoadingFallback />,
  errorFallback = ErrorFallback,
  onError,
  className = "",
}: ClientSafeWrapperProps): React.ReactElement {
  return (
    <ErrorBoundary
      FallbackComponent={errorFallback}
      onError={onError}
      onReset={() => {
        // Reset any necessary state when user clicks "Try Again"
        if (typeof window !== 'undefined') {
          window.location.reload()
        }
      }}
    >
      <Suspense fallback={fallback}>
        <div className={className}>
          {children}
        </div>
      </Suspense>
    </ErrorBoundary>
  )
}

// Higher-order component for creating client-safe dynamic imports
export function withClientSafe<T extends Record<string, unknown>>(
  WrappedComponent: ComponentType<T>,
  options: {
    loadingMessage?: string
    errorMessage?: string
    displayName?: string
  } = {}
): ComponentType<T> {
  const {
    loadingMessage = "Loading component...",
    errorMessage = "Failed to load component",
    displayName = WrappedComponent.displayName || WrappedComponent.name || 'Component'
  } = options

  const ClientSafeComponent = (props: T) => {
    const customErrorFallback = ({ error, resetErrorBoundary }: { 
      error: Error
      resetErrorBoundary: () => void 
    }) => (
      <div className="min-h-[200px] flex items-center justify-center p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md w-full">
          <h3 className="text-red-800 font-semibold mb-2">{errorMessage}</h3>
          <p className="text-red-700 text-sm mb-4">
            The {displayName} component failed to load.
          </p>
          <button
            onClick={resetErrorBoundary}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded text-sm font-medium transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )

    return (
      <ClientSafeWrapper
        fallback={<LoadingFallback message={loadingMessage} />}
        errorFallback={customErrorFallback}
        onError={(error) => {
          console.error(`Error in ${displayName}:`, error)
        }}
      >
        <WrappedComponent {...props} />
      </ClientSafeWrapper>
    )
  }

  ClientSafeComponent.displayName = `withClientSafe(${displayName})`
  
  return ClientSafeComponent
}

// Utility for creating dynamic imports with proper SSR configuration
export function createClientSafeDynamicImport<T extends Record<string, unknown>>(
  importFn: () => Promise<{ default: ComponentType<T> }>,
  options: {
    ssr?: boolean
    loading?: ComponentType
    loadingMessage?: string
    errorMessage?: string
    displayName?: string
  } = {}
) {
  const {
    ssr = false, // Default to client-side only
    loading,
    loadingMessage = "Loading...",
    errorMessage = "Component failed to load",
    displayName = "DynamicComponent"
  } = options

  // Create the loading component
  const LoadingComponent = loading || (() => <LoadingFallback message={loadingMessage} />)

  // Return a function that can be used with React.lazy or dynamic imports
  return {
    importFn,
    ssr,
    loading: LoadingComponent,
    displayName,
    // Helper to wrap with error boundaries
    withErrorBoundary: (Component: ComponentType<T>) => 
      withClientSafe(Component, { loadingMessage, errorMessage, displayName })
  }
}

// Export default wrapper
export default ClientSafeWrapper