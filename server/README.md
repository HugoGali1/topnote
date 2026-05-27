# Top Note · Backend (NestJS)

Servidor NestJS para Top Note. Maneja autenticación (JWT), favoritos, historial,
búsqueda semántica con embeddings (Voyage AI) y re-ranking con Claude.

## Arquitectura

```
[ Browser SPA ]  ───►  [ NestJS :3000 /api ]  ───►  [ Supabase Postgres ]
                       Auth (JWT, bcrypt)         · users
                       Favorites / History        · favorites, history
                       Recommendations            · perfume_embeddings (pgvector)
                          ├─► Voyage AI  (embeddings)
                          └─► Anthropic Claude (ranking)
```

## Endpoints

Prefijo: `/api`

| Método | Ruta               | Auth | Body                                   | Devuelve                                  |
|--------|--------------------|------|----------------------------------------|-------------------------------------------|
| POST   | `/auth/signup`     | —    | `{ name, email, password }`            | `{ token, user }`                         |
| POST   | `/auth/login`      | —    | `{ email, password }`                  | `{ token, user }`                         |
| GET    | `/auth/me`         | JWT  | —                                      | `{ id, email, name, createdAt }`          |
| PATCH  | `/auth/me`         | JWT  | `{ name?, email?, currentPassword?, newPassword? }` | usuario actualizado          |
| DELETE | `/auth/account`    | JWT  | `{ password }`                         | 204 (borra usuario + favs + history)      |
| POST   | `/recommendations/search` | — | `{ query, familia?, gender?, season?, limit? }` | top 80 IDs por similitud semántica |
| POST   | `/recommendations/rank`   | — | `{ query, filters?, candidates }`     | 3–5 con score y razonamiento (Claude)   |
| GET    | `/recommendations/similar/:perfumeId` | — | `?limit=12`                  | vecinos en embedding space                |
| GET    | `/favorites`       | JWT  | —                                      | `{ ids: string[] }`                       |
| POST   | `/favorites`       | JWT  | `{ perfumeId }`                        | `{ ok: true }`                            |
| DELETE | `/favorites/:id`   | JWT  | —                                      | 204                                       |
| GET    | `/history`         | JWT  | query `?limit=10`                      | `{ entries: HistoryEntry[] }`             |
| POST   | `/history`         | JWT  | `{ query, filters? }`                  | `{ entry }`                               |
| DELETE | `/history`         | JWT  | —                                      | 204 (borra todo el historial del usuario) |

Auth: `Authorization: Bearer <token>`.

## Setup

### 1. Crear proyecto Supabase

1. Entra en [supabase.com](https://supabase.com) y crea cuenta gratis.
2. **New project** → elige región cercana (eu-west-1 / eu-central-1 si estás
   en Europa) y define la **Database password** (guárdala, la necesitas).
3. Espera a que el proyecto se aprovisione (~1–2 min).
4. **Settings → Database → Connection string → URI**. Copia el connection
   string del **Connection pooler (Transaction)** — puerto **6543**:
   ```
   postgresql://postgres.[REF]:[PASSWORD]@aws-0-eu-west-1.pooler.supabase.com:6543/postgres
   ```
   Sustituye `[PASSWORD]` por la contraseña real.

### 2. Configurar `.env`

```powershell
cd server
copy .env.example .env
```

Edita `.env` y rellena:

- `DATABASE_URL` con el string del paso 1.
- `JWT_SECRET` con un valor largo y aleatorio (genéralo con
  `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`).
- `CORS_ORIGINS` si sirves el front en otro puerto (por defecto :8000).

### 3. Instalar y arrancar

```powershell
npm install
npm run start:dev
```

La primera vez TypeORM crea las tablas `users`, `favorites`, `history` en
Supabase (gracias a `synchronize: true` en `app.module.ts`).

> Para producción, cambia `synchronize: false` y usa migraciones de TypeORM
> (`npm run typeorm migration:generate ...`).

### 4. Verifica que vive

```powershell
curl http://localhost:3000/api/auth/me
# → 401 Unauthorized  (esperado sin token)
```

```powershell
curl -X POST http://localhost:3000/api/auth/signup `
  -H "Content-Type: application/json" `
  -d "{ \"name\": \"Hugo\", \"email\": \"h@example.com\", \"password\": \"secreto123\" }"
# → { "token": "...", "user": { ... } }
```

## Notas de seguridad

- **bcrypt** con 12 rounds para passwords.
- **JWT** firmado con `JWT_SECRET` (cámbialo en producción).
- `class-validator` + `whitelist: true` rechaza campos inesperados.
- CORS restringido a `CORS_ORIGINS`.
- SSL automático para conexiones a Supabase.
- En `dev` se usa `synchronize: true` (TypeORM crea/actualiza el schema). En
  prod usa migraciones explícitas.
