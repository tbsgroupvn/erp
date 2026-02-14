/**
 * Health Check Controller
 *
 * Provides endpoints for monitoring system health:
 * - /health - Basic health check
 * - /health/detailed - Detailed system status
 * - /health/ready - Readiness probe (K8s)
 * - /health/live - Liveness probe (K8s)
 */

import { Controller, Get, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrismaService } from '@core/database/prisma.service';

interface HealthStatus {
  status: 'ok' | 'error' | 'degraded';
  timestamp: string;
  uptime: number;
  database?: {
    status: 'connected' | 'disconnected';
    responseTime?: number;
  };
  memory?: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  cpu?: {
    user: number;
    system: number;
  };
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Basic health check
   * Returns 200 OK if service is running
   */
  @Get()
  @ApiOperation({ summary: 'Basic health check' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Detailed health check
   * Returns detailed information about system status
   */
  @Get('detailed')
  @ApiOperation({ summary: 'Detailed health check' })
  @ApiResponse({ status: 200, description: 'Detailed system status' })
  async detailedHealthCheck(): Promise<HealthStatus> {
    const startTime = Date.now();

    // Check database connection
    let dbStatus: 'connected' | 'disconnected' = 'disconnected';
    let dbResponseTime: number | undefined;

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbStatus = 'connected';
      dbResponseTime = Date.now() - startTime;
    } catch (error) {
      this.logger.error('Database health check failed:', error);
    }

    // Get memory usage
    const memoryUsage = process.memoryUsage();

    // Get CPU usage
    const cpuUsage = process.cpuUsage();

    // Determine overall status
    let overallStatus: 'ok' | 'error' | 'degraded' = 'ok';
    if (dbStatus === 'disconnected') {
      overallStatus = 'error';
    } else if (dbResponseTime && dbResponseTime > 1000) {
      // DB response > 1s is degraded
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: {
        status: dbStatus,
        responseTime: dbResponseTime,
      },
      memory: {
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
        external: Math.round(memoryUsage.external / 1024 / 1024), // MB
        rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
      },
      cpu: {
        user: Math.round(cpuUsage.user / 1000), // ms
        system: Math.round(cpuUsage.system / 1000), // ms
      },
    };
  }

  /**
   * Readiness probe
   * Returns 200 when service is ready to accept traffic
   * Used by Kubernetes/load balancers
   */
  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe' })
  @ApiResponse({ status: 200, description: 'Service is ready' })
  @ApiResponse({ status: 503, description: 'Service is not ready' })
  async readinessCheck(): Promise<{ ready: boolean }> {
    try {
      // Check if database is accessible
      await this.prisma.$queryRaw`SELECT 1`;

      // Check if critical services are initialized
      // Add more checks as needed

      return { ready: true };
    } catch (error) {
      this.logger.error('Readiness check failed:', error);
      throw new ServiceUnavailableException('Service not ready');
    }
  }

  /**
   * Liveness probe
   * Returns 200 when service is alive
   * Used by Kubernetes to restart unhealthy pods
   */
  @Get('live')
  @ApiOperation({ summary: 'Liveness probe' })
  @ApiResponse({ status: 200, description: 'Service is alive' })
  async livenessCheck(): Promise<{ alive: boolean }> {
    // Simple check - if this returns, process is alive
    return { alive: true };
  }
}
