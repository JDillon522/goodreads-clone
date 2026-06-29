import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import type { AccessTokenPayload } from '../types/access-token-payload';
import type { AuthenticatedRequest, HttpHeaderValue } from '../types/authenticated-request';

@Injectable()
export class AccessTokenGuard implements CanActivate {
  public constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

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

      request.user = {
        email: payload.email,
        id: payload.sub,
      };

      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired bearer token.');
    }
  }

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
