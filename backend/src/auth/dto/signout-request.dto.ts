import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class SignoutRequestDto {
  @ApiProperty({
    description: 'Opaque refresh token to revoke.',
    example: 'c5x5sHnLJlLTt9xgI3oz9Grw3qt5w1P6Lws_V-oN1xY',
  })
  @IsString()
  @MinLength(32)
  refreshToken!: string;
}
