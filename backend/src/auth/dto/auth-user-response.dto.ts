import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

export class AuthUserResponseDto {
  @ApiProperty({
    example: '5e6121b5-bf5d-48cc-a0de-7b47fb04f7f5',
    format: 'uuid',
  })
  id!: string;

  @ApiProperty({ example: 'reader@example.com' })
  email!: string;

  @ApiPropertyOptional({ example: 'reader42', nullable: true, type: String })
  username!: null | string;

  @ApiPropertyOptional({ example: 'Ada Reader', nullable: true, type: String })
  displayName!: null | string;

  @ApiProperty({ enum: UserRole, example: UserRole.USER })
  role!: UserRole;

  @ApiPropertyOptional({ example: null, format: 'date-time', nullable: true, type: String })
  deactivatedAt!: null | string;

  @ApiProperty({
    example: '2026-06-29T12:00:00.000Z',
    format: 'date-time',
  })
  createdAt!: string;
}
