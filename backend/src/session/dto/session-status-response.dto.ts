import { ApiProperty } from '@nestjs/swagger';

/**
 * Overview: Defines the Session Status Response DTO contract so validation and Swagger metadata stay readable around annotation-heavy fields.
 */
export class SessionStatusResponseDto {
  @ApiProperty({ example: true })
  authenticated!: true;

  @ApiProperty({ enum: ['GUEST', 'USER'], example: 'USER' })
  ownerType!: 'GUEST' | 'USER';
}
