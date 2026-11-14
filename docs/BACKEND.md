# Backend (modo API)

Servidor Node (Fastify) que **reutiliza la misma lógica de dominio** que el navegador (`src/services/mutations.local.ts`,
`src/services/repositories`, `src/lib`): una sola fuente de verdad para reglas de negocio, permisos y aislamiento.

```
Navegador (React)  ──cookie httpOnly──▶  /api/*  ──▶  validación Zod ─▶ mutación de dominio (permisos + tenant) ─▶ SQLite
```

## Arranque
```bash
# Desarrollo con datos demo (contraseña "demo"):
SEED_DEMO=1 npm run server          # API en :4000
npm run dev:api                      # Vite en modo API (proxy /api → :4000)

# Producción: sin SEED_DEMO; crea el Super Admin con BOOTSTRAP_ADMIN_EMAIL/PASSWORD.
NODE_ENV=production BOOTSTRAP_ADMIN_EMAIL=... BOOTSTRAP_ADMIN_PASSWORD=... npm run server
npm run build:api                    # frontend (servir con un proxy inverso HTTPS que enrute /api al servidor)
```
Requiere Node ≥ 22.5 (`node:sqlite`).

## Modelo de seguridad (lo que aplica el servidor)
| Amenaza | Medida |
|---|---|
| Identidad | Sesión por cookie `HttpOnly` + `SameSite=Lax` (+ `Secure` en producción). En BD solo se guarda el **hash** del token. Cada petición revalida usuario activo y academia activa (desactivar/suspender corta sesiones al instante). |
| Contraseñas | scrypt con sal aleatoria y comparación en tiempo constante; nunca salen en respuestas ni en el snapshot. |
| Fuerza bruta / enumeración | 8 fallos / 15 min por IP+correo (los aciertos no cuentan), mismo mensaje y trabajo de hash para correo inexistente, límite global por IP. |
| CSRF | Cabecera `X-Requested-With` obligatoria en peticiones que modifican datos + comprobación de `Origin`; sin CORS habilitado. |
| Multi-tenant | `academyId` sale de la sesión, jamás del cuerpo. Toda lectura/escritura filtra por tenant; una entidad de otra academia se trata como inexistente. |
| Mass assignment | Cada operación tiene un esquema Zod que **descarta claves desconocidas** (no se puede enviar `academyId`, `role`, `id`…). Si una operación no tiene esquema, el servidor no arranca. |
| Privilegios | Cada operación comprueba el permiso del rol (matriz por academia) en servidor; operaciones de plataforma solo para `SUPER_ADMIN`. |
| Abuso de entrada | Límite de cuerpo 1 MB, tipos y tamaños validados, cabeceras `nosniff`, `X-Frame-Options`, `no-store`. |
| IA | `POST /api/ai/chat` construye el contexto en el servidor con el alcance del usuario; la clave de un modelo real irá solo aquí (variable de entorno del servidor). |

## API
`POST /api/auth/login|logout` · `GET /api/auth/me` · `GET /api/snapshot` (datos acotados a tu rol y academia) ·
`POST /api/rpc/:operación` (cuerpo `{args:[…]}`; el usuario sale de la sesión) · `POST /api/onboarding` (alta pública, limitada) ·
`POST /api/ai/chat` · `GET /api/health` · `GET /api/demo-accounts` (solo con `SEED_DEMO=1`).
Errores de negocio → `422 {error}`; validación → `400`; sesión → `401`; permisos/CSRF → `403`; límite → `429`.

## Persistencia
SQLite (WAL). Tabla `entities (tbl, id, academy_id, body JSON)` con índice `(academy_id, tbl)`; el dominio se mantiene en memoria
y solo se vuelcan las filas modificadas, en una transacción. Si una operación falla a medias, el estado se restaura desde disco.

## Límites conocidos (hacia PostgreSQL y varias instancias)
- Un solo proceso: las operaciones se serializan y el estado vive en memoria. Para escalar horizontalmente hay que pasar a
  consultas por petición contra PostgreSQL (mismas claves `tbl/id/academy_id` → tablas reales + **Row Level Security** con
  `current_setting('app.academy_id')`) y mover sesiones y limitadores a Redis/BD.
- `GET /api/snapshot` devuelve todo el alcance del usuario; con academias grandes habrá que paginar por recurso.
- Los documentos guardan solo metadatos; falta almacenamiento S3-compatible con URLs firmadas.
- Canales email/WhatsApp/SMS/push y proveedor de IA real: interfaces listas, sin proveedor conectado.
- Sin recuperación de contraseña por correo, MFA ni registro de intentos en BD (solo en memoria).
- No hay migraciones versionadas: el esquema es una tabla genérica; al pasar a Postgres se definirán.

## Pruebas
```bash
rm -f data/academy.db*; SEED_DEMO=1 npm run server &      # base nueva
npm run test:api                                           # 50 comprobaciones de seguridad de la API
npm run dev:api &  APP_URL=http://127.0.0.1:5174 node tests/e2e/api-mode.cjs
npm run dev &      for f in tests/e2e/phase*.cjs; do node $f; done   # modo demo (requiere playwright)
npm run test:a11y                                          # axe WCAG A/AA
```
