//--src/lib/performance/intervalManager.ts
'use client'

export interface PerformanceTask {
  id: string
  fn: () => void | Promise<void>
  interval: number
  priority: 'high' | 'medium' | 'low'
  lastRun: number
  isRunning: boolean
}

interface TaskMetrics {
  executionTime: number
  errorCount: number
  successCount: number
  averageExecutionTime: number
  lastError?: Error
}

interface IntervalManagerConfig {
  maxConcurrentTasks: number
  batchSize: number
  throttleThreshold: number
  debugMode: boolean
  performanceMonitoring: boolean
}

class IntervalManager {
  private tasks: Map<string, PerformanceTask> = new Map()
  private metrics: Map<string, TaskMetrics> = new Map()
  private masterInterval: NodeJS.Timeout | null = null
  private isRunning: boolean = false
  private config: IntervalManagerConfig
  private taskQueue: string[] = []
  private executionBatch: Set<string> = new Set()

  constructor(config: Partial<IntervalManagerConfig> = {}) {
    this.config = {
      maxConcurrentTasks: 5,
      batchSize: 3,
      throttleThreshold: 10, // ms
      debugMode: process.env.NODE_ENV === 'development',
      performanceMonitoring: true,
      ...config
    }

    // Bind methods to preserve context
    this.tick = this.tick.bind(this)
    this.cleanup = this.cleanup.bind(this)

    // Setup cleanup on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', this.cleanup)
      window.addEventListener('pagehide', this.cleanup)
    }
  }

  /**
   * Register a new task with the interval manager
   */
  public registerTask(task: Omit<PerformanceTask, 'lastRun' | 'isRunning'>): void {
    const fullTask: PerformanceTask = {
      ...task,
      lastRun: 0,
      isRunning: false
    }

    this.tasks.set(task.id, fullTask)
    this.metrics.set(task.id, {
      executionTime: 0,
      errorCount: 0,
      successCount: 0,
      averageExecutionTime: 0
    })

    if (this.config.debugMode) {
      console.log(`📋 Registered task: ${task.id} (${task.priority} priority, ${task.interval}ms interval)`)
    }

    this.start()
  }

  /**
   * Unregister a task from the interval manager
   */
  public unregisterTask(taskId: string): void {
    const task = this.tasks.get(taskId)
    if (task) {
      this.tasks.delete(taskId)
      this.metrics.delete(taskId)
      this.taskQueue = this.taskQueue.filter(id => id !== taskId)
      this.executionBatch.delete(taskId)

      if (this.config.debugMode) {
        console.log(`🗑️ Unregistered task: ${taskId}`)
      }

      // Stop master interval if no tasks remain
      if (this.tasks.size === 0) {
        this.stop()
      }
    }
  }

  /**
   * Update task configuration
   */
  public updateTask(taskId: string, updates: Partial<Pick<PerformanceTask, 'interval' | 'priority' | 'fn'>>): void {
    const task = this.tasks.get(taskId)
    if (task) {
      Object.assign(task, updates)
      
      if (this.config.debugMode) {
        console.log(`🔄 Updated task: ${taskId}`, updates)
      }
    }
  }

  /**
   * Get task metrics for performance monitoring
   */
  public getTaskMetrics(taskId: string): TaskMetrics | null {
    return this.metrics.get(taskId) || null
  }

  /**
   * Get all task metrics
   */
  public getAllMetrics(): Record<string, TaskMetrics> {
    const result: Record<string, TaskMetrics> = {}
    this.metrics.forEach((metrics, taskId) => {
      result[taskId] = { ...metrics }
    })
    return result
  }

  /**
   * Get performance summary
   */
  public getPerformanceSummary(): {
    totalTasks: number
    activeTasks: number
    averageExecutionTime: number
    totalErrors: number
    memoryUsage?: number
  } {
    const activeTasks = Array.from(this.tasks.values()).filter(task => task.isRunning).length
    const allMetrics = Array.from(this.metrics.values())
    
    const averageExecutionTime = allMetrics.length > 0
      ? allMetrics.reduce((sum, m) => sum + m.averageExecutionTime, 0) / allMetrics.length
      : 0

    const totalErrors = allMetrics.reduce((sum, m) => sum + m.errorCount, 0)

    const summary: {
      totalTasks: number
      activeTasks: number
      averageExecutionTime: number
      totalErrors: number
      memoryUsage?: number
    } = {
      totalTasks: this.tasks.size,
      activeTasks,
      averageExecutionTime,
      totalErrors
    }

    // Add memory usage if available
    if (typeof performance !== 'undefined' && 'memory' in performance) {
      const memory = (performance as any).memory
      summary.memoryUsage = memory.usedJSHeapSize
    }

    return summary
  }

  /**
   * Start the master interval
   */
  private start(): void {
    if (this.isRunning) return

    this.isRunning = true
    
    // PERFORMANCE FIX: Disable heavy 10ms master interval to prevent setTimeout violations
    console.log('⚡ IntervalManager: Heavy performance monitoring disabled for better app performance')
    // this.masterInterval = setInterval(this.tick, this.config.throttleThreshold)

    if (this.config.debugMode) {
      console.log(`🚀 IntervalManager started with ${this.tasks.size} tasks`)
    }
  }

  /**
   * Stop the master interval
   */
  private stop(): void {
    if (!this.isRunning) return

    this.isRunning = false

    if (this.masterInterval) {
      clearInterval(this.masterInterval)
      this.masterInterval = null
    }

    if (this.config.debugMode) {
      console.log('⏹️ IntervalManager stopped')
    }
  }

  /**
   * Main tick function - optimized for performance
   */
  private async tick(): Promise<void> {
    if (this.tasks.size === 0) return

    const now = Date.now()
    const readyTasks: string[] = []

    // Batch check which tasks are ready to run
    for (const [taskId, task] of this.tasks) {
      if (!task.isRunning && (now - task.lastRun) >= task.interval) {
        readyTasks.push(taskId)
      }
    }

    if (readyTasks.length === 0) return

    // Sort by priority and limit concurrent execution
    const priorityOrder = { high: 0, medium: 1, low: 2 }
    const sortedTasks = readyTasks
      .map(id => ({ id, priority: this.tasks.get(id)!.priority }))
      .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
      .slice(0, this.config.maxConcurrentTasks)

    // Execute tasks in batches to prevent blocking
    const batches = this.chunkArray(sortedTasks, this.config.batchSize)
    
    for (const batch of batches) {
      await Promise.all(batch.map(({ id }) => this.executeTask(id)))
      
      // Small delay between batches to prevent blocking
      if (batches.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 1))
      }
    }
  }

  /**
   * Execute a single task with performance monitoring
   */
  private async executeTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId)
    const metrics = this.metrics.get(taskId)
    
    if (!task || !metrics || task.isRunning) return

    task.isRunning = true
    task.lastRun = Date.now()

    const startTime = performance.now()

    try {
      await task.fn()
      
      const executionTime = performance.now() - startTime
      
      // Update metrics
      metrics.successCount++
      metrics.executionTime = executionTime
      metrics.averageExecutionTime = (
        (metrics.averageExecutionTime * (metrics.successCount - 1) + executionTime) / 
        metrics.successCount
      )

      if (this.config.debugMode && executionTime > 5) {
        console.log(`⚡ Task ${taskId} executed in ${executionTime.toFixed(2)}ms`)
      }

    } catch (error) {
      const executionTime = performance.now() - startTime
      
      metrics.errorCount++
      metrics.lastError = error instanceof Error ? error : new Error(String(error))
      
      if (this.config.debugMode) {
        console.error(`❌ Task ${taskId} failed after ${executionTime.toFixed(2)}ms:`, error)
      }

      // Don't throw - let other tasks continue
    } finally {
      task.isRunning = false
    }
  }

  /**
   * Utility function to chunk arrays for batch processing
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size))
    }
    return chunks
  }

  /**
   * Cleanup resources and stop all tasks
   */
  public cleanup(): void {
    this.stop()
    this.tasks.clear()
    this.metrics.clear()
    this.taskQueue = []
    this.executionBatch.clear()

    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', this.cleanup)
      window.removeEventListener('pagehide', this.cleanup)
    }

    if (this.config.debugMode) {
      console.log('🧹 IntervalManager cleaned up')
    }
  }

  /**
   * Pause all tasks
   */
  public pause(): void {
    this.stop()
    if (this.config.debugMode) {
      console.log('⏸️ IntervalManager paused')
    }
  }

  /**
   * Resume all tasks
   */
  public resume(): void {
    if (this.tasks.size > 0) {
      this.start()
      if (this.config.debugMode) {
        console.log('▶️ IntervalManager resumed')
      }
    }
  }

  /**
   * Force immediate execution of a task
   */
  public async executeTaskNow(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId)
    if (task && !task.isRunning) {
      await this.executeTask(taskId)
    }
  }

  /**
   * Get current status
   */
  public getStatus(): {
    isRunning: boolean
    taskCount: number
    queueLength: number
    config: IntervalManagerConfig
  } {
    return {
      isRunning: this.isRunning,
      taskCount: this.tasks.size,
      queueLength: this.taskQueue.length,
      config: { ...this.config }
    }
  }
}

// Global singleton instance
let globalIntervalManager: IntervalManager | null = null

/**
 * Get the global interval manager instance
 */
export function getIntervalManager(): IntervalManager {
  if (!globalIntervalManager) {
    globalIntervalManager = new IntervalManager()
  }
  return globalIntervalManager
}

/**
 * Register a task with the global interval manager
 */
export function registerGlobalTask(task: Omit<PerformanceTask, 'lastRun' | 'isRunning'>): void {
  getIntervalManager().registerTask(task)
}

/**
 * Unregister a task from the global interval manager
 */
export function unregisterGlobalTask(taskId: string): void {
  getIntervalManager().unregisterTask(taskId)
}

/**
 * Cleanup the global interval manager
 */
export function cleanupGlobalIntervalManager(): void {
  if (globalIntervalManager) {
    globalIntervalManager.cleanup()
    globalIntervalManager = null
  }
}

// Performance monitoring utilities
export function createPerformanceTask(
  id: string,
  fn: () => void | Promise<void>,
  interval: number,
  priority: 'high' | 'medium' | 'low' = 'medium'
): Omit<PerformanceTask, 'lastRun' | 'isRunning'> {
  return { id, fn, interval, priority }
}

// Hook for React components
export function useIntervalManager() {
  const manager = getIntervalManager()

  const registerTask = (task: Omit<PerformanceTask, 'lastRun' | 'isRunning'>) => {
    manager.registerTask(task)
  }

  const unregisterTask = (taskId: string) => {
    manager.unregisterTask(taskId)
  }

  return {
    registerTask,
    unregisterTask,
    getMetrics: manager.getTaskMetrics.bind(manager),
    getPerformanceSummary: manager.getPerformanceSummary.bind(manager),
    executeTaskNow: manager.executeTaskNow.bind(manager)
  }
}

export default IntervalManager