import { ApiProperty } from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty({ example: 'ok' })
  public readonly status!: 'ok';

  @ApiProperty({ example: 'bookshelf-backend' })
  public readonly service!: string;

  @ApiProperty({ example: '2026-06-29T17:00:00.000Z' })
  public readonly timestamp!: string;

  @ApiProperty({ example: 12 })
  public readonly uptimeSeconds!: number;

  @ApiProperty({ example: '0.1.0' })
  public readonly version!: string;
}
