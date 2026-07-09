import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, MaxLength } from 'class-validator';

/**
 * Overview: Defines the Password Reset Request DTO contract so validation and Swagger metadata stay readable around annotation-heavy fields.
 */
export class PasswordResetRequestDto {
  @ApiProperty({ example: 'reader@example.com' })
  @IsEmail()
  @MaxLength(254)
  email!: string;
}
