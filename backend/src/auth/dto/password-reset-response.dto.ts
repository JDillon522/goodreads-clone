import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Overview: Defines the Password Reset Response DTO contract so validation and Swagger metadata stay readable around annotation-heavy fields.
 */
export class PasswordResetResponseDto {
  @ApiProperty({
    example: 'If an account exists for that email, a password reset token has been created.',
  })
  message!: string;

  @ApiPropertyOptional({
    description: 'Returned only outside production so the reset flow can be tested in Swagger.',
    example: 'ZgZbBSKrgq2OaF6FGfOITRn1noBOU8G_3K7LF1cQo4A',
  })
  resetToken?: string;
}
