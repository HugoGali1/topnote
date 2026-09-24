import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { UsersService } from '../users/users.service';
import { ACCESS_COOKIE } from './cookies';

export interface JwtPayload {
  sub: string;   // user id
  email: string;
  tv: number;    // token version — ver User.tokenVersion
}

export interface RequestUser {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
}

/**
 * Saca el access token de la cookie httpOnly. Deja marcado en la request que la
 * credencial vino por cookie, que es lo que decide si el CsrfGuard actúa: un
 * Bearer explícito no lo envía el navegador solo, así que no es falsificable
 * desde otro sitio y no necesita token CSRF.
 */
function fromCookie(req: Request): string | null {
  const token = (req as Request & { cookies?: Record<string, string> })
    .cookies?.[ACCESS_COOKIE];
  if (!token) return null;
  (req as Request & { authVia?: string }).authVia = 'cookie';
  return token;
}

function fromBearer(req: Request): string | null {
  const token = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
  if (token) (req as Request & { authVia?: string }).authVia = 'bearer';
  return token;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly users: UsersService,
  ) {
    const secret = config.get<string>('JWT_SECRET');
    if (!secret) throw new Error('JWT_SECRET is required');
    super({
      // La cookie manda; el header Bearer se mantiene para clientes que no son
      // el navegador (curl, scripts, la app móvil el día que exista).
      jwtFromRequest: ExtractJwt.fromExtractors([fromCookie, fromBearer]),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload): Promise<RequestUser> {
    const user = await this.users.findById(payload.sub);
    if (!user) throw new UnauthorizedException();

    // Revocación real: si la contraseña cambió o se cerraron todas las sesiones,
    // tokenVersion subió y este token — aunque no haya expirado — ya no vale.
    if ((payload.tv ?? 0) !== user.tokenVersion) {
      throw new UnauthorizedException('Sesión revocada. Vuelve a iniciar sesión.');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: user.emailVerifiedAt != null,
    };
  }
}
