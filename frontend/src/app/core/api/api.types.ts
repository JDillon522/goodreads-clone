import type { components, operations, paths } from './bookshelf-api.types';

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

export type BookInput = Schema<'BookInputDto'>;
export type BookSearchFacets = Schema<'BookSearchFacetsDto'>;
export type BookSearchFilters = Schema<'BookSearchFiltersDto'>;
export type BookSearchResponse = Schema<'BookSearchResponseDto'>;
export type BookSearchValueFacet = Schema<'BookSearchValueFacetDto'>;
export type BookSearchDecadeFacet = Schema<'BookSearchDecadeFacetDto'>;
export type NormalizedBook = Schema<'NormalizedBookDto'>;

export type AddLibraryItemRequest = Schema<'AddLibraryItemRequestDto'>;
export type AddLibraryItemShelfRequest = Schema<'AddLibraryItemShelfRequestDto'>;
export type LibraryBookResponse = Schema<'LibraryBookResponseDto'>;
export type LibraryItemResponse = Schema<'LibraryItemResponseDto'>;
export type LibraryItemStatus = LibraryItemResponse['status'];
export type MoveLibraryItemRequest = Schema<'MoveLibraryItemRequestDto'>;
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
