import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import { PrismaService } from '../../database/prisma.service';
import type { AccessTokenPayload } from '../types/access-token-payload';
import type { AuthenticatedRequest, HttpHeaderValue } from '../types/authenticated-request';

/**
 * Validates short-lived authenticated-user JWTs and attaches the current database user to the
 * request. The database lookup blocks deleted or deactivated users even when their token has not
 * expired yet.
 */
@Injectable()
export class AccessTokenGuard implements CanActivate {
  /**
   * Receives JWT, config, and persistence dependencies from Nest.
   */
  public constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}
  /**
   * Accepts requests with a valid bearer access token and rejects missing, expired, malformed, or
   * deactivated-user credentials.
   */
  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractBearerToken(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException('Missing bearer token.');
    }

    try {
      const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });

      if (payload.type !== 'access' || !payload.sub) {
        throw new UnauthorizedException('Invalid bearer token.');
      }

      const user = await this.prisma.user.findUnique({
        select: {
          deactivatedAt: true,
          email: true,
          id: true,
          role: true,
          username: true,
        },
        where: { id: payload.sub },
      });

      if (!user || user.deactivatedAt) {
        throw new UnauthorizedException('Authenticated user no longer exists.');
      }

      request.user = {
        email: user.email,
        id: user.id,
        role: user.role,
        username: user.username,
      };

      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired bearer token.');
    }
  }
  /**
   * Extracts the token value from a standard `Authorization: Bearer ...` header.
   */
  private extractBearerToken(header: HttpHeaderValue): string | undefined {
    const value = Array.isArray(header) ? header[0] : header;

    if (!value) {
      return undefined;
    }

    const [scheme, token] = value.split(' ');

    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      return undefined;
    }

    return token;
  }
}
