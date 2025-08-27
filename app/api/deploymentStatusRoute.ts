//--src/app/api/deployment-status/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { deploymentReadinessService } from '@/lib/services/deploymentReadiness'
// Database backup service will be loaded dynamically to avoid startup issues

/**
 * Deployment Status API
 * 
 * GET /api/deployment-status - Get comprehensive deployment readiness report
 * GET /api/deployment-status?quick=true - Get quick health check
 * POST /api/deployment-status/backup - Trigger manual backup
 */

// GET - Deployment status check
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url)
    const isQuickCheck = searchParams.get('quick') === 'true'

    if (isQuickCheck) {
      // Quick health check
      const healthCheck = await deploymentReadinessService.quickHealthCheck()
      
      return NextResponse.json({
        success: true,
        data: {
          type: 'quick_check',
          ...healthCheck
        }
      })
    }

    // Full deployment readiness check
    console.log('🔍 Running full deployment readiness check...')
    
    // Load backup service dynamically to avoid startup issues
    const { databaseBackupService } = await import('@/lib/services/databaseBackup')
    
    const [
      readinessReport,
      backupStats
    ] = await Promise.all([
      deploymentReadinessService.runFullCheck(),
      databaseBackupService.getBackupStats()
    ])

    // Enhanced report with backup information
    const enhancedReport = {
      ...readinessReport,
      backupSystem: {
        status: backupStats.totalBackups > 0 ? 'operational' : 'not_configured',
        totalBackups: backupStats.totalBackups,
        totalSizeMB: backupStats.totalSizeMB,
        retentionDays: backupStats.retentionPolicy,
        oldestBackup: backupStats.oldestBackup,
        newestBackup: backupStats.newestBackup
      },
      soapboxReadiness: {
        canDeploySoapBoxes: readinessReport.overallStatus !== 'not_ready',
        canProcessPayments: readinessReport.checks.find(c => c.name === 'SoapBox Splits Factory')?.status === 'passed',
        canPersistData: readinessReport.checks.find(c => c.name === 'Database Connectivity')?.status === 'passed',
        hasBackups: backupStats.totalBackups > 0,
        contractsOnBase: readinessReport.checks.find(c => c.name === 'SoapBox Splits Factory')?.status === 'passed'
      }
    }

    console.log('✅ Deployment readiness check completed:', {
      status: readinessReport.overallStatus,
      soapboxReady: enhancedReport.soapboxReadiness.canDeploySoapBoxes,
      contractsReady: enhancedReport.soapboxReadiness.contractsOnBase,
      backupsOperational: enhancedReport.soapboxReadiness.hasBackups
    })

    return NextResponse.json({
      success: true,
      data: enhancedReport
    })

  } catch (error) {
    console.error('❌ Deployment status check failed:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Deployment check failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// POST - Manual backup trigger
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json()
    const { action } = body

    if (action === 'backup') {
      console.log('🔄 Manual backup triggered via API...')
      
      // Load backup service dynamically
      const { databaseBackupService } = await import('@/lib/services/databaseBackup')
      const backupMetadata = await databaseBackupService.createNightlyBackup()
      
      return NextResponse.json({
        success: true,
        data: {
          action: 'backup_completed',
          backup: backupMetadata
        },
        message: 'Manual backup completed successfully'
      })
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid action',
      message: 'Supported actions: backup'
    }, { status: 400 })

  } catch (error) {
    console.error('❌ Manual backup failed:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Backup failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}