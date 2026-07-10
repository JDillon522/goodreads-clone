import { BookMetadataResponseDto } from '../../books/dto/book-metadata-response.dto';

/**
 * Saved-library book metadata uses the shared raw-provider response contract.
 */
export class LibraryBookResponseDto extends BookMetadataResponseDto {}
