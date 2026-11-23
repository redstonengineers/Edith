# Backend (modo API)

Servidor Node (Fastify) que **reutiliza la misma lógica de dominio** que el navegador (`src/services/mutations.local.ts`,
`src/services/repositories`, `src/lib`): una sola fuente de verdad para reglas de negocio, permisos y aislamiento.

```
Navegador (React)  ──cookie httpOnly──▶  /api/*  ──▶  validación Zod ─▶ mutación de dominio (permisos + tenant) ─▶ SQLite
```

## Arranque
```bash
# Desarrollo con datos demo (negocios isDemo: se entra sin contraseña por /api/auth/demo):
SEED_DEMO=1 npm run server          # API en :4000 (con BOOTSTRAP_ADMIN_* también hay propietario de plataforma)
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
`POST /api/auth/demo` (demos abiertas, sin contraseña) · `POST /api/auth/login|logout|password` (clientes) · `GET /api/auth/me` · `GET /api/snapshot` (datos acotados a tu rol y academia) ·
`POST /api/rpc/:operación` (cuerpo `{args:[…]}`; el usuario sale de la sesión) · `POST /api/onboarding` (**cerrado**: solo con la sesión personal del propietario; ver «Acceso») ·
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
npm run test:api                                           # comprobaciones de seguridad de la API (con PERSONAL_PASSWORD y BOOTSTRAP_ADMIN_*, ver la cabecera del test)
node tests/acceso.mjs                                      # modelo de acceso (arranca su propio servidor y proveedores falsos)
npx tsx tests/acceso-migracion.ts                          # migración de isDemo y arranque que no toca clientes
npm run dev:api &  APP_URL=http://127.0.0.1:5174 node tests/e2e/api-mode.cjs
npm run dev &      for f in tests/e2e/phase*.cjs; do node $f; done   # modo demo (requiere playwright)
npm run test:a11y                                          # axe WCAG A/AA
```

## Acceso: demos abiertas y clientes (dos vías independientes)

### 1. Demos abiertas, sin contraseña (`isDemo`)
- **Atlanta, Academia y Clínica** son demos con datos ficticios. Cada negocio tiene un campo explícito `Academy.isDemo` (nada se deduce del slug, del nombre ni del correo). Solo esos tres tienen `isDemo: true`; si Atlanta pasa a ser un cliente real, basta ponerlo en `false` (o usar «Pasar a cliente real» en el panel Clientes del modo personal, que además da una contraseña provisional a su administrador).
- `/login` muestra tres tarjetas que llevan a `/acceso/<negocio>`; **pulsar un perfil entra directamente**: la página llama a `POST /api/auth/demo` con `{ academy, profile }` (slug o id del negocio y usuario del perfil). El servidor solo abre sesión si el negocio tiene `isDemo: true` y está activo; en cualquier otro caso → `403`. Nunca se abre sesión de `SUPER_ADMIN` por esta vía.
- Las cuentas de los negocios demo **no tienen contraseña utilizable** (al arrancar se retira cualquiera que exista) y **no entran por `/api/auth/login`**.
- Límites de las sesiones demo: duran como máximo 12 h y no tienen «mantener sesión»; 40 aperturas por hora y por IP; **no envían correo, WhatsApp ni webhook reales** (los avisos se dan por entregados con la nota «Simulado (demo)» y la prueba de canales responde «simulado»); **JARVIS usa siempre el motor local** (nunca `ANTHROPIC_API_KEY`); no pueden ejecutar `setAcademyPlan`, `setAcademyStatus` ni `platformOverview`, y su cookie no abre nada del modo personal.
- **Restauración**: los datos de las demos se regeneran solos cada día a partir de `DEMO_RESET_HOUR` (4:00, zona `NOTICES_TZ`; `DEMO_RESET_DAILY=0` lo desactiva; el primer arranque solo anota el día), con `npm run demo:reset` (servidor parado) o con el botón «Restaurar demos» del panel Clientes. Solo toca negocios `isDemo`, conserva su plan y estado y cierra sus sesiones.
- **Migración al arrancar** (idempotente): marca `isDemo: true` en Atlanta, Academia y Clínica (por su slug, una sola vez y solo si el campo no existe) y en nada más; los demás negocios se listan en el log como «Negocios SIN isDemo» y se tratan como clientes. `provisionTenants` y cualquier arranque solo tocan negocios `isDemo`: nunca modifican cuentas ni contraseñas de clientes.
- Al arrancar con `PROVISION_ACADEMY_NAME` + `PROVISION_ADMIN_EMAIL` (o `TENANTS=1`) se preparan las demos: Atlanta (la academia de ese administrador, con datos ficticios de muestra la primera vez; `ATLANTA_DEMO=0` lo evita), Academia y Clínica, sus módulos y una cuenta por perfil (sin contraseña).

### 2. Clientes, con correo y contraseña
- Entran por `/login` con **correo y contraseña** (`POST /api/auth/login`; el correo es único en toda la plataforma, así que dos clientes nunca chocan aunque tengan administradores con el mismo nombre). «Mantener la sesión iniciada» solo existe aquí (12 h / 30 días).
- **`POST /api/onboarding` ya no es público**: exige la sesión personal del propietario (`401` sin ella). Se crea un cliente desde el panel **Clientes → Nuevo cliente** (nombre, sector, plan y correo del administrador) o con `npm run client:new -- --name "…" --type autoescuela --plan pro --email admin@…` en el servidor. EDITH genera una contraseña aleatoria fuerte (16 caracteres), la muestra **una sola vez** y guarda solo su hash.
- El cliente nace con `isDemo: false`, sin slug (no sale en las tarjetas de demos) y con `mustChangePassword`: en su primer acceso solo puede usar `/api/auth/me`, `/api/auth/password` y `/api/auth/logout` (el resto de la API responde `403 password_change_required`) hasta elegir su contraseña (mín. 8, letras y números; cierra las demás sesiones).
- Reiniciar el servidor no cambia ninguna contraseña de cliente.
- Propietario de la plataforma (Super Admin): cuenta creada con `BOOTSTRAP_ADMIN_EMAIL/PASSWORD` en una base nueva; el modo personal (`/personal`) sigue con su propia contraseña `PERSONAL_PASSWORD` (cookie `ac_personal`, ahora con ruta `/api` para que `/api/onboarding` reconozca la sesión del propietario).

### Variables de entorno (Coolify)
- **Eliminar**: `TENANT_PASSWORD` (ya no existe ninguna contraseña compartida) y `PROVISION_ADMIN_PASSWORD` (ya no se usaba).
- **Se mantienen**: `PROVISION_ACADEMY_NAME`, `PROVISION_ADMIN_EMAIL`, `TENANTS=1`, `PERSONAL_PASSWORD`, `NODE_ENV=production`, `SESSION_HOURS`, `REMEMBER_DAYS`, `ATLANTA_DEMO`, y las claves de Resend, WhatsApp y `ANTHROPIC_API_KEY` (que solo usan los clientes reales, nunca las demos).
- **Opcionales nuevas**: `DEMO_RESET_HOUR` (por defecto 4), `DEMO_RESET_DAILY=0` (desactiva la restauración diaria), `ANTHROPIC_API_BASE` (para pruebas).
- `SEED_DEMO=1` es solo para desarrollo y pruebas.

