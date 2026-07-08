import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';

import { PrismaService } from '../database/prisma.service';
import { AuthUserRecord, UsersService } from '../users/users.service';
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
import type { AccessTokenPayload } from './types/access-token-payload';
import type { AuthenticatedUser } from './types/authenticated-user';
import type { RequestContext } from './types/request-context';

const accessTokenTtlSeconds = 15 * 60;
const refreshTokenTtlDays = 30;
const passwordResetMessage =
  'If an account exists for that email, a password reset token has been created.';

type PrismaExecutor = Prisma.TransactionClient | PrismaService;

@Injectable()
export class AuthService {
  public constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  public async confirmPasswordReset(
    dto: PasswordResetConfirmRequestDto,
    requestContext: RequestContext,
  ): Promise<AuthTokenResponseDto> {
    const tokenHash = this.hashToken(dto.token);
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      include: { user: true },
      where: { tokenHash },
    });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt <= new Date()) {
      throw new BadRequestException('Password reset token is invalid or expired.');
    }

    if (resetToken.user.deactivatedAt) {
      throw new UnauthorizedException('This account has been deactivated.');
    }

    const passwordHash = await this.hashPassword(dto.newPassword);
    const now = new Date();

    const user = await this.prisma.$transaction(async (transaction) => {
      await transaction.passwordResetToken.update({
        data: { usedAt: now },
        where: { id: resetToken.id },
      });

      const updatedUser = await transaction.user.update({
        data: { passwordHash },
        where: { id: resetToken.userId },
      });

      await transaction.authRefreshToken.updateMany({
        data: { revokedAt: now },
        where: {
          revokedAt: null,
          userId: resetToken.userId,
        },
      });

      return updatedUser;
    });

    return this.issueAuthResponse(user, requestContext);
  }

  public async getCurrentUser(user: AuthenticatedUser): Promise<AuthUserResponseDto> {
    const currentUser = await this.usersService.findById(user.id);

    if (!currentUser || currentUser.deactivatedAt) {
      throw new UnauthorizedException('Authenticated user no longer exists.');
    }

    return this.toUserResponse(currentUser);
  }

  public async refresh(
    dto: RefreshTokenRequestDto,
    requestContext: RequestContext,
  ): Promise<AuthTokenResponseDto> {
    const tokenHash = this.hashToken(dto.refreshToken);
    const storedToken = await this.prisma.authRefreshToken.findUnique({
      include: { user: true },
      where: { tokenHash },
    });

    if (
      !storedToken ||
      storedToken.revokedAt ||
      storedToken.expiresAt <= new Date() ||
      storedToken.user.deactivatedAt
    ) {
      throw new UnauthorizedException('Refresh token is invalid or expired.');
    }

    const refreshToken = await this.prisma.$transaction(async (transaction) => {
      await transaction.authRefreshToken.update({
        data: { revokedAt: new Date() },
        where: { id: storedToken.id },
      });

      return this.createRefreshToken(transaction, storedToken.userId, requestContext);
    });

    const accessToken = await this.signAccessToken(storedToken.user);

    return this.toAuthResponse(storedToken.user, accessToken, refreshToken);
  }

  public async requestPasswordReset(
    dto: PasswordResetRequestDto,
  ): Promise<PasswordResetResponseDto> {
    const email = this.normalizeEmail(dto.email);
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      return { message: passwordResetMessage };
    }

    const resetToken = this.createOpaqueToken();
    const tokenHash = this.hashToken(resetToken);
    const now = new Date();
    const expiresAt = this.dateAfterMinutes(
      this.configService.get<number>('PASSWORD_RESET_TOKEN_TTL_MINUTES') ?? 30,
    );

    await this.prisma.$transaction([
      this.prisma.passwordResetToken.updateMany({
        data: { usedAt: now },
        where: {
          usedAt: null,
          userId: user.id,
        },
      }),
      this.prisma.passwordResetToken.create({
        data: {
          expiresAt,
          tokenHash,
          userId: user.id,
        },
      }),
    ]);

    if (this.configService.get<string>('NODE_ENV') === 'production') {
      return { message: passwordResetMessage };
    }

    return {
      message: passwordResetMessage,
      resetToken,
    };
  }

  public async signin(
    dto: SigninRequestDto,
    requestContext: RequestContext,
  ): Promise<AuthTokenResponseDto> {
    const identifier = dto.email.trim().toLowerCase();
    const user = await this.usersService.findBySigninIdentifier(identifier);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    if (user.deactivatedAt) {
      throw new UnauthorizedException('This account has been deactivated.');
    }

    const passwordMatches = await argon2.verify(user.passwordHash, dto.password);

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    return this.issueAuthResponse(user, requestContext);
  }

  public async signout(dto: SignoutRequestDto): Promise<SignoutResponseDto> {
    await this.prisma.authRefreshToken.updateMany({
      data: { revokedAt: new Date() },
      where: {
        revokedAt: null,
        tokenHash: this.hashToken(dto.refreshToken),
      },
    });

    return { signedOut: true };
  }

  public async signup(
    dto: SignupRequestDto,
    requestContext: RequestContext,
  ): Promise<AuthTokenResponseDto> {
    const email = this.normalizeEmail(dto.email);
    const existingUser = await this.usersService.findByEmail(email);

    if (existingUser) {
      throw new ConflictException('An account already exists for that email.');
    }

    const passwordHash = await this.hashPassword(dto.password);
    const user = await this.usersService.createWithDefaults({
      displayName: this.normalizeOptionalText(dto.displayName),
      email,
      passwordHash,
    });

    return this.issueAuthResponse(user, requestContext);
  }

  private createOpaqueToken(): string {
    return randomBytes(48).toString('base64url');
  }

  private async createRefreshToken(
    executor: PrismaExecutor,
    userId: string,
    requestContext: RequestContext,
  ): Promise<string> {
    const refreshToken = this.createOpaqueToken();

    await executor.authRefreshToken.create({
      data: {
        expiresAt: this.dateAfterDays(refreshTokenTtlDays),
        ipAddress: requestContext.ipAddress,
        tokenHash: this.hashToken(refreshToken),
        userAgent: requestContext.userAgent,
        userId,
      },
    });

    return refreshToken;
  }

  private dateAfterDays(days: number): Date {
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  private dateAfterMinutes(minutes: number): Date {
    return new Date(Date.now() + minutes * 60 * 1000);
  }

  private hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
    });
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async issueAuthResponse(
    user: AuthUserRecord,
    requestContext: RequestContext,
  ): Promise<AuthTokenResponseDto> {
    const [accessToken, refreshToken] = await Promise.all([
      this.signAccessToken(user),
      this.createRefreshToken(this.prisma, user.id, requestContext),
    ]);

    return this.toAuthResponse(user, accessToken, refreshToken);
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private normalizeOptionalText(value: string | undefined): string | undefined {
    const normalized = value?.trim();
    return normalized ? normalized : undefined;
  }

  private async signAccessToken(user: AuthUserRecord): Promise<string> {
    const payload: AccessTokenPayload = {
      email: user.email,
      role: user.role,
      sub: user.id,
      type: 'access',
      username: user.username,
    };

    return this.jwtService.signAsync(payload, {
      expiresIn: accessTokenTtlSeconds,
      secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  private toAuthResponse(
    user: AuthUserRecord,
    accessToken: string,
    refreshToken: string,
  ): AuthTokenResponseDto {
    return {
      accessToken,
      expiresInSeconds: accessTokenTtlSeconds,
      refreshToken,
      tokenType: 'Bearer',
      user: this.toUserResponse(user),
    };
  }

  private toUserResponse(user: AuthUserRecord): AuthUserResponseDto {
    return {
      createdAt: user.createdAt.toISOString(),
      deactivatedAt: user.deactivatedAt?.toISOString() ?? null,
      displayName: user.displayName,
      email: user.email,
      id: user.id,
      role: user.role ?? UserRole.USER,
      username: user.username,
    };
  }
}
