/**
 * Convierte duraciones tipo "15m", "30d", "7d", "900s" a milisegundos.
 * Un número pelado se interpreta como segundos (misma convención que jsonwebtoken).
 */
export function parseDuration(value: string | undefined, fallbackMs: number): number {
  if (!value) return fallbackMs;
  const m = /^(\d+)\s*(ms|s|m|h|d)?$/.exec(value.trim());
  if (!m) return fallbackMs;
  const n = Number(m[1]);
  switch (m[2]) {
    case 'ms': return n;
    case 'm':  return n * 60_000;
    case 'h':  return n * 3_600_000;
    case 'd':  return n * 86_400_000;
    case 's':
    default:   return n * 1000;
  }
}
