import { ApiProperty } from '@nestjs/swagger';

export class GuestSessionResponseDto {
  @ApiProperty({ example: '2026-07-07T12:00:00.000Z', format: 'date-time' })
  expiresAt!: string;

  @ApiProperty({ example: 'a3b2c1.guest-token-value' })
  guestToken!: string;

  @ApiProperty({ example: '5e6121b5-bf5d-48cc-a0de-7b47fb04f7f5', format: 'uuid' })
  sessionId!: string;

  @ApiProperty({ example: 'Bearer' })
  tokenType!: 'Bearer';
}
