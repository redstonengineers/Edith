# EDITH

Plataforma SaaS white-label para negocios con alumnos o pacientes (academias, autoescuelas, clínicas, gimnasios…): alumnos, grupos y horarios, prácticas y coches, asistencia, exámenes, matrículas, cobros, avisos por WhatsApp, informes y asistente de IA, con marca y vocabulario propios por negocio y un aspecto que cambia según la suscripción.
React 19 + TypeScript + Vite + Tailwind v4 en el navegador · Fastify + SQLite (`node:sqlite`) en el servidor · PWA que abre sin conexión.

Arquitectura y modelo de datos: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · servidor, seguridad, copias y restauración: [`docs/BACKEND.md`](docs/BACKEND.md) · estado y pendientes: [`docs/PENDIENTES.md`](docs/PENDIENTES.md).

## Estado real
- Está en producción un solo servicio (`edith`, Coolify, despliegue automático al subir a `main`) que sirve la app y la API.
- Hay **dos modos**: **local** (datos en el navegador, para desarrollo y pruebas) y **API** (servidor con SQLite, sesiones por cookie, validación y aislamiento por negocio en el servidor).
- Los datos personales y de salud se **cifran en la base** (AES-256-GCM); en producción el servidor no arranca sin `DATA_ENCRYPTION_KEY`.
- Un solo proceso y SQLite: válido para empezar y para decenas de negocios; PostgreSQL con RLS queda como paso posterior (ver `docs/PENDIENTES.md`).

## Cómo arrancar
Requiere Node ≥ 22.5 (usa `node:sqlite`).

```bash
npm ci
npm run dev                 # modo local: http://localhost:5173 (datos en el navegador)
```

Modo API (servidor real) en desarrollo:

```bash
SEED_DEMO=1 PERSONAL_PASSWORD=pon-una-clave npm run server   # API en :4000 con datos de demostración (sin cifrar y sin DATA_ENCRYPTION_KEY: solo desarrollo)
npm run dev:api                                              # Vite en modo API (proxy /api → :4000)
```

Producción (lo que hace el `Dockerfile`): `npm run build:api && npm run build:server && npm start` (ejecuta `node dist-server/index.js`; no usa `tsx`).

## Acceso
- **Demos** (Atlanta, Academia, Clínica): sin contraseña. `/login` muestra tres tarjetas; pulsar un perfil entra directamente.
- **Clientes**: correo y contraseña en `/login`. Solo el propietario los da de alta (panel **Clientes → Nuevo cliente** del modo personal, o `npm run client:new`); la contraseña se genera una vez y se cambia en el primer acceso.
- **Modo personal** (`/personal`): usuario y contraseña propios (`PERSONAL_PASSWORD`, solo en las variables de Coolify).

## Variables de entorno
| Variable | Para qué |
| --- | --- |
| `DATA_ENCRYPTION_KEY` | **Obligatoria en producción.** Clave de cifrado (32 bytes en base64: `openssl rand -base64 32`). |
| `DATA_ENCRYPTION_KEY_PREVIOUS` | Claves anteriores, separadas por comas, durante una rotación. |
| `PERSONAL_PASSWORD` | Contraseña del modo personal. |
| `TENANTS=1`, `PROVISION_ACADEMY_NAME`, `PROVISION_ADMIN_EMAIL` | Preparan las demos y Atlanta al arrancar. |
| `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD` | Cuenta del propietario de la plataforma (Super Admin) en una base nueva. |
| `BACKUP_HOURS` (24), `BACKUP_KEEP` (7), `BACKUP_DIR` | Copias locales. |
| `BACKUP_S3_ENDPOINT`, `BACKUP_S3_BUCKET`, `BACKUP_S3_KEY`, `BACKUP_S3_SECRET`, `BACKUP_S3_REGION` | Subida opcional de cada copia a un almacenamiento compatible con S3. |
| `SENTRY_DSN` | Informe de errores opcional (servidor y navegador, sin datos de personas). |
| `RESEND_API_KEY`, `MAIL_FROM` · `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_TEMPLATE` · `ANTHROPIC_API_KEY` | Correo, WhatsApp Business y asistente con Claude. |
| `SESSION_HOURS` (12), `REMEMBER_DAYS` (30), `LOGIN_FAILS_PER_IP` (30), `API_RATE_PER_MINUTE` (600), `DEMO_RATE_PER_HOUR` (40), `ACCESS_LOG_DAYS` (730), `DEMO_RESET_HOUR`, `DEMO_RESET_DAILY=0` | Ajustes finos. |
| `PORT`, `HOST`, `DB_PATH`, `TRUST_PROXY`, `COOKIE_SECURE`, `STATIC_DIR` | Despliegue. |

La lista completa y su efecto, en `docs/BACKEND.md` y `docs/PENDIENTES.md` (sección «Variables de Coolify»).

## Scripts
| Comando | Qué hace |
| --- | --- |
| `npm run typecheck` · `npm run typecheck:server` | Tipos del navegador y del servidor. |
| `npm run build` · `npm run build:api` · `npm run build:server` | Compila la app (local), la app (API) y el servidor a `dist-server/`. |
| `npm test` | **Todas** las pruebas (`tests/run-all.mjs`): unitarias, API/seguridad y e2e en modo API y local, más accesibilidad con axe. `--only a,b` para elegir. |
| `npm run test:unit` · `test:api` · `test:e2e` · `test:a11y` | Por grupos. Las e2e necesitan `npx playwright install chromium`. |
| `npm run client:new` · `demo:reset` · `backup:verify -- <archivo>` | Alta de cliente, restauración de demos y comprobación de una copia. |

CI: `.github/workflows/ci.yml` ejecuta en cada push y pull request `npm ci`, tipos, compilación, `npm audit`, todas las pruebas y la construcción de la imagen de Docker.

## Qué incluye
Panel por tipo de negocio · buscador global y comandos (Ctrl+K, atajos `G`+letra) · alumnos/pacientes, profesores, grupos y asignaturas · calendario (día/semana/mes, arrastrar, conflictos) · clases · asistencia · exámenes y calificaciones · solicitudes, lista de espera y matrículas (con formulario público) · pagos y facturación · incidencias y documentos · mensajes, avisos y notificaciones · estadísticas e informes (CSV) · asistente de IA · personalización (marca, vocabulario, módulos) · usuarios, permisos por rol y **registro de accesos** · panel Super Admin · portal de alumno/tutor · autoescuelas: coches, prácticas 1 a 1, firma táctil, parte mensual, exámenes de conducir y modo sin conexión.

## Estructura
```
src/        app (components, pages, config, lib) y dominio compartido con el servidor (services, data, types)
server/     API Fastify, cifrado, copias, colas por negocio, acceso demo/clientes, modo personal
tests/      unitarias, API y e2e (Playwright);  tests/run-all.mjs las lanza todas
docs/       ARCHITECTURE, BACKEND, PENDIENTES, VERTICALES, WHATSAPP, planes y precios
```
