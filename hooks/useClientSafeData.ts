//--src/hooks/useClientSafeData.ts
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

interface ClientSafeDataOptions<T> {
  initialData?: T
  autoRefresh?: boolean
  refreshInterval?: number
  retryAttempts?: number
  retryDelay?: number
  onSuccess?: (data: T) => void
  onError?: (error: string) => void
  onLoadingChange?: (isLoading: boolean) => void
}

interface ClientSafeDataState<T> {
  data: T | null
  isLoading: boolean
  error: string | null
  lastFetched: Date | null
  retryCount: number
}

/**
 * Generic hook for client-safe data fetching with comprehensive error handling
 */
export function useClientSafeData<T>(
  fetchFn: () => Promise<T>,
  dependencies: any[],
  options: ClientSafeDataOptions<T> = {}
) {
  const {
    initialData = null,
    autoRefresh = false,
    refreshInterval = 5 * 60 * 1000, // 5 minutes
    retryAttempts = 3,
    retryDelay = 1000,
    onSuccess,
    onError,
    onLoadingChange
  } = options

  const [state, setState] = useState<ClientSafeDataState<T>>({
    data: initialData,
    isLoading: false,
    error: null,
    lastFetched: null,
    retryCount: 0
  })

  const mountedRef = useRef(true)
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
      }
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
      }
    }
  }, [])

  const executeFetch = useCallback(async (isRetry: boolean = false): Promise<void> => {
    if (!mountedRef.current) return

    setState(prev => ({ 
      ...prev, 
      isLoading: true, 
      error: isRetry ? prev.error : null 
    }))

    if (onLoadingChange) {
      onLoadingChange(true)
    }

    try {
      const result = await fetchFn()
      
      if (!mountedRef.current) return

      setState(prev => ({
        ...prev,
        data: result,
        isLoading: false,
        error: null,
        lastFetched: new Date(),
        retryCount: 0
      }))

      if (onLoadingChange) {
        onLoadingChange(false)
      }

      if (onSuccess) {
        onSuccess(result)
      }

    } catch (error) {
      if (!mountedRef.current) return

      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'

      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
        retryCount: isRetry ? prev.retryCount + 1 : 1
      }))

      if (onLoadingChange) {
        onLoadingChange(false)
      }

      if (onError) {
        onError(errorMessage)
      }

      // Auto-retry logic
      if (state.retryCount < retryAttempts && mountedRef.current) {
        const delay = retryDelay * Math.pow(2, state.retryCount) // Exponential backoff
        
        console.log(`⏳ Retrying in ${delay}ms (attempt ${state.retryCount + 1}/${retryAttempts})`)
        
        retryTimeoutRef.current = setTimeout(() => {
          if (mountedRef.current) {
            executeFetch(true)
          }
        }, delay)
      }
    }
  }, [fetchFn, state.retryCount, retryAttempts, retryDelay, onSuccess, onError, onLoadingChange])

  const refetch = useCallback(() => {
    setState(prev => ({ ...prev, retryCount: 0 }))
    executeFetch(false)
  }, [executeFetch])

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null, retryCount: 0 }))
  }, [])

  const clearData = useCallback(() => {
    setState(prev => ({ 
      ...prev, 
      data: initialData, 
      error: null, 
      lastFetched: null, 
      retryCount: 0 
    }))
  }, [initialData])

  // Auto-fetch when dependencies change
  useEffect(() => {
    executeFetch(false)
  }, dependencies) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh functionality
  useEffect(() => {
    if (!autoRefresh || !refreshInterval) return

    refreshIntervalRef.current = setInterval(() => {
      if (mountedRef.current && !state.isLoading) {
        executeFetch(false)
      }
    }, refreshInterval)

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
      }
    }
  }, [autoRefresh, refreshInterval, state.isLoading, executeFetch])

  return {
    ...state,
    refetch,
    clearError,
    clearData,
    canRetry: state.retryCount < retryAttempts,
    isRetrying: state.retryCount > 0 && state.isLoading
  }
}

/**
 * Hook specifically for API data fetching with built-in fetch wrapper
 */
export function useApiData<T>(
  url: string,
  options: RequestInit = {},
  hookOptions: ClientSafeDataOptions<T> = {}
) {
  const fetchData = useCallback(async (): Promise<T> => {
    console.log('🔍 API request:', url)

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    })

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`)
    }

    const result = await response.json()

    if (!result.success) {
      throw new Error(result.error || 'API request failed')
    }

    console.log('✅ API response received:', url)
    return result.data
  }, [url, options])

  return useClientSafeData(
    fetchData,
    [url, JSON.stringify(options)],
    hookOptions
  )
}

/**
 * Hook for POST API requests with body data
 */
export function useApiMutation<TBody, TResponse>(
  url: string,
  options: ClientSafeDataOptions<TResponse> = {}
) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<TResponse | null>(null)

  const mutate = useCallback(async (body: TBody): Promise<TResponse> => {
    setIsLoading(true)
    setError(null)

    try {
      console.log('🔍 API mutation:', url)

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      })

      if (!response.ok) {
        throw new Error(`API mutation failed: ${response.status} ${response.statusText}`)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'API mutation failed')
      }

      const responseData = result.data
      setData(responseData)

      console.log('✅ API mutation successful:', url)

      if (options.onSuccess) {
        options.onSuccess(responseData)
      }

      return responseData

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Mutation failed'
      setError(errorMessage)

      console.error('❌ API mutation failed:', url, err)

      if (options.onError) {
        options.onError(errorMessage)
      }

      throw err
    } finally {
      setIsLoading(false)
    }
  }, [url, options])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const clearData = useCallback(() => {
    setData(null)
  }, [])

  return {
    mutate,
    data,
    isLoading,
    error,
    clearError,
    clearData
  }
}

/**
 * Hook for batch API operations
 */
export function useBatchApi<TItem, TResponse>(
  processFn: (item: TItem) => Promise<TResponse>,
  options: {
    batchSize?: number
    delayBetweenBatches?: number
    onProgress?: (completed: number, total: number) => void
    onBatchComplete?: (batchResults: TResponse[]) => void
  } = {}
) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [results, setResults] = useState<TResponse[]>([])
  const [errors, setErrors] = useState<Array<{ item: TItem; error: string }>>([])
  const [progress, setProgress] = useState({ completed: 0, total: 0 })

  const {
    batchSize = 5,
    delayBetweenBatches = 1000,
    onProgress,
    onBatchComplete
  } = options

  const processBatch = useCallback(async (items: TItem[]): Promise<void> => {
    if (items.length === 0) return

    setIsProcessing(true)
    setResults([])
    setErrors([])
    setProgress({ completed: 0, total: items.length })

    const batches: TItem[][] = []
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize))
    }

    let completedCount = 0
    const allResults: TResponse[] = []
    const allErrors: Array<{ item: TItem; error: string }> = []

    for (const batch of batches) {
      try {
        const batchPromises = batch.map(async (item) => {
          try {
            return await processFn(item)
          } catch (error) {
            allErrors.push({
              item,
              error: error instanceof Error ? error.message : 'Processing failed'
            })
            throw error
          }
        })

        const batchResults = await Promise.allSettled(batchPromises)
        
        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            allResults.push(result.value)
          }
          completedCount++
        })

        setResults([...allResults])
        setErrors([...allErrors])
        setProgress({ completed: completedCount, total: items.length })

        if (onProgress) {
          onProgress(completedCount, items.length)
        }

        if (onBatchComplete) {
          const successResults = batchResults
            .filter(r => r.status === 'fulfilled')
            .map(r => (r as PromiseFulfilledResult<TResponse>).value)
          
          onBatchComplete(successResults)
        }

        // Delay between batches to avoid rate limiting
        if (batch !== batches[batches.length - 1] && delayBetweenBatches > 0) {
          await new Promise(resolve => setTimeout(resolve, delayBetweenBatches))
        }

      } catch (error) {
        console.error('❌ Batch processing error:', error)
      }
    }

    setIsProcessing(false)
    console.log('✅ Batch processing complete:', {
      total: items.length,
      successful: allResults.length,
      errors: allErrors.length
    })

  }, [processFn, batchSize, delayBetweenBatches, onProgress, onBatchComplete])

  const reset = useCallback(() => {
    setResults([])
    setErrors([])
    setProgress({ completed: 0, total: 0 })
  }, [])

  return {
    processBatch,
    isProcessing,
    results,
    errors,
    progress,
    reset,
    hasErrors: errors.length > 0,
    successRate: progress.total > 0 ? (results.length / progress.total) * 100 : 0
  }
}