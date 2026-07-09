import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Overview: Defines the Password Reset Confirm Request DTO contract so validation and Swagger metadata stay readable around annotation-heavy fields.
 */
export class PasswordResetConfirmRequestDto {
  @ApiProperty({
    description: 'Opaque password reset token from the reset request response in development.',
    example: 'ZgZbBSKrgq2OaF6FGfOITRn1noBOU8G_3K7LF1cQo4A',
  })
  @IsString()
  @MinLength(32)
  token!: string;

  @ApiProperty({
    example: 'correct-horse-battery-staple',
    minLength: 8,
    maxLength: 128,
  })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}
