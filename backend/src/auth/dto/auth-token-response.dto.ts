import { ApiProperty } from '@nestjs/swagger';

import { AuthUserResponseDto } from './auth-user-response.dto';

export class AuthTokenResponseDto {
  @ApiProperty({
    description: 'Short-lived JWT access token for Authorization: Bearer requests.',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken!: string;

  @ApiProperty({ example: 900 })
  expiresInSeconds!: number;

  @ApiProperty({
    description: 'Opaque refresh token. Store it securely; the database stores only its hash.',
    example: 'c5x5sHnLJlLTt9xgI3oz9Grw3qt5w1P6Lws_V-oN1xY',
  })
  refreshToken!: string;

  @ApiProperty({ example: 'Bearer' })
  tokenType!: 'Bearer';

  @ApiProperty({ type: AuthUserResponseDto })
  user!: AuthUserResponseDto;
}
