import { ApiProperty } from '@nestjs/swagger';

export class SignoutResponseDto {
  @ApiProperty({ example: true })
  signedOut!: boolean;
}
