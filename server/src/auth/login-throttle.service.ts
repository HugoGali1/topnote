import { Injectable, Logger } from '@nestjs/common';

interface Attempt {
  failures: number;
  lockedUntil: number;   // epoch ms, 0 = no bloqueado
  last: number;
}

const MAX_FAILURES   = 5;          // fallos antes del primer bloqueo
const BASE_LOCK_MS   = 60_000;     // 1 min, se duplica en cada bloqueo sucesivo
const MAX_LOCK_MS    = 3_600_000;  // techo: 1 hora
const FORGET_AFTER_MS = 86_400_000; // olvida cuentas inactivas al día

/**
 * Bloqueo progresivo por cuenta, complementario al rate limit por IP del
 * ThrottlerGuard: un atacante con IPs rotativas esquiva el throttler pero no
 * esto, porque la clave aquí es el email atacado.
 *
 * Estado en memoria a propósito: se pierde al reiniciar (aceptable) y no mete
 * escrituras en el camino crítico del login. Si algún día hay varias réplicas
 * del servidor, esto debe pasar a Redis para ser efectivo.
 */
@Injectable()
export class LoginThrottleService {
  private readonly log = new Logger('LoginThrottle');
  private readonly attempts = new Map<string, Attempt>();

  /** Milisegundos que quedan de bloqueo, o 0 si se puede intentar. */
  retryAfterMs(email: string): number {
    const key = email.toLowerCase();
    const a = this.attempts.get(key);
    if (!a || !a.lockedUntil) return 0;
    const left = a.lockedUntil - Date.now();
    if (left <= 0) {
      a.lockedUntil = 0;
      return 0;
    }
    return left;
  }

  registerFailure(email: string): void {
    const key = email.toLowerCase();
    this.sweep();
    const a = this.attempts.get(key) ?? { failures: 0, lockedUntil: 0, last: 0 };
    a.failures += 1;
    a.last = Date.now();

    if (a.failures >= MAX_FAILURES) {
      // 1º bloqueo 1 min, 2º 2 min, 3º 4 min… hasta 1 h.
      const step = a.failures - MAX_FAILURES;
      const lock = Math.min(BASE_LOCK_MS * 2 ** step, MAX_LOCK_MS);
      a.lockedUntil = Date.now() + lock;
      this.log.warn(
        `Cuenta ${key} bloqueada ${Math.round(lock / 1000)}s tras ${a.failures} fallos.`,
      );
    }
    this.attempts.set(key, a);
  }

  registerSuccess(email: string): void {
    this.attempts.delete(email.toLowerCase());
  }

  private sweep(): void {
    if (this.attempts.size < 5_000) return;
    const cutoff = Date.now() - FORGET_AFTER_MS;
    for (const [k, v] of this.attempts) {
      if (v.last < cutoff && !v.lockedUntil) this.attempts.delete(k);
    }
  }
}
