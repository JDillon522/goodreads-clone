import { ApiProperty } from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty({ description: 'Liveness status for the backend process.', example: 'ok' })
  public readonly status!: 'ok';

  @ApiProperty({ description: 'Backend service identifier.', example: 'bookshelf-backend' })
  public readonly service!: string;

  @ApiProperty({
    description: 'Server timestamp when the response was produced.',
    example: '2026-06-29T17:00:00.000Z',
  })
  public readonly timestamp!: string;

  @ApiProperty({ description: 'Current process uptime in seconds.', example: 12 })
  public readonly uptimeSeconds!: number;

  @ApiProperty({ description: 'Backend package version.', example: '0.1.0' })
  public readonly version!: string;
}
