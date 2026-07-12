import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Selects the authoritative Google Books volume that should replace a saved edition. */
export class ReplaceLibraryItemEditionRequestDto {
  @ApiProperty({ example: 'zyTCAlFPjgYC' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(120)
  googleBooksVolumeId!: string;
}
