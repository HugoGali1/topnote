import type { CookieOptions, Response } from 'express';
import type { ConfigService } from '@nestjs/config';

export const ACCESS_COOKIE  = 'tn_at';
export const REFRESH_COOKIE = 'tn_rt';
export const CSRF_COOKIE    = 'tn_csrf';

/** El refresh token solo se manda en las rutas que lo necesitan. */
export const REFRESH_COOKIE_PATH = '/api/auth';

export interface CookieConfig {
  secure: boolean;
  sameSite: 'lax' | 'strict' | 'none';
  domain?: string;
}

/**
 * En local el front (:8000) y el back (:3001) comparten "site" (el puerto no
 * cuenta para SameSite), así que `lax` basta y funciona sobre http.
 *
 * En producción con dominios distintos hace falta `COOKIE_SAMESITE=none` +
 * `COOKIE_SECURE=true` (los navegadores rechazan SameSite=None sin Secure).
 */
export function cookieConfig(config: ConfigService): CookieConfig {
  const isProd = config.get<string>('NODE_ENV') === 'production';
  const sameSiteRaw = (config.get<string>('COOKIE_SAMESITE') ?? 'lax').toLowerCase();
  const sameSite = (['lax', 'strict', 'none'].includes(sameSiteRaw)
    ? sameSiteRaw : 'lax') as CookieConfig['sameSite'];
  const secureRaw = config.get<string>('COOKIE_SECURE');
  const secure = secureRaw !== undefined ? secureRaw === 'true' : isProd;

  if (sameSite === 'none' && !secure) {
    throw new Error(
      'COOKIE_SAMESITE=none exige COOKIE_SECURE=true: el navegador descarta ' +
      'las cookies SameSite=None que no sean Secure.',
    );
  }
  return { secure, sameSite, domain: config.get<string>('COOKIE_DOMAIN') || undefined };
}

function base(cfg: CookieConfig): CookieOptions {
  return { secure: cfg.secure, sameSite: cfg.sameSite, domain: cfg.domain, path: '/' };
}

export function setAccessCookie(
  res: Response, token: string, maxAgeMs: number, cfg: CookieConfig,
): void {
  res.cookie(ACCESS_COOKIE, token, { ...base(cfg), httpOnly: true, maxAge: maxAgeMs });
}

export function setRefreshCookie(
  res: Response, token: string, expiresAt: Date, cfg: CookieConfig,
): void {
  res.cookie(REFRESH_COOKIE, token, {
    ...base(cfg), httpOnly: true, path: REFRESH_COOKIE_PATH, expires: expiresAt,
  });
}

/**
 * Token CSRF en cookie legible por JS a propósito: el patrón double-submit
 * exige que el front pueda leerla para reenviarla en la cabecera X-CSRF-Token.
 * No es un secreto de sesión, solo prueba que quien envía puede leer nuestras
 * cookies — cosa que un sitio atacante no puede hacer.
 */
export function setCsrfCookie(
  res: Response, token: string, maxAgeMs: number, cfg: CookieConfig,
): void {
  res.cookie(CSRF_COOKIE, token, { ...base(cfg), httpOnly: false, maxAge: maxAgeMs });
}

export function clearAuthCookies(res: Response, cfg: CookieConfig): void {
  res.clearCookie(ACCESS_COOKIE,  { ...base(cfg), httpOnly: true });
  res.clearCookie(CSRF_COOKIE,    { ...base(cfg), httpOnly: false });
  res.clearCookie(REFRESH_COOKIE, { ...base(cfg), httpOnly: true, path: REFRESH_COOKIE_PATH });
}
