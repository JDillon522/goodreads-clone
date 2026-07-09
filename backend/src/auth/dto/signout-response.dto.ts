import { ApiProperty } from '@nestjs/swagger';

/**
 * Overview: Defines the Signout Response DTO contract so validation and Swagger metadata stay readable around annotation-heavy fields.
 */
export class SignoutResponseDto {
  @ApiProperty({ example: true })
  signedOut!: boolean;
}
