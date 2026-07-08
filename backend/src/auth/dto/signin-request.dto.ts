import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class SigninRequestDto {
  @ApiProperty({ description: 'Email address or username.', example: 'reader@example.com' })
  @IsString()
  @MinLength(3)
  @MaxLength(254)
  email!: string;

  @ApiProperty({ example: 'correct-horse-battery-staple' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
