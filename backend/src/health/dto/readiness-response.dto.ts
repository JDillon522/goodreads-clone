import { ApiProperty } from '@nestjs/swagger';

/**
 * Overview: Defines the Readiness Response DTO contract so validation and Swagger metadata stay readable around annotation-heavy fields.
 */
class ReadinessChecksDto {
  @ApiProperty({ description: 'Database connectivity check result.', example: 'available' })
  public readonly database!: 'available';
}

class ReadinessUnavailableChecksDto {
  @ApiProperty({ description: 'Database connectivity check result.', example: 'unavailable' })
  public readonly database!: 'unavailable';
}

class ReadinessUnavailableMessageDto {
  @ApiProperty({ example: 'error' })
  public readonly status!: 'error';

  @ApiProperty({ example: 'bookshelf-backend' })
  public readonly service!: string;

  @ApiProperty({ example: '2026-06-29T17:00:00.000Z' })
  public readonly timestamp!: string;

  @ApiProperty({ type: ReadinessUnavailableChecksDto })
  public readonly checks!: ReadinessUnavailableChecksDto;
}

export class ReadinessResponseDto {
  @ApiProperty({
    description: 'Readiness status for the backend and dependencies.',
    example: 'ready',
  })
  public readonly status!: 'ready';

  @ApiProperty({ description: 'Backend service identifier.', example: 'bookshelf-backend' })
  public readonly service!: string;

  @ApiProperty({
    description: 'Server timestamp when the response was produced.',
    example: '2026-06-29T17:00:00.000Z',
  })
  public readonly timestamp!: string;

  @ApiProperty({ type: ReadinessChecksDto })
  public readonly checks!: ReadinessChecksDto;
}

export class ReadinessUnavailableResponseDto {
  @ApiProperty({ example: 503 })
  public readonly statusCode!: 503;

  @ApiProperty({ type: ReadinessUnavailableMessageDto })
  public readonly message!: ReadinessUnavailableMessageDto;

  @ApiProperty({ example: 'Service Unavailable' })
  public readonly error!: 'Service Unavailable';
}
