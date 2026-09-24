import {
  BadRequestException, ConflictException, ForbiddenException, Injectable,
  Logger, UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';
import { Favorite } from '../favorites/favorite.entity';
import { HistoryEntry } from '../history/history.entity';
import { MailService } from '../mail/mail.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import {
  TokensService, TokenContext, RefreshTokenReuseError, RefreshTokenInvalidError,
} from './tokens.service';
import { LoginThrottleService } from './login-throttle.service';
import type { JwtPayload } from '../common/jwt.strategy';
import { parseDuration } from '../common/duration';

const BCRYPT_ROUNDS = 12;
const VERIFY_TTL_MS = 24 * 3_600_000;   // 24 h
const RESET_TTL_MS  = 3_600_000;        // 1 h

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  gender: 'masculino' | 'femenino' | null;
  emailVerified: boolean;
  createdAt: string;
}

export interface SessionTokens {
  accessToken: string;
  accessMaxAgeMs: number;
  refreshToken: string;
  refreshExpiresAt: Date;
  csrfToken: string;
}

export interface AuthResult {
  user: PublicUser;
  tokens: SessionTokens;
}

@Injectable()
export class AuthService {
  private readonly log = new Logger('AuthService');
  private readonly accessTtlMs: number;
  private readonly requireVerification: boolean;
  private readonly appUrl: string;

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly tokens: TokensService,
    private readonly loginThrottle: LoginThrottleService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {
    this.accessTtlMs = parseDuration(config.get<string>('ACCESS_TOKEN_TTL'), 15 * 60_000);
    this.requireVerification =
      config.get<string>('REQUIRE_EMAIL_VERIFICATION') === 'true';
    this.appUrl = (config.get<string>('APP_URL') ?? 'http://localhost:8000')
      .replace(/\/+$/, '');
  }

  /* ============================================================
     Alta y acceso
     ============================================================ */

  async signup(dto: SignupDto, ctx: TokenContext): Promise<AuthResult> {
    const exists = await this.users.findByEmail(dto.email);
    if (exists) throw new ConflictException('Ya existe una cuenta con ese email.');

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.users.create({
      email: dto.email,
      name: dto.name,
      passwordHash,
      gender: dto.gender ?? null,
    });

    await this.sendVerification(user);

    // Damos sesion aunque el email no este verificado todavia: asi el usuario
    // puede usar la app mientras le llega el correo. Si
    // REQUIRE_EMAIL_VERIFICATION=true, los siguientes logins si se bloquean.
    return this.startSession(user, ctx);
  }

  async login(dto: LoginDto, ctx: TokenContext): Promise<AuthResult> {
    const lockMs = this.loginThrottle.retryAfterMs(dto.email);
    if (lockMs > 0) {
      throw new ForbiddenException(
        `Demasiados intentos fallidos. Vuelve a probar en ${Math.ceil(lockMs / 1000)} s.`,
      );
    }

    const user = await this.users.findByEmail(dto.email);
    if (!user) {
      // Comparacion de pega para que un email inexistente tarde lo mismo que
      // uno real: si no, el tiempo de respuesta delata que cuentas existen.
      await bcrypt.compare(dto.password, DUMMY_HASH);
      this.loginThrottle.registerFailure(dto.email);
      throw new UnauthorizedException('Credenciales no válidas.');
    }

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      this.loginThrottle.registerFailure(dto.email);
      throw new UnauthorizedException('Credenciales no válidas.');
    }

    if (this.requireVerification && !user.emailVerifiedAt) {
      throw new ForbiddenException(
        'Confirma tu email antes de entrar. Te hemos enviado un enlace.',
      );
    }

    this.loginThrottle.registerSuccess(dto.email);
    return this.startSession(user, ctx);
  }

  /**
   * Renueva el access token a partir del refresh. Rota siempre: el refresh
   * usado queda revocado y se emite otro. Si el presentado ya estaba revocado,
   * TokensService tumba la familia entera y aqui lo traducimos a un 401.
   */
  async refreshSession(rawRefresh: string, ctx: TokenContext): Promise<AuthResult> {
    try {
      const { userId, issued } = await this.tokens.rotate(rawRefresh, ctx);
      const user = await this.users.findById(userId);
      if (!user) throw new UnauthorizedException();

      return {
        user: this.toPublicUser(user),
        tokens: {
          accessToken: this.signAccessToken(user),
          accessMaxAgeMs: this.accessTtlMs,
          refreshToken: issued.token,
          refreshExpiresAt: issued.expiresAt,
          csrfToken: newCsrfToken(),
        },
      };
    } catch (err) {
      if (err instanceof RefreshTokenReuseError) {
        throw new UnauthorizedException(
          'Sesión invalidada por seguridad. Vuelve a iniciar sesión.',
        );
      }
      if (err instanceof RefreshTokenInvalidError) {
        throw new UnauthorizedException('Sesión caducada.');
      }
      throw err;
    }
  }

  async logout(rawRefresh: string | undefined): Promise<void> {
    if (rawRefresh) await this.tokens.revokeByToken(rawRefresh);
  }

  /** Cierra todas las sesiones e invalida tambien los access tokens vivos. */
  async logoutAll(userId: string): Promise<void> {
    await this.tokens.revokeAllForUser(userId);
    await this.users.bumpTokenVersion(userId);
  }

  async listSessions(userId: string) {
    const rows = await this.tokens.listActiveSessions(userId);
    return rows.map((r) => ({
      id: r.id,
      userAgent: r.userAgent,
      ip: r.ip,
      createdAt: r.createdAt.toISOString(),
      expiresAt: r.expiresAt.toISOString(),
    }));
  }

  /* ============================================================
     Perfil
     ============================================================ */

  async me(userId: string): Promise<PublicUser> {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException();
    return this.toPublicUser(user);
  }

  /**
   * Devuelve `reauth: true` cuando el cambio invalido la sesion (contrasena
   * nueva), para que el controlador reemita cookies en vez de dejar al usuario
   * con un token que su propio cambio acaba de revocar.
   */
  async updateProfile(
    userId: string, dto: UpdateProfileDto, ctx: TokenContext,
  ): Promise<{ user: PublicUser; tokens: SessionTokens | null }> {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException();

    const wantsEmail    = !!dto.email && dto.email !== user.email;
    const wantsPassword = !!dto.newPassword;
    const wantsName     = !!dto.name && dto.name !== user.name;
    const wantsGender   = dto.gender !== undefined && dto.gender !== user.gender;

    if (!wantsEmail && !wantsPassword && !wantsName && !wantsGender) {
      return { user: this.toPublicUser(user), tokens: null };
    }

    if (wantsEmail || wantsPassword) {
      if (!dto.currentPassword) {
        throw new BadRequestException('Confirma con tu contraseña actual.');
      }
      const ok = await bcrypt.compare(dto.currentPassword, user.passwordHash);
      if (!ok) throw new UnauthorizedException('Contraseña actual incorrecta.');
    }

    if (wantsEmail) {
      const existing = await this.users.findByEmail(dto.email!);
      if (existing && existing.id !== userId) {
        throw new ConflictException('Ya existe una cuenta con ese email.');
      }
      user.email = dto.email!.toLowerCase();
      // Email nuevo = email sin verificar; hay que probar que tambien es suyo.
      user.emailVerifiedAt = null;
    }
    if (wantsName) user.name = dto.name!.trim();
    if (wantsPassword) {
      user.passwordHash = await bcrypt.hash(dto.newPassword!, BCRYPT_ROUNDS);
      // Cambiar contrasena echa a todas las demas sesiones, que es justo lo que
      // esperas si la cambias porque crees que te la han robado.
      user.tokenVersion += 1;
    }
    if (wantsGender) user.gender = dto.gender ?? null;

    const saved = await this.users.save(user);

    let tokens: SessionTokens | null = null;
    if (wantsPassword) {
      await this.tokens.revokeAllForUser(userId);
      await this.mail.sendPasswordChangedEmail(saved.email, saved.name);
      // Su propia sesion acaba de quedar revocada: le damos uno nuevo para no
      // echarle de la app por cambiar la contrasena desde dentro.
      tokens = (await this.startSession(saved, ctx)).tokens;
    }
    if (wantsEmail) await this.sendVerification(saved);

    return { user: this.toPublicUser(saved), tokens };
  }

  async deleteAccount(userId: string, password: string): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException();
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Contraseña incorrecta.');

    // Cascada manual en transaccion (no usamos FKs porque los entities no las
    // declaran). Las tablas de tokens se limpian por user_id en crudo.
    await this.dataSource.transaction(async (em) => {
      await em.delete(Favorite, { userId });
      await em.delete(HistoryEntry, { userId });
      await em.query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);
      await em.query('DELETE FROM auth_tokens WHERE user_id = $1', [userId]);
      await em.delete(User, { id: userId });
    });
  }

  /* ============================================================
     Verificacion de email
     ============================================================ */

  async verifyEmail(rawToken: string): Promise<PublicUser> {
    const userId = await this.tokens.consumeAuthToken(rawToken, 'verify_email');
    if (!userId) {
      throw new BadRequestException('Enlace de verificación no válido o caducado.');
    }
    const user = await this.users.findById(userId);
    if (!user) throw new BadRequestException('Enlace de verificación no válido.');

    if (!user.emailVerifiedAt) {
      user.emailVerifiedAt = new Date();
      await this.users.save(user);
    }
    return this.toPublicUser(user);
  }

  /** Siempre responde igual: no confirmamos si el email existe o no. */
  async resendVerification(email: string): Promise<void> {
    const user = await this.users.findByEmail(email);
    if (user && !user.emailVerifiedAt) await this.sendVerification(user);
  }

  private async sendVerification(user: User): Promise<void> {
    const token = await this.tokens.createAuthToken(user.id, 'verify_email', VERIFY_TTL_MS);
    const link = `${this.appUrl}/?verify_token=${encodeURIComponent(token)}`;
    await this.mail.sendVerificationEmail(user.email, user.name, link);
  }

  /* ============================================================
     Reseteo de contrasena
     ============================================================ */

  /**
   * Responde 204 pase lo que pase. Si dijeramos "ese email no existe"
   * tendriamos un oraculo para enumerar cuentas registradas.
   */
  async forgotPassword(email: string): Promise<void> {
    const user = await this.users.findByEmail(email);
    if (!user) {
      this.log.log(`Reset pedido para email no registrado; no se envía nada.`);
      return;
    }
    const token = await this.tokens.createAuthToken(user.id, 'reset_password', RESET_TTL_MS);
    const link = `${this.appUrl}/?reset_token=${encodeURIComponent(token)}`;
    await this.mail.sendPasswordResetEmail(user.email, user.name, link);
  }

  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const userId = await this.tokens.consumeAuthToken(rawToken, 'reset_password');
    if (!userId) {
      throw new BadRequestException('Enlace de reseteo no válido, usado o caducado.');
    }
    const user = await this.users.findById(userId);
    if (!user) throw new BadRequestException('Enlace de reseteo no válido.');

    user.passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    user.tokenVersion += 1;
    if (!user.emailVerifiedAt) {
      // Abrir el enlace prueba que controla el buzon, asi que damos el email
      // por verificado de paso.
      user.emailVerifiedAt = new Date();
    }
    await this.users.save(user);
    // Quien pide un reset suele haber perdido el control de la cuenta: al
    // completarlo se cierra todo lo que hubiera abierto.
    await this.tokens.revokeAllForUser(user.id);
    await this.mail.sendPasswordChangedEmail(user.email, user.name);
  }

  /* ============================================================
     Internos
     ============================================================ */

  /** Login/signup correctos: familia de refresh nueva + access token nuevo. */
  private async startSession(user: User, ctx: TokenContext): Promise<AuthResult> {
    const issued = await this.tokens.issueRefresh(user.id, ctx);
    return {
      user: this.toPublicUser(user),
      tokens: {
        accessToken: this.signAccessToken(user),
        accessMaxAgeMs: this.accessTtlMs,
        refreshToken: issued.token,
        refreshExpiresAt: issued.expiresAt,
        csrfToken: newCsrfToken(),
      },
    };
  }

  private signAccessToken(user: User): string {
    const payload: JwtPayload = {
      sub: user.id, email: user.email, tv: user.tokenVersion,
    };
    return this.jwt.sign(payload, { expiresIn: `${Math.floor(this.accessTtlMs / 1000)}s` });
  }

  private toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      gender: (user.gender as 'masculino' | 'femenino' | null) ?? null,
      emailVerified: user.emailVerifiedAt != null,
      createdAt: user.createdAt.toISOString(),
    };
  }
}

function newCsrfToken(): string {
  return randomBytes(24).toString('base64url');
}

/**
 * Hash bcrypt real de una contrasena que no es de nadie. Solo existe para
 * gastar el mismo tiempo de CPU cuando el email no esta registrado.
 */
const DUMMY_HASH = '$2b$12$C6UzMDM.H6dfI/f/IKcEe.4rMBjJmFqRTsC/JIVBQtb2Vf3g8pQ0a';
