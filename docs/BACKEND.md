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

# Producción: servidor compilado a JavaScript (no se ejecuta tsx). Sin SEED_DEMO; el Super Admin sale de BOOTSTRAP_ADMIN_*.
npm run build:api && npm run build:server
NODE_ENV=production DATA_ENCRYPTION_KEY=$(openssl rand -base64 32) BOOTSTRAP_ADMIN_EMAIL=... BOOTSTRAP_ADMIN_PASSWORD=... npm start   # node dist-server/index.js
# (la clave se genera UNA vez y se guarda: sin ella no se pueden leer los datos cifrados)
```
Requiere Node ≥ 22.5 (`node:sqlite`).

## Modelo de seguridad (lo que aplica el servidor)
| Amenaza | Medida |
|---|---|
| Identidad | Sesión por cookie `HttpOnly` + `SameSite=Lax` (+ `Secure` en producción). En BD solo se guarda el **hash** del token. Cada petición revalida usuario activo y academia activa (desactivar/suspender corta sesiones al instante). |
| Contraseñas | scrypt con sal aleatoria y comparación en tiempo constante; nunca salen en respuestas ni en el snapshot. |
| Fuerza bruta / enumeración | 8 fallos / 15 min por IP+correo (los aciertos no cuentan), **30 fallos / 15 min por IP en total** (`LOGIN_FAILS_PER_IP`; frena probar muchas cuentas distintas desde una red), mismo mensaje y trabajo de hash para correo inexistente, y 600 peticiones/min a `/api` por IP (`API_RATE_PER_MINUTE`; los archivos estáticos no cuentan). |
| CSRF | Cabecera `X-Requested-With` obligatoria en peticiones que modifican datos + comprobación de `Origin`; sin CORS habilitado. |
| Multi-tenant | `academyId` sale de la sesión, jamás del cuerpo. Toda lectura/escritura filtra por tenant; una entidad de otra academia se trata como inexistente. |
| Mass assignment | Cada operación tiene un esquema Zod que **descarta claves desconocidas** (no se puede enviar `academyId`, `role`, `id`…). Si una operación no tiene esquema, el servidor no arranca. |
| Privilegios | Cada operación comprueba el permiso del rol (matriz por academia) en servidor; operaciones de plataforma solo para `SUPER_ADMIN`. |
| Abuso de entrada | Límite de cuerpo 1 MB, tipos y tamaños validados, cabeceras `nosniff`, `X-Frame-Options`, `no-store`. |
| Cabeceras | `Strict-Transport-Security` (producción), `Permissions-Policy` restrictiva (micrófono solo propio, para la voz del modo personal), CSP: `default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'` (+ el host del DSN de Sentry en `connect-src` si existe). Todo en `server/security.ts`. |
| Datos en reposo | Cifrado de campos sensibles con AES-256-GCM (ver «Cifrado de datos»). |
| Acceso a datos de personas | Registro de accesos (ver «Registro de accesos»). |
| IA | `POST /api/ai/chat` construye el contexto en el servidor con el alcance del usuario; la clave de un modelo real irá solo aquí (variable de entorno del servidor). |

## API
`POST /api/auth/demo` (demos abiertas, sin contraseña) · `POST /api/auth/login|logout|password` (clientes) · `GET /api/auth/me` · `GET /api/snapshot` (datos acotados a tu rol y academia; `?part=core` = todo salvo alumnos/asistencia/pagos/prácticas, que se piden con `?part=<nombre>&offset=&limit=` → `{rows,total}`) · `POST /api/access-log` y `GET /api/access-log` (solo administrador) ·
`POST /api/rpc/:operación` (cuerpo `{args:[…]}`; el usuario sale de la sesión) · `POST /api/onboarding` (**cerrado**: solo con la sesión personal del propietario; ver «Acceso») ·
`POST /api/ai/chat` · `GET /api/health` (base de datos, última copia, cifrado) · `GET /api/public/config` (DSN público de Sentry) · `GET /api/demo-accounts` (solo con `SEED_DEMO=1`).
Errores de negocio → `422 {error}`; validación → `400`; sesión → `401`; permisos/CSRF → `403`; límite → `429`.

## Persistencia
SQLite (WAL). Tabla `entities (tbl, id, academy_id, body JSON)` con índice `(academy_id, tbl)`; el dominio se mantiene en memoria
y solo se vuelcan las filas modificadas, en una transacción. Además: `sessions`, `personal` (modo personal), `meta` (claves-valor, p. ej. resultado de la última copia) y `access_log`.

### Colas de escritura por negocio
Cada operación de un negocio entra en la cola de **su** `academyId` (`server/queues.ts`): las de un mismo negocio van de una en una (cada operación es atómica respecto a las demás de su negocio) y negocios distintos avanzan en paralelo. Las operaciones que tocan la plataforma o varios negocios (altas de clientes, cambios de plan, restauración de demos, RPC del Super Admin) usan `runAll`: esperan a que acaben todas las colas, se ejecutan solas y las nuevas esperan a que terminen. La verificación de contraseñas (lenta a propósito) se hace fuera de las colas.
Si una operación falla a medias, **solo se revierte ese negocio** desde disco (`Store.rollbackAcademy`, en sitio; los demás negocios no se tocan). Límite conocido: una operación que modifica y luego espera (`await`) antes de fallar podría haber sido guardada a medias por el volcado de otro negocio; las mutaciones actuales calculan lo asíncrono (hashes) antes de modificar. Test: `tests/colas.ts`.

### Cifrado de datos
- `server/fieldcrypto.ts`: AES-256-GCM por campo. Valor guardado: `enc:v1:<idClave>:<iv>:<tag>:<texto>`; el texto cifrado es el JSON del valor, así que se recupera su tipo. Los campos están en `SENSITIVE` (alumnos: correo, teléfono, fecha de nacimiento, notas…; tutores; profesores; usuarios: correo; lista de espera; solicitudes de matrícula; mensajes; incidencias; avisos; notas de prácticas) y el estado del modo personal se cifra entero.
- La clave sale de `DATA_ENCRYPTION_KEY` (32 bytes en base64). **En producción el servidor no arranca sin ella**; en desarrollo avisa y guarda sin cifrar. Sin clave, una base cifrada no se lee (error claro).
- **Migración idempotente**: al cargar, toda fila con campos en claro o cifrados con otra clave se marca y se reescribe cifrada en el primer volcado (el log dice «Cifrado: N registros…»). Una segunda ejecución no cambia nada.
- **Rotación**: define la clave nueva en `DATA_ENCRYPTION_KEY` y la antigua en `DATA_ENCRYPTION_KEY_PREVIOUS`; al arrancar se re-cifra todo con la nueva; después se puede quitar la antigua.
- Las copias de seguridad contienen los datos ya cifrados: **sin la clave no sirven**. Guarda la clave aparte (gestor de contraseñas), nunca solo en Coolify.
- Limitación: los índices (`academy_id`, `tbl`, `id`) y los campos no sensibles (nombres, estados, importes) van en claro; las búsquedas se hacen en memoria, no en SQL.

### Registro de accesos
`access_log (ts, academy_id, user_id, user_name, role, action, entity, entity_id, subject, detail)`. El navegador avisa (`POST /api/access-log`) al abrir una ficha de alumno/paciente, al exportar un CSV y al abrir un informe; el servidor valida que la persona es del mismo negocio, ignora a alumnos y tutores y guarda el nombre de la persona **cifrado**. El administrador lo ve en **Registro de accesos** (filtro por usuario y fecha). Retención: `ACCESS_LOG_DAYS` (730). Test: `tests/e2e/registro-accesos.cjs`.

### Copias de seguridad
1. Cada `BACKUP_HOURS` (24) se hace una copia consistente (`VACUUM INTO`) en `BACKUP_DIR` (por defecto `data/backups`, últimas `BACKUP_KEEP`=7).
2. Se **comprueba que es restaurable**: se abre en solo lectura, `PRAGMA integrity_check`, tablas presentes y no vacía.
3. Si hay `BACKUP_S3_ENDPOINT/BUCKET/KEY/SECRET` (+ `BACKUP_S3_REGION`) se sube a `edith/academy-….db` en ese bucket (firma SigV4, direcciones de tipo ruta: R2, B2, AWS, MinIO).
4. El resultado queda en `meta` y `/api/health` lo muestra (`backup.last`, `ageHours`, `ok`, `external`, `stale`; estado `degraded` si la copia falla o es demasiado antigua).

**Restauración**
```bash
# 1. Parar la app (Coolify → Stop) para que nadie escriba.
# 2. Elegir la copia (volumen: /app/data/backups/academy-AAAA-MM-DDT….db, o descargarla del bucket S3).
# 3. Comprobar que es válida (dentro del contenedor, o en local con Node ≥ 22.5):
node dist-server/backup-verify.js /app/data/backups/academy-….db        # en local: npm run backup:verify -- archivo.db
# 4. Sustituirla por la base viva (conserva la actual por si acaso):
mv /app/data/academy.db /app/data/academy.db.antes && rm -f /app/data/academy.db-wal /app/data/academy.db-shm
cp /app/data/backups/academy-….db /app/data/academy.db
# 5. Arrancar con LA MISMA DATA_ENCRYPTION_KEY con la que se hizo la copia (y DATA_ENCRYPTION_KEY_PREVIOUS si se rotó después).
# 6. Comprobar GET /api/health (db: true) y entrar en un negocio.
```
Se pierde lo escrito entre la copia y la parada. Las sesiones de la copia siguen siendo válidas hasta su caducidad.

### `/api/snapshot` por partes
`?part=core` devuelve todo menos `students`, `attendance`, `payments` y `practices` (que van vacías) y un `heavy` con el número de filas de cada una; cada colección grande se pide con `?part=<nombre>&offset=&limit=` (máx. 5000 por trozo) → `{ rows, total }`. El alcance por rol es el mismo (se calcula igual en servidor). Sin `part` devuelve todo, como antes. El navegador pide el núcleo, pinta la app y trae las grandes por trozos de 1000; las pantallas que las usan esperan («Cargando datos…»). Sin conexión se sirve cada parte desde la caché de IndexedDB y, si no la hay (primera vez tras actualizar), la instantánea completa antigua. Test: `tests/e2e/snapshot-partes.cjs` y `tests/e2e/offline.cjs`.

### Topes de plan (servidor)
Los aplican las propias mutaciones (`src/lib/planLimits.ts`, límites en `src/config/plans.ts` según `docs/EDITH-planes-y-precios.pdf`), así que valen en el servidor y en el modo local: alumnos activos (no de baja ni inactivos; crear, importar en lote —todo o nada—, convertir solicitudes y reactivar), usuarios del equipo (administración, secretaría, profesorado; no cuentan alumnos ni tutores) y módulos de pago fuera de plan (`setModules` no deja **activar** un módulo que el plan no incluye; los ya activos se respetan). El mensaje dice el tope, cuántos hay y el plan siguiente, y recuerda que no se pierde ningún dato. El WhatsApp automático no tiene tope (contador de uso razonable). Las sedes no tienen entidad propia todavía: ese tope es comercial.

### Monitorización
`/api/health` comprueba la base de datos (`SELECT 1`, 503 si no responde), la antigüedad de la última copia y si el cifrado está activo. Con `SENTRY_DSN` los errores 5xx y los no capturados del servidor, y los del navegador (`window.onerror`, promesas rechazadas, `ErrorBoundary`), se envían a Sentry con un cliente mínimo por «envelope» (`src/lib/errorReport.ts`): sin usuario, cookies, cabeceras ni cuerpos, URL sin parámetros ni identificadores, y correos, teléfonos, DNI/NIE y cadenas largas tachados del texto. Test: `tests/monitorizacion.ts`.

## Imagen de producción
`Dockerfile` en tres fases: compila web (`build:api`) y servidor (`build:server`, esbuild → `dist-server/*.js`), instala solo dependencias de ejecución (`npm ci --omit=dev`; el frontend y las herramientas de compilación son devDependencies) y ejecuta `node dist-server/index.js`. En el contenedor, las herramientas van compiladas: `node dist-server/new-client.js`, `node dist-server/demo-reset.js`, `node dist-server/backup-verify.js`.

## Límites conocidos (hacia PostgreSQL y varias instancias)
- Un solo proceso: el estado vive en memoria (las colas por negocio mejoran la concurrencia dentro del proceso, pero no permiten varias instancias). Para escalar horizontalmente hay que pasar a
  consultas por petición contra PostgreSQL (mismas claves `tbl/id/academy_id` → tablas reales + **Row Level Security** con
  `current_setting('app.academy_id')`) y mover sesiones y limitadores a Redis/BD. Fuera de esta tanda.
- Los documentos guardan solo metadatos; falta almacenamiento S3-compatible con URLs firmadas.
- Canales de mensajería: WhatsApp Business (Meta) y correo (Resend) listos para conectar con sus claves; proveedor de IA real con `ANTHROPIC_API_KEY`.
- Sin recuperación de contraseña por correo ni MFA.
- No hay migraciones versionadas de esquema: la tabla es genérica; los cambios de datos se hacen con migraciones idempotentes al arrancar (isDemo, cifrado, etiquetas).

## Pruebas
```bash
npm test                      # TODO: unitarias, API, e2e (modo API y local) y accesibilidad. Arranca sus propios servidores con base nueva (tests/run-all.mjs)
npm test -- --only cifrado,colas,planes     # solo algunas (por nombre)
npm run test:unit             # cifrado, colas, planes, monitorización, migración de isDemo
npm run test:api              # seguridad de la API, acceso, cabeceras y /api/snapshot por partes
npm run test:e2e              # Playwright (npx playwright install chromium)
npm run test:a11y             # axe WCAG A/AA, tema claro y oscuro
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

