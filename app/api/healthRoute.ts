//--src/app/api/health/route.ts
import { NextRequest, NextResponse } from 'next/server';

interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  services: {
    database: 'connected' | 'disconnected' | 'unknown';
    redis: 'connected' | 'disconnected' | 'unknown';
  };
  environment: string;
}

interface ServiceStatus {
  status: 'connected' | 'disconnected' | 'unknown';
  latency?: number;
  error?: string;
}

export async function GET(request: NextRequest): Promise<NextResponse<HealthCheckResponse>> {
  const startTime = Date.now();
  
  try {
    // Basic application health
    const uptime = process.uptime();
    const timestamp = new Date().toISOString();
    const version = process.env.npm_package_version || '1.0.0';
    const environment = process.env.NODE_ENV || 'development';

    // Check Redis connection (optional)
    const redisStatus = await checkRedisHealth();
    
    // Check database connection (placeholder)
    const databaseStatus = await checkDatabaseHealth();

    const healthData: HealthCheckResponse = {
      status: 'healthy',
      timestamp,
      uptime,
      version,
      services: {
        database: databaseStatus.status,
        redis: redisStatus.status,
      },
      environment,
    };

    // Determine overall health status
    if (databaseStatus.status === 'disconnected' || redisStatus.status === 'disconnected') {
      healthData.status = 'unhealthy';
    }

    const statusCode = healthData.status === 'healthy' ? 200 : 503;
    
    return NextResponse.json(healthData, { 
      status: statusCode,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });

  } catch (error) {
    console.error('Health check failed:', error);
    
    const errorResponse: HealthCheckResponse = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      services: {
        database: 'unknown',
        redis: 'unknown',
      },
      environment: process.env.NODE_ENV || 'development',
    };

    return NextResponse.json(errorResponse, { 
      status: 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  }
}

async function checkRedisHealth(): Promise<ServiceStatus> {
  try {
    // Only check Redis if we're on the server and have a Redis URL
    if (typeof window !== 'undefined') {
      return { status: 'unknown' };
    }

    const redisUrl = process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL;
    if (!redisUrl) {
      return { status: 'unknown' };
    }

    // Dynamic import to avoid client-side issues
    const { default: Redis } = await import('ioredis');
    
    const redis = new Redis(redisUrl, {
      connectTimeout: 5000,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });

    const startTime = Date.now();
    await redis.ping();
    const latency = Date.now() - startTime;
    
    await redis.disconnect();
    
    return { 
      status: 'connected',
      latency,
    };

  } catch (error) {
    console.warn('Redis health check failed:', error);
    return { 
      status: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function checkDatabaseHealth(): Promise<ServiceStatus> {
  try {
    const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    
    if (!databaseUrl) {
      return { 
        status: 'unknown',
        error: 'No database URL configured'
      };
    }

    // Import Prisma client and attempt connection
    console.log('🔍 Testing database connection...');
    const startTime = Date.now();
    
    try {
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient({
        datasources: {
          db: {
            url: databaseUrl,
          },
        },
      });

      // Test connection with a simple query and 5 second timeout
      const testQuery = prisma.$queryRaw`SELECT 1 as test`;
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Database connection timeout (5s)')), 5000)
      );
      
      await Promise.race([testQuery, timeoutPromise]);
      await prisma.$disconnect();
      
      const latency = Date.now() - startTime;
      console.log('✅ Database connection successful');
      
      return { 
        status: 'connected',
        latency
      };

    } catch (dbError) {
      console.error('❌ Database connection failed:', dbError);
      return { 
        status: 'disconnected',
        error: dbError instanceof Error ? dbError.message : 'Database connection failed'
      };
    }

  } catch (error) {
    console.warn('Database health check setup failed:', error);
    return { 
      status: 'disconnected',
      error: error instanceof Error ? error.message : 'Health check setup failed',
    };
  }
}

export async function HEAD(request: NextRequest): Promise<NextResponse> {
  // Simple HEAD request for basic health check
  try {
    return new NextResponse(null, { 
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    return new NextResponse(null, { status: 503 });
  }
}