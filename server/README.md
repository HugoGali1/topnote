# Top Note · Backend (NestJS)

Servidor NestJS para Top Note. Maneja autenticación (cookies httpOnly + JWT
rotatorio), favoritos, historial, búsqueda semántica con embeddings y
re-ranking con un LLM.

## Arquitectura

```
[ Browser SPA ]  ───►  [ NestJS :3001 /api ]  ───►  [ Supabase Postgres ]
   cookies              Auth (cookies + JWT)        · users
   httpOnly             Favorites / History         · refresh_tokens
   + X-CSRF-Token       Recommendations             · auth_tokens
                            ├─► Embeddings          · favorites, history
                            └─► Gemini (ranking)    · perfume_embeddings
```

## Cómo funciona la sesión

Tres cookies, ninguna de ellas manipulable por JavaScript salvo la de CSRF:

| Cookie     | httpOnly | Vida       | Path        | Para qué |
|------------|----------|------------|-------------|----------|
| `tn_at`    | sí       | 15 min     | `/`         | Access token (JWT). Autoriza cada petición. |
| `tn_rt`    | sí       | 30 días    | `/api/auth` | Refresh token opaco. Solo sirve para pedir un `tn_at` nuevo. |
| `tn_csrf`  | **no**   | 30 días    | `/`         | Token CSRF que el front reenvía en `X-CSRF-Token`. |

**Por qué así.** El access token no llega nunca al JavaScript de la página, así
que un XSS no puede robarlo. A cambio, como el navegador manda las cookies solo,
aparece el riesgo de CSRF; de ahí el double-submit: una web atacante puede
provocar la petición, pero no puede *leer* `tn_csrf`, así que no sabe qué poner
en la cabecera.

**Rotación y detección de robo.** Cada uso del refresh token lo revoca y emite
otro de la misma "familia". Si alguien presenta un refresh ya rotado, es que lo
robó (el legítimo ya giró): se revoca la familia entera y ambas partes tienen
que volver a iniciar sesión. Queda un `WARN` en el log del servidor.

**Revocación de access tokens.** `users.token_version` va dentro del JWT como
`tv`. Cambiar la contraseña, resetearla o cerrar todas las sesiones incrementa
esa columna, y cualquier token emitido antes deja de validar al instante — sin
esperar a que expire.

Los clientes que no son navegador (curl, scripts) pueden seguir usando
`Authorization: Bearer <access_token>`; en ese caso no se exige CSRF, porque el
navegador nunca manda esa cabecera por su cuenta.

## Endpoints

Prefijo: `/api`

### Auth

| Método | Ruta                        | Auth | Body                                   | Devuelve |
|--------|-----------------------------|------|----------------------------------------|----------|
| GET    | `/auth/csrf`                | —    | —                                      | `{ csrfToken }` y fija la cookie |
| POST   | `/auth/signup`              | —    | `{ name, email, password, gender? }`   | `{ user, csrfToken }` + cookies |
| POST   | `/auth/login`               | —    | `{ email, password }`                  | `{ user, csrfToken }` + cookies |
| POST   | `/auth/refresh`             | cookie `tn_rt` | —                            | `{ user, csrfToken }` + cookies nuevas |
| POST   | `/auth/logout`              | —    | —                                      | 204, revoca este refresh |
| POST   | `/auth/logout-all`          | JWT  | —                                      | 204, revoca todo y sube `token_version` |
| GET    | `/auth/sessions`            | JWT  | —                                      | sesiones vivas (ip, user-agent, fechas) |
| GET    | `/auth/me`                  | JWT  | —                                      | usuario público |
| PATCH  | `/auth/me`                  | JWT  | `{ name?, email?, gender?, currentPassword?, newPassword? }` | usuario actualizado |
| DELETE | `/auth/account`             | JWT  | `{ password }`                         | 204 (borra usuario y todo lo suyo) |
| POST   | `/auth/verify-email`        | —    | `{ token }`                            | usuario ya verificado |
| POST   | `/auth/resend-verification` | —    | `{ email }`                            | 204 (siempre igual) |
| POST   | `/auth/forgot-password`     | —    | `{ email }`                            | 204 (siempre igual) |
| POST   | `/auth/reset-password`      | —    | `{ token, password }`                  | 204 |

`forgot-password` y `resend-verification` responden 204 exista o no la cuenta:
si distinguieran, servirían para enumerar qué emails están registrados.

### Resto

| Método | Ruta                        | Auth | Devuelve |
|--------|-----------------------------|------|----------|
| GET    | `/favorites`                | JWT  | `{ ids: string[] }` |
| POST   | `/favorites`                | JWT  | `{ ok: true }` |
| POST   | `/favorites/bulk`           | JWT  | `{ inserted, ids }` |
| DELETE | `/favorites/:perfumeId`     | JWT  | 204 |
| GET    | `/history?limit=10`         | JWT  | `{ entries }` |
| POST   | `/history`                  | JWT  | `{ entry }` |
| POST   | `/history/bulk`             | JWT  | `{ inserted, entries }` |
| DELETE | `/history`                  | JWT  | 204 |
| POST   | `/recommendations/rank`     | —    | recomendaciones con razonamiento |

## Límites de peticiones

Global: 120 por minuto y por IP. Encima de eso:

| Rutas                                            | Límite |
|--------------------------------------------------|--------|
| `login`, `signup`, `verify-email`, `reset-password` | 5 / min |
| `forgot-password`, `resend-verification`         | 3 / hora |
| `refresh`                                        | 30 / min |

Además hay un **bloqueo por cuenta**: 5 contraseñas falladas sobre el mismo
email lo bloquean 1 minuto, y cada fallo posterior duplica el tiempo hasta un
techo de 1 hora. El límite por IP no basta contra un atacante con IPs
rotativas; este sí, porque la clave es el email atacado.

> Ese contador vive en memoria: se pierde al reiniciar y no se comparte entre
> réplicas. Si algún día el servidor corre en más de un proceso, hay que
> moverlo a Redis para que siga sirviendo de algo.

## Setup

### 1. Base de datos

Crea un proyecto en [supabase.com](https://supabase.com), coge el connection
string del **Connection pooler (Transaction)** — puerto **6543** — en
*Settings → Database → Connection string → URI*.

### 2. `.env`

```powershell
cd server
copy .env.example .env
```

Rellena como mínimo `DATABASE_URL`, `JWT_SECRET` y `CORS_ORIGINS`.
`.env.example` explica el resto, opción por opción.

Genera el secreto con:

```powershell
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 3. Arrancar

```powershell
npm install
npm run start:dev
```

Las migraciones se aplican solas al arrancar (`RUN_MIGRATIONS=true`). Son
idempotentes: sobre una base de datos que ya tenía las tablas no tocan nada.

### 4. Comprobar

```powershell
curl http://localhost:3001/api/auth/me
# → 401 Unauthorized (esperado sin sesión)
```

## Esquema y migraciones

`synchronize` está en **false**: el esquema lo gobiernan las migraciones de
`src/migrations`, no el arranque del servidor.

```powershell
npm run migration:show      # qué hay aplicado
npm run migration:run       # aplicar pendientes
npm run migration:revert    # deshacer la última
npm run migration:generate -- src/migrations/NombreDelCambio
```

Migraciones actuales:

- `BaselineSchema` — `users`, `favorites`, `history` tal y como los dejó el
  antiguo `synchronize: true`. Todo con `IF NOT EXISTS`, para poder adoptarlo
  sobre una base de datos que ya existía. No es reversible a propósito:
  deshacerlo borraría todas las cuentas.
- `AuthHardening` — `email_verified_at` y `token_version` en `users`, más las
  tablas `refresh_tokens` y `auth_tokens`. Marca como verificadas las cuentas
  anteriores a la verificación, para no dejar fuera a quien ya estaba dentro.

## Email

`MAIL_DRIVER=console` (por defecto) **no envía nada**: escribe el enlace en el
log del servidor. Sirve para desarrollar sin dar de alta un SMTP.

Para producción, `MAIL_DRIVER=smtp` con `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`
y `SMTP_PASS`. Vale cualquier proveedor (Resend, Postmark, SES, Gmail…).

Un fallo de envío no tumba el signup ni el reseteo: se registra en el log y la
petición sigue. Si delatáramos el fallo por email, tendríamos otra vía para
saber qué direcciones existen.

## Antes de exponerlo en internet

- [ ] `MAIL_DRIVER=smtp` con credenciales reales.
- [ ] `REQUIRE_EMAIL_VERIFICATION=true` (con SMTP funcionando, no antes).
- [ ] `COOKIE_SECURE=true` y HTTPS de verdad.
- [ ] `COOKIE_SAMESITE`: `lax` si el front y la API comparten dominio raíz
      (con `COOKIE_DOMAIN=.tudominio.com`); `none` si están en dominios
      distintos — y entonces `COOKIE_SECURE=true` es obligatorio.
- [ ] `TRUST_PROXY=true` si hay un proxy o CDN delante, para que el rate limit
      vea la IP real y no la del proxy.
- [ ] `CORS_ORIGINS` con los dominios exactos del front. El servidor se niega a
      arrancar si está vacío: con cookies de sesión no se puede abrir la API a
      cualquier origen.
- [ ] `JWT_SECRET` distinto del de desarrollo.
- [ ] Considera `RUN_MIGRATIONS=false` y lanzar las migraciones desde el
      pipeline de despliegue, para que dos réplicas no compitan por aplicarlas.

## Notas de seguridad

- **bcrypt** con 12 rounds. Cuando el email no existe se compara igualmente
  contra un hash de pega, para que el tiempo de respuesta no delate qué cuentas
  están registradas.
- **Tokens hasheados**: de los refresh tokens y de los tokens de email solo se
  guarda su SHA-256. Un volcado de la base de datos no da tokens usables.
- **Tokens de email de un solo uso**, con caducidad (24 h para verificar, 1 h
  para resetear) y uno vivo como mucho por propósito: pedir otro invalida el
  anterior.
- **Resetear la contraseña cierra todas las sesiones** y da el email por
  verificado — abrir el enlace ya demuestra que controlas el buzón.
- `class-validator` con `whitelist` + `forbidNonWhitelisted`: los campos que no
  estén declarados en el DTO hacen fallar la petición.
