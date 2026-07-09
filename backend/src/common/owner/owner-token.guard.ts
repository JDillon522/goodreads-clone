import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import type { AccessTokenPayload } from '../../auth/types/access-token-payload';
import type { HttpHeaderValue } from '../../auth/types/authenticated-request';
import { PrismaService } from '../../database/prisma.service';
import { hashOpaqueToken } from '../security/opaque-token';
import { guestOwnerContext, userOwnerContext } from './owner-context';
import type { OwnerRequest } from './owner-request';

/**
 * Accepts either authenticated user JWTs or guest-session opaque tokens and attaches a normalized
 * owner context to the request. This lets library/shelf APIs share one ownership boundary.
 */
@Injectable()
export class OwnerTokenGuard implements CanActivate {
  /**
   * Receives token verification and persistence dependencies from Nest.
   */
  public constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}
  /**
   * Resolves the bearer token as a user first, then as a guest session, and rejects anything that
   * cannot establish a valid owner.
   */
  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<OwnerRequest>();
    const token = this.extractBearerToken(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException('Missing bearer token.');
    }

    if (await this.attachUserOwner(request, token)) {
      return true;
    }

    if (await this.attachGuestOwner(request, token)) {
      return true;
    }

    throw new UnauthorizedException('Invalid or expired bearer token.');
  }
  /**
   * Resolves opaque guest tokens by hash, rejects expired sessions, and refreshes last-seen time.
   */
  private async attachGuestOwner(request: OwnerRequest, token: string): Promise<boolean> {
    const guestSession = await this.prisma.guestSession.findUnique({
      select: { expiresAt: true, id: true },
      where: { tokenHash: hashOpaqueToken(token) },
    });

    if (!guestSession || guestSession.expiresAt <= new Date()) {
      return false;
    }

    await this.prisma.guestSession.update({
      data: { lastSeenAt: new Date() },
      where: { id: guestSession.id },
    });

    request.owner = guestOwnerContext(guestSession.id);

    return true;
  }
  /**
   * Resolves JWT access tokens to active users and attaches both owner and user request context.
   */
  private async attachUserOwner(request: OwnerRequest, token: string): Promise<boolean> {
    try {
      const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });

      if (payload.type !== 'access' || !payload.sub) {
        return false;
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
        return false;
      }

      request.owner = userOwnerContext(user.id);
      request.user = {
        email: user.email,
        id: user.id,
        role: user.role,
        username: user.username,
      };

      return true;
    } catch {
      return false;
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
