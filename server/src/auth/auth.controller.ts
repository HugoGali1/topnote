import {
  Body, Controller, Delete, Get, HttpCode, Patch, Post, Req, Res, UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { randomBytes } from 'crypto';
import { AuthService, SessionTokens } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { TokenDto } from './dto/token.dto';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import type { RequestUser } from '../common/jwt.strategy';
import {
  REFRESH_COOKIE, CSRF_COOKIE, cookieConfig, setAccessCookie, setRefreshCookie,
  setCsrfCookie, clearAuthCookies, CookieConfig,
} from '../common/cookies';
import type { TokenContext } from './tokens.service';

/** Límite estricto para lo que un atacante querría martillear. */
const STRICT = { short: { limit: 5, ttl: 60_000 } };
/** Envío de correo: más caro todavía, y por hora. */
const EMAIL_SEND = { short: { limit: 3, ttl: 3_600_000 } };

@Controller('auth')
export class AuthController {
  private readonly cookies: CookieConfig;

  constructor(
    private readonly auth: AuthService,
    config: ConfigService,
  ) {
    this.cookies = cookieConfig(config);
  }

  /* ============================================================
     Sesión
     ============================================================ */

  /**
   * Entrega el token CSRF con el que firmar las peticiones que mutan estado.
   * Es GET (no lo protege el CsrfGuard) y sirve para arrancar: el front lo
   * llama cuando no puede leer la cookie `tn_csrf` por sí mismo, cosa que pasa
   * si la API vive en un dominio distinto al del front.
   *
   * Si ya hay cookie la reutiliza, para no invalidar peticiones en vuelo.
   */
  @Get('csrf')
  csrf(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const existing = cookieOf(req, CSRF_COOKIE);
    const token = existing ?? randomBytes(24).toString('base64url');
    if (!existing) setCsrfCookie(res, token, 30 * 86_400_000, this.cookies);
    return { csrfToken: token };
  }

  @Throttle(STRICT)
  @Post('signup')
  async signup(
    @Body() dto: SignupDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.signup(dto, ctxOf(req));
    this.applySession(res, result.tokens);
    return { user: result.user, csrfToken: result.tokens.csrfToken };
  }

  @Throttle(STRICT)
  @HttpCode(200)
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.login(dto, ctxOf(req));
    this.applySession(res, result.tokens);
    return { user: result.user, csrfToken: result.tokens.csrfToken };
  }

  /**
   * Cambia el par de tokens por uno nuevo. Lo llama el front solo, cuando una
   * petición devuelve 401 porque el access token (15 min) ha caducado.
   */
  @Throttle({ short: { limit: 30, ttl: 60_000 } })
  @HttpCode(200)
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const raw = cookieOf(req, REFRESH_COOKIE);
    if (!raw) {
      clearAuthCookies(res, this.cookies);
      res.status(401);
      return { message: 'No hay sesión que renovar.', statusCode: 401 };
    }
    try {
      const result = await this.auth.refreshSession(raw, ctxOf(req));
      this.applySession(res, result.tokens);
      return { user: result.user, csrfToken: result.tokens.csrfToken };
    } catch (err) {
      // Refresh inválido, caducado o reutilizado: la sesión se acabó, así que
      // limpiamos las cookies para que el navegador deje de reintentar.
      clearAuthCookies(res, this.cookies);
      throw err;
    }
  }

  @HttpCode(204)
  @Post('logout')
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.logout(cookieOf(req, REFRESH_COOKIE));
    clearAuthCookies(res, this.cookies);
  }

  /** Cierra la sesión en todos los dispositivos y revoca los access tokens. */
  @UseGuards(JwtAuthGuard)
  @HttpCode(204)
  @Post('logout-all')
  async logoutAll(
    @CurrentUser() user: RequestUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.logoutAll(user.id);
    clearAuthCookies(res, this.cookies);
  }

  @UseGuards(JwtAuthGuard)
  @Get('sessions')
  sessions(@CurrentUser() user: RequestUser) {
    return this.auth.listSessions(user.id);
  }

  /* ============================================================
     Perfil
     ============================================================ */

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: RequestUser) {
    return this.auth.me(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  async updateProfile(
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateProfileDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user: updated, tokens } =
      await this.auth.updateProfile(user.id, dto, ctxOf(req));
    // Si cambió la contraseña, su sesión quedó revocada: le entregamos cookies
    // nuevas en la misma respuesta para que no le eche de la app.
    if (tokens) this.applySession(res, tokens);
    return updated;
  }

  @UseGuards(JwtAuthGuard)
  @Delete('account')
  @HttpCode(204)
  async deleteAccount(
    @CurrentUser() user: RequestUser,
    @Body() dto: DeleteAccountDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.deleteAccount(user.id, dto.password);
    clearAuthCookies(res, this.cookies);
  }

  /* ============================================================
     Verificación de email
     ============================================================ */

  @Throttle(STRICT)
  @HttpCode(200)
  @Post('verify-email')
  verifyEmail(@Body() dto: TokenDto) {
    return this.auth.verifyEmail(dto.token);
  }

  @Throttle(EMAIL_SEND)
  @HttpCode(204)
  @Post('resend-verification')
  async resendVerification(@Body() dto: ResendVerificationDto) {
    await this.auth.resendVerification(dto.email);
  }

  /* ============================================================
     Recuperación de contraseña
     ============================================================ */

  @Throttle(EMAIL_SEND)
  @HttpCode(204)
  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.auth.forgotPassword(dto.email);
  }

  @Throttle(STRICT)
  @HttpCode(204)
  @Post('reset-password')
  async resetPassword(
    @Body() dto: ResetPasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.resetPassword(dto.token, dto.password);
    // El reset revoca todo: si el navegador traía cookies viejas, fuera.
    clearAuthCookies(res, this.cookies);
  }

  /* ============================================================
     Internos
     ============================================================ */

  /**
   * Deja la sesión en tres cookies: access (httpOnly, corta), refresh
   * (httpOnly, larga, limitada a /api/auth) y csrf (legible por JS, que el
   * front reenvía en X-CSRF-Token).
   *
   * El access token nunca va en el cuerpo de la respuesta: si el front pudiera
   * leerlo, un XSS podría robarlo, que es justo lo que evita httpOnly.
   */
  private applySession(res: Response, tokens: SessionTokens): void {
    setAccessCookie(res, tokens.accessToken, tokens.accessMaxAgeMs, this.cookies);
    setRefreshCookie(res, tokens.refreshToken, tokens.refreshExpiresAt, this.cookies);
    // La cookie CSRF vive tanto como el refresh: debe seguir ahí cuando el
    // access caduque, porque /auth/refresh también la exige.
    setCsrfCookie(
      res, tokens.csrfToken,
      tokens.refreshExpiresAt.getTime() - Date.now(), this.cookies,
    );
  }
}

function cookieOf(req: Request, name: string): string | undefined {
  return (req as Request & { cookies?: Record<string, string> }).cookies?.[name];
}

function ctxOf(req: Request): TokenContext {
  return { userAgent: req.get('user-agent') ?? null, ip: req.ip ?? null };
}
