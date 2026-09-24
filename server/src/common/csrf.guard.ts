import {
  CanActivate, ExecutionContext, ForbiddenException, Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { ACCESS_COOKIE, CSRF_COOKIE, REFRESH_COOKIE } from './cookies';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF por double-submit cookie.
 *
 * Como la sesión viaja en cookies, el navegador las adjunta solas a cualquier
 * petición que salga hacia nuestro dominio — incluida una que dispare una web
 * maliciosa. La defensa: exigir que el valor de la cookie `tn_csrf` venga
 * repetido en la cabecera `X-CSRF-Token`. Un sitio atacante puede provocar la
 * petición, pero no puede leer nuestras cookies (same-origin policy), así que
 * no sabe qué poner en la cabecera.
 *
 * Se comprueba sin depender de Passport (este guard corre antes que el de JWT),
 * mirando directamente si la petición trae cookies de sesión.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<
      Request & { cookies?: Record<string, string> }
    >();

    if (SAFE_METHODS.has(req.method)) return true;

    // Cliente que se autentica con `Authorization: Bearer` (curl, scripts): el
    // navegador nunca manda esa cabecera por su cuenta, así que no es
    // falsificable desde otro origen y no necesita token CSRF.
    const authz = req.headers.authorization;
    if (authz && authz.startsWith('Bearer ')) return true;

    const cookies = req.cookies ?? {};
    const hasSession = !!cookies[ACCESS_COOKIE] || !!cookies[REFRESH_COOKIE];
    if (!hasSession) return true;   // nada que falsificar

    const expected = cookies[CSRF_COOKIE];
    const got = req.get('x-csrf-token');
    if (!expected || !got || got !== expected) {
      throw new ForbiddenException('Token CSRF ausente o incorrecto.');
    }
    return true;
  }
}
