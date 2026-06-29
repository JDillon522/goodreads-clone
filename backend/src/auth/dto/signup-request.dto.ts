import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SignupRequestDto {
  @ApiProperty({ example: 'reader@example.com' })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiPropertyOptional({ example: 'Ada Reader', maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  displayName?: string;

  @ApiProperty({
    example: 'correct-horse-battery-staple',
    minLength: 8,
    maxLength: 128,
  })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
