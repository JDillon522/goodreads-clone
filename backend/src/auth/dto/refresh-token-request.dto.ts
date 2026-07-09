import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

/**
 * Overview: Defines the Refresh Token Request DTO contract so validation and Swagger metadata stay readable around annotation-heavy fields.
 */
export class RefreshTokenRequestDto {
  @ApiProperty({
    description: 'Opaque refresh token returned by signup, signin, or refresh.',
    example: 'c5x5sHnLJlLTt9xgI3oz9Grw3qt5w1P6Lws_V-oN1xY',
  })
  @IsString()
  @MinLength(32)
  refreshToken!: string;
}
