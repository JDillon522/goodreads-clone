import type { components, operations, paths } from './bookshelf-api.types';

/**
 * Stable frontend aliases for generated OpenAPI schema types.
 *
 * Components import these names instead of reaching into the generated file so
 * codegen churn stays isolated to this adapter layer.
 */
type Schema<Name extends keyof components['schemas']> = components['schemas'][Name];

export type ApiComponents = components;
export type ApiOperations = operations;
export type ApiPaths = paths;

export type AuthTokenResponse = Schema<'AuthTokenResponseDto'>;
export type AuthUserResponse = Schema<'AuthUserResponseDto'>;
export type PasswordResetConfirmRequest = Schema<'PasswordResetConfirmRequestDto'>;
export type PasswordResetRequest = Schema<'PasswordResetRequestDto'>;
export type PasswordResetResponse = Schema<'PasswordResetResponseDto'>;
export type RefreshTokenRequest = Schema<'RefreshTokenRequestDto'>;
export type SigninRequest = Schema<'SigninRequestDto'>;
export type SignoutRequest = Schema<'SignoutRequestDto'>;
export type SignoutResponse = Schema<'SignoutResponseDto'>;
export type SignupRequest = Schema<'SignupRequestDto'>;

export type AdminUserResponse = Schema<'AdminUserResponseDto'>;
export type CreateAdminUserRequest = Schema<'CreateAdminUserRequestDto'>;
export type UpdateAdminUserRequest = Schema<'UpdateAdminUserRequestDto'>;

export type GuestSessionResponse = Schema<'GuestSessionResponseDto'>;

export type SessionStatusResponse = Schema<'SessionStatusResponseDto'>;

export type ThemePalette = Schema<'ThemePaletteDto'>;
export type ThemePaletteSource = Schema<'ThemePaletteSourceDto'>;
export type ThemePaletteTokenSet = Schema<'ThemePaletteTokenSetDto'>;
export type ThemePreferenceResponse = Schema<'ThemePreferenceResponseDto'>;
export type UpdateThemePreferenceRequest = Schema<'UpdateThemePreferenceRequestDto'>;

export type BookSearchFacets = Schema<'BookSearchFacetsDto'>;
export type BookSearchFilters = Schema<'BookSearchFiltersDto'>;
export type BookSearchResponse = Schema<'BookSearchResponseDto'>;
export type BookSearchValueFacet = Schema<'BookSearchValueFacetDto'>;
export type BookCardResponse = Schema<'BookCardResponseDto'>;
export type BookMetadataResponse = Schema<'BookMetadataResponseDto'>;
export type BookSummary = Schema<'BookSummaryDto'>;
export type BookSeriesEntryResponse = Schema<'BookSeriesEntryResponseDto'>;
export type BookSeriesResponse = Schema<'BookSeriesResponseDto'>;
export type NormalizedBook = BookMetadataResponse;
export type RelatedBookResponse = Schema<'RelatedBookResponseDto'>;
export type RelatedBooksResponse = Schema<'RelatedBooksResponseDto'>;
export type SimilarEditionsResponse = Schema<'SimilarEditionsResponseDto'>;
export type BookshelfAnalysisResponse = Schema<'BookshelfAnalysisResponseDto'>;
export type BookshelfBookLocation = Schema<'BookshelfBookLocationDto'>;
export type BookshelfBoundingBox = Schema<'BookshelfBoundingBoxDto'>;
export type BookshelfCandidate = Schema<'BookshelfCandidateDto'>;
export type BookshelfCandidateMatchRequest = Schema<'BookshelfCandidateMatchRequestDto'>;
export type BookshelfCandidateMatchResponse = Schema<'BookshelfCandidateMatchResponseDto'>;
export type BookshelfCandidateSearchResponse = Schema<'BookshelfCandidateSearchResponseDto'>;
export type BookshelfDetectionResponse = Schema<'BookshelfDetectionResponseDto'>;
export type BookshelfPhotoDetail = Schema<'BookshelfPhotoDetailDto'>;
export type BookshelfPhotoSummary = Schema<'BookshelfPhotoSummaryDto'>;
export type BookshelfProviderIssue = Schema<'BookshelfProviderIssueDto'>;
export type BookshelfScanDetection = Schema<'BookshelfScanDetectionDto'>;
export type AssociateBookshelfDetectionRequest = Schema<'AssociateBookshelfDetectionRequestDto'>;
export type UpdateBookshelfPhotoRequest = Schema<'UpdateBookshelfPhotoRequestDto'>;

export type AddLibraryItemRequest = Schema<'AddLibraryItemRequestDto'>;
export type AddLibraryItemShelfRequest = Schema<'AddLibraryItemShelfRequestDto'>;
export type LibraryBookResponse = Schema<'LibraryBookResponseDto'>;
export type LibraryItemResponse = Schema<'LibraryItemResponseDto'>;
export type LibraryItemStatus = LibraryItemResponse['status'];
export type MoveLibraryItemRequest = Schema<'MoveLibraryItemRequestDto'>;
export type ReplaceLibraryItemEditionRequest = Schema<'ReplaceLibraryItemEditionRequestDto'>;
export type UpdateLibraryItemRequest = Schema<'UpdateLibraryItemRequestDto'>;
export type UpdateProgressRequest = Schema<'UpdateProgressRequestDto'>;

export type CreateShelfRequest = Schema<'CreateShelfRequestDto'>;
export type DeletedShelfBookResponse = Schema<'DeletedShelfBookResponseDto'>;
export type DeleteShelfResponse = Schema<'DeleteShelfResponseDto'>;
export type ShelfResponse = Schema<'ShelfResponseDto'>;
export type ShelfSummaryResponse = Schema<'ShelfSummaryResponseDto'>;
export type UpdateShelfOrderRequest = Schema<'UpdateShelfOrderRequestDto'>;
export type UpdateShelfRequest = Schema<'UpdateShelfRequestDto'>;

export type GoalStatsResponse = Schema<'GoalStatsResponseDto'>;
export type ReadingGoalResponse = Schema<'ReadingGoalResponseDto'>;
export type UpdateReadingGoalRequest = Schema<'UpdateReadingGoalRequestDto'>;

export type StatsSummaryResponse = Schema<'StatsSummaryResponseDto'>;
export type YearInReviewResponse = Schema<'YearInReviewResponseDto'>;

export type HealthResponse = Schema<'HealthResponseDto'>;
export type ReadinessResponse = Schema<'ReadinessResponseDto'>;
export type ReadinessUnavailableResponse = Schema<'ReadinessUnavailableResponseDto'>;
