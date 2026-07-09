import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthTokenResponseDto } from './dto/auth-token-response.dto';
import { AuthUserResponseDto } from './dto/auth-user-response.dto';
import { PasswordResetConfirmRequestDto } from './dto/password-reset-confirm-request.dto';
import { PasswordResetRequestDto } from './dto/password-reset-request.dto';
import { PasswordResetResponseDto } from './dto/password-reset-response.dto';
import { RefreshTokenRequestDto } from './dto/refresh-token-request.dto';
import { SigninRequestDto } from './dto/signin-request.dto';
import { SignoutRequestDto } from './dto/signout-request.dto';
import { SignoutResponseDto } from './dto/signout-response.dto';
import { SignupRequestDto } from './dto/signup-request.dto';
import { AccessTokenGuard } from './guards/access-token.guard';
import type { AuthenticatedRequest, HttpHeaderValue } from './types/authenticated-request';
import type { AuthenticatedUser } from './types/authenticated-user';
import type { RequestContext } from './types/request-context';

/**
 * Exposes account-auth HTTP endpoints and keeps request-context extraction at the edge before
 * delegating credential logic to AuthService.
 */
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  /**
   * Receives the auth application service from Nest.
   */
  public constructor(private readonly authService: AuthService) {}
  /**
   * Returns the active authenticated user attached by AccessTokenGuard.
   */
  @Get('me')
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get the current authenticated user.' })
  @ApiOkResponse({ type: AuthUserResponseDto })
  @ApiUnauthorizedResponse({ description: 'Bearer token is missing, invalid, or expired.' })
  public getCurrentUser(@CurrentUser() user: AuthenticatedUser): Promise<AuthUserResponseDto> {
    return this.authService.getCurrentUser(user);
  }
  /**
   * Completes password reset and returns a fresh authenticated session.
   */
  @Post('password-reset/confirm')
  @HttpCode(200)
  @ApiOperation({ summary: 'Confirm a password reset and issue a new session.' })
  @ApiOkResponse({ type: AuthTokenResponseDto })
  @ApiUnauthorizedResponse({ description: 'Password reset token is invalid or expired.' })
  public confirmPasswordReset(
    @Body() dto: PasswordResetConfirmRequestDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<AuthTokenResponseDto> {
    return this.authService.confirmPasswordReset(dto, this.getRequestContext(request));
  }

  /**
   * Creates a password reset token without revealing whether the submitted email exists.
   */
  @Post('password-reset/request')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Request a password reset token.',
    description: 'Development and test environments return the token so Swagger can test the flow.',
  })
  @ApiOkResponse({ type: PasswordResetResponseDto })
  public requestPasswordReset(
    @Body() dto: PasswordResetRequestDto,
  ): Promise<PasswordResetResponseDto> {
    return this.authService.requestPasswordReset(dto);
  }
  /**
   * Rotates a refresh token and issues a new access token.
   */
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Rotate a refresh token and issue a new access token.' })
  @ApiOkResponse({ type: AuthTokenResponseDto })
  @ApiUnauthorizedResponse({ description: 'Refresh token is invalid, expired, or revoked.' })
  public refresh(
    @Body() dto: RefreshTokenRequestDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<AuthTokenResponseDto> {
    return this.authService.refresh(dto, this.getRequestContext(request));
  }
  /**
   * Signs in with username-or-email credentials and request metadata for refresh-token auditing.
   */
  @Post('signin')
  @HttpCode(200)
  @ApiOperation({ summary: 'Sign in with email and password.' })
  @ApiOkResponse({ type: AuthTokenResponseDto })
  @ApiUnauthorizedResponse({ description: 'Email or password is invalid.' })
  public signin(
    @Body() dto: SigninRequestDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<AuthTokenResponseDto> {
    return this.authService.signin(dto, this.getRequestContext(request));
  }
  /**
   * Revokes one refresh token.
   */
  @Post('signout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Revoke a refresh token.' })
  @ApiOkResponse({ type: SignoutResponseDto })
  public signout(@Body() dto: SignoutRequestDto): Promise<SignoutResponseDto> {
    return this.authService.signout(dto);
  }
  /**
   * Creates a user, default shelves, preferences, and an initial authenticated session.
   */
  @Post('signup')
  @ApiOperation({ summary: 'Create an account with default shelves and sign in.' })
  @ApiCreatedResponse({ type: AuthTokenResponseDto })
  @ApiConflictResponse({ description: 'An account already exists for that email.' })
  public signup(
    @Body() dto: SignupRequestDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<AuthTokenResponseDto> {
    return this.authService.signup(dto, this.getRequestContext(request));
  }
  /**
   * Normalizes possibly repeated HTTP header values to the first value Nest exposes.
   */
  private firstHeaderValue(value: HttpHeaderValue): string | undefined {
    return Array.isArray(value) ? value[0] : value;
  }
  /**
   * Captures IP and user agent metadata stored with refresh tokens.
   */
  private getRequestContext(request: AuthenticatedRequest): RequestContext {
    const forwardedFor = this.firstHeaderValue(request.headers['x-forwarded-for']);
    const userAgent = this.firstHeaderValue(request.headers['user-agent']);
    const ipAddress =
      forwardedFor?.split(',')[0]?.trim() ?? request.ip ?? request.socket?.remoteAddress;

    return {
      ipAddress,
      userAgent,
    };
  }
}
