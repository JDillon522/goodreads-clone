import { ApiProperty } from '@nestjs/swagger';

export class SessionStatusResponseDto {
  @ApiProperty({ example: true })
  authenticated!: true;

  @ApiProperty({ enum: ['GUEST', 'USER'], example: 'USER' })
  ownerType!: 'GUEST' | 'USER';
}
