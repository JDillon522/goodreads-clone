import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';

import { PrismaService } from '../database/prisma.service';
import { HealthResponseDto } from './dto/health-response.dto';
import {
  ReadinessResponseDto,
  ReadinessUnavailableResponseDto,
} from './dto/readiness-response.dto';

/**
 * Exposes liveness and readiness endpoints for Docker, proxy, and deployment checks.
 */
@ApiTags('System')
@Controller('health')
export class HealthController {
  /**
   * Receives Prisma so readiness can verify database connectivity.
   */
  public constructor(private readonly prismaService: PrismaService) {}
  /**
   * Returns process-level liveness without checking dependencies.
   */
  @Get()
  @ApiOperation({ summary: 'Check backend service health' })
  @ApiOkResponse({ type: HealthResponseDto })
  public getHealth(): HealthResponseDto {
    return {
      status: 'ok',
      service: 'bookshelf-backend',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      version: process.env.npm_package_version ?? '0.1.0',
    };
  }

  /**
   * Verifies the backend can talk to Postgres before reporting ready.
   */
  @Get('ready')
  @ApiOperation({ summary: 'Check backend readiness, including database connectivity' })
  @ApiOkResponse({ type: ReadinessResponseDto })
  @ApiServiceUnavailableResponse({
    description: 'The backend is running but at least one required dependency is unavailable.',
    type: ReadinessUnavailableResponseDto,
  })
  public async getReadiness(): Promise<ReadinessResponseDto> {
    try {
      await this.prismaService.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        service: 'bookshelf-backend',
        timestamp: new Date().toISOString(),
        checks: {
          database: 'unavailable',
        },
      });
    }

    return {
      status: 'ready',
      service: 'bookshelf-backend',
      timestamp: new Date().toISOString(),
      checks: {
        database: 'available',
      },
    };
  }
}
