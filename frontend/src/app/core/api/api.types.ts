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

export type GuestSessionResponse = Schema<'GuestSessionResponseDto'>;

export type BookInput = Schema<'BookInputDto'>;
export type BookSearchResponse = Schema<'BookSearchResponseDto'>;
export type NormalizedBook = Schema<'NormalizedBookDto'>;

export type AddLibraryItemRequest = Schema<'AddLibraryItemRequestDto'>;
export type LibraryBookResponse = Schema<'LibraryBookResponseDto'>;
export type LibraryItemResponse = Schema<'LibraryItemResponseDto'>;
export type MoveLibraryItemRequest = Schema<'MoveLibraryItemRequestDto'>;
export type UpdateLibraryItemRequest = Schema<'UpdateLibraryItemRequestDto'>;
export type UpdateProgressRequest = Schema<'UpdateProgressRequestDto'>;

export type CreateShelfRequest = Schema<'CreateShelfRequestDto'>;
export type ShelfResponse = Schema<'ShelfResponseDto'>;
export type ShelfSummaryResponse = Schema<'ShelfSummaryResponseDto'>;
export type UpdateShelfOrderRequest = Schema<'UpdateShelfOrderRequestDto'>;
export type UpdateShelfRequest = Schema<'UpdateShelfRequestDto'>;

export type GoalStatsResponse = Schema<'GoalStatsResponseDto'>;
export type ReadingGoalResponse = Schema<'ReadingGoalResponseDto'>;
export type UpdateReadingGoalRequest = Schema<'UpdateReadingGoalRequestDto'>;

export type HealthResponse = Schema<'HealthResponseDto'>;
export type ReadinessResponse = Schema<'ReadinessResponseDto'>;
export type ReadinessUnavailableResponse = Schema<'ReadinessUnavailableResponseDto'>;
