import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * Overview: Defines the Create Admin User Request DTO contract so validation and Swagger metadata stay readable around annotation-heavy fields.
 */
export class CreateAdminUserRequestDto {
  @ApiProperty({ example: 'reader@example.com' })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiPropertyOptional({ example: 'reader42', maxLength: 40 })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9._-]+$/i)
  @MaxLength(40)
  username?: string;

  @ApiPropertyOptional({ example: 'Ada Reader', maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  displayName?: string;

  @ApiProperty({ example: 'correct-horse-battery-staple', maxLength: 128, minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @ApiPropertyOptional({ enum: UserRole, example: UserRole.USER })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
