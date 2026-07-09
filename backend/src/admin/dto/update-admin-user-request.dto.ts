import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

/**
 * Overview: Defines the Update Admin User Request DTO contract so validation and Swagger metadata stay readable around annotation-heavy fields.
 */
export class UpdateAdminUserRequestDto {
  @ApiPropertyOptional({ example: 'reader@example.com' })
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @ApiPropertyOptional({ example: 'reader42', maxLength: 40, nullable: true, type: String })
  @ValidateIf((_object, value) => value !== null && value !== undefined)
  @IsString()
  @Matches(/^[a-z0-9._-]+$/i)
  @MaxLength(40)
  username?: null | string;

  @ApiPropertyOptional({ example: 'Ada Reader', maxLength: 80, nullable: true, type: String })
  @ValidateIf((_object, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(80)
  displayName?: null | string;

  @ApiPropertyOptional({ example: 'correct-horse-battery-staple', maxLength: 128, minLength: 8 })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password?: string;

  @ApiPropertyOptional({ enum: UserRole, example: UserRole.USER })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
