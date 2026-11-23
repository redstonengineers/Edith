# EDITH — Estado y pendientes

Tres secciones: **A. Hecho**, **B. Pendiente de ti** (cuentas, claves, decisiones) y **C. Pendiente técnico** (lo puedo hacer yo cuando lo pidas).
Sin historial cronológico: cada punto dice cómo está ahora.

---

## B. Pendiente de ti (lo primero, porque bloquea el despliegue)

### B0. Variables de Coolify (app `edith`)

| Variable | Qué hacer | Obligatoria |
| --- | --- | --- |
| `DATA_ENCRYPTION_KEY` | **Definirla ANTES del próximo despliegue.** 32 bytes en base64: `openssl rand -base64 32`. Cifra los datos personales y de salud en la base. **Sin ella, en producción el servidor NO arranca.** Guarda una copia de la clave fuera de Coolify (gestor de contraseñas): si se pierde, los datos cifrados no se pueden recuperar. | **Sí** |
| `DATA_ENCRYPTION_KEY_PREVIOUS` | Solo al rotar la clave: pon aquí la antigua (varias separadas por comas) y la nueva en `DATA_ENCRYPTION_KEY`; al arrancar se re-cifra todo. Después se puede borrar. | No |
| `BACKUP_S3_ENDPOINT`, `BACKUP_S3_BUCKET`, `BACKUP_S3_KEY`, `BACKUP_S3_SECRET` (+ `BACKUP_S3_REGION`, por defecto `us-east-1`) | Copia externa de cada copia diaria (cualquier almacenamiento compatible con S3: Cloudflare R2, Backblaze B2, AWS, MinIO…). Necesita que crees el bucket y una clave de acceso. Sin ellas las copias solo quedan en el volumen. | Recomendada |
| `SENTRY_DSN` | Informe de errores (servidor y navegador, con datos de personas tachados). Necesita una cuenta de Sentry; el DSN es la dirección del proyecto. Sin ella no se envía nada. | No |
| `TENANT_PASSWORD`, `PROVISION_ADMIN_PASSWORD` | **Borrarlas** (ya no existen: las demos no llevan contraseña). | — |
| `PERSONAL_PASSWORD`, `TENANTS=1`, `PROVISION_ACADEMY_NAME`, `PROVISION_ADMIN_EMAIL` | Mantener como están. | Sí |
| `NODE_ENV=production`, `TRUST_PROXY=1` | Ya los pone el `Dockerfile`. | — |
| Opcionales | `DEMO_RESET_HOUR`, `DEMO_RESET_DAILY=0`, `DEMO_RATE_PER_HOUR` (40), `API_RATE_PER_MINUTE` (600), `LOGIN_FAILS_PER_IP` (30), `ACCESS_LOG_DAYS` (730), `ANTHROPIC_API_KEY`/`ANTHROPIC_MODEL`, `RESEND_API_KEY`/`MAIL_FROM`, `WHATSAPP_*`, `NOTIFY_WEBHOOK_*`. | No |

Orden recomendado: 1) definir `DATA_ENCRYPTION_KEY` (y guardarla), 2) desplegar, 3) comprobar en el log «Cifrado: N registros… cifrados» y `GET /api/health` → `"encrypted": true`, 4) (opcional) definir las variables S3 y comprobar `"backup": { "external": true }` tras la primera copia.

### B1. Cuentas y servicios de terceros
- [ ] **S3 para copias externas** (ver tabla). Hasta entonces, si se pierde el volumen se pierden también las copias.
- [ ] **Sentry** (cuenta + proyecto) → `SENTRY_DSN`.
- [ ] **Correo (Resend)**: cuenta, dominio verificado (SPF/DKIM) y `RESEND_API_KEY` + `MAIL_FROM`. Hoy el correo se usa para avisos al equipo por solicitudes de matrícula; los avisos a alumnos son solo por WhatsApp.
- [ ] **WhatsApp automático**: cuenta de WhatsApp Business (Meta), número, plantilla aprobada con un único parámetro `{{1}}` → `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_TEMPLATE` (y `WHATSAPP_LANG`). Sin ellas queda «por enviar» con un toque. Meta puede cobrar por mensaje.
- [ ] **Asistente con Claude**: clave en console.anthropic.com → `ANTHROPIC_API_KEY` (y `ANTHROPIC_MODEL`). Sin clave usa el motor local. Las demos nunca la usan.
- [ ] **Pagos online** (tarjeta, SEPA): Stripe o Redsys; hoy los cobros se registran a mano. De ahí depende la facturación SaaS y el MRR exacto.
- [ ] **Almacenamiento de documentos (Google Drive)**: proyecto de Google Cloud, cuenta de servicio (`GOOGLE_SERVICE_ACCOUNT_JSON`) y carpeta raíz (`DRIVE_ROOT_FOLDER_ID`). Para clínicas, Google Workspace de pago con acuerdo de tratamiento firmado.
- [ ] Token de GitHub con permiso de creación de repos, si quieres que la sesión cree repos por sí sola.

### B2. Decisiones y trámites
- [ ] **Textos legales con un abogado**: política de privacidad, aviso legal y contrato de encargado de tratamiento (RGPD). Imprescindibles al guardar datos de alumnos, menores y, en clínicas, de salud. El formulario público de matrícula debe enlazar la política. El cifrado y el registro de accesos son medidas técnicas; no sustituyen esto.
- [ ] **Qué sectores se venden primero** (hay 18 plantillas, ver `docs/VERTICALES.md`) y precio por sector.
- [ ] **Dominio por cliente** (white-label): subdominio propio (`cliente.edith…`) o dominio del cliente.
- [ ] **Sedes**: el PDF limita a 1 sede en Esencial y Profesional, pero el programa aún no tiene la entidad «sede»; el tope es solo comercial hasta que se decida cómo modelarlas.
- [ ] **Atlanta**: logo definitivo y datos fiscales (el logo actual es de muestra en `public/brand/`). Si Atlanta pasa a ser cliente real, usar «Pasar a cliente real» en el panel Clientes.
- [ ] **Pentest o revisión de seguridad externa** antes de gestionar datos reales de clientes; rotar cualquier credencial compartida fuera de canales seguros.
- [ ] **Probar en un iPad/móvil real** el modo sin conexión (instalar en pantalla de inicio) y la prueba con HTTPS real de la cookie `Secure` y del proxy.
- [ ] Revisar tras desplegar el log de arranque: «isDemo marcado en…» y «Negocios SIN isDemo…» (esos se tratan como clientes; si alguno es una demo, márcalo a mano).

---

## A. Hecho

### Acceso (detalle técnico en `docs/BACKEND.md`)
- **Demos sin contraseña**: Atlanta, Academia y Clínica son los únicos negocios con `isDemo: true`. `/acceso/<negocio>` entra directo con `POST /api/auth/demo`; sus cuentas no tienen contraseña ni entran por `/login`. Sesiones ≤ 12 h, sin envíos reales (correo, WhatsApp, Claude), sin cambios de plan ni de plataforma, límite de aperturas por IP; los datos se restauran cada día o con `npm run demo:reset` / «Restaurar demos» en el panel Clientes.
- **Clientes con contraseña**: `/login` con correo y contraseña. `POST /api/onboarding` solo con tu sesión personal; panel **Clientes → Nuevo cliente** (o `npm run client:new`) genera una contraseña aleatoria que se muestra una vez y obliga a cambiarla en el primer acceso. Los arranques nunca tocan a los clientes.

### Seguridad y datos
- **Cifrado de campos sensibles** (AES-256-GCM, `server/fieldcrypto.ts`): correo, teléfono, fecha de nacimiento y notas de alumnos; datos del tutor; solicitudes de matrícula y lista de espera; teléfonos y correos de profesores; correo de los usuarios; mensajes, incidencias, avisos y el estado del modo personal. El modelo actual **no tiene** campos de DNI, historia clínica ni informes clínicos: están ya previstos en la lista de campos cifrados (`students.dni`, `document`, `clinicalHistory`, `clinicalNotes`, `reports`…) y se cifrarán en cuanto se creen; las notas del paciente sí van cifradas. Migración idempotente al arrancar, rotación con `DATA_ENCRYPTION_KEY_PREVIOUS`, sin clave en producción no arranca. Test: `tests/cifrado.ts` (volcado en bruto sin datos en claro, reinicio, clave equivocada, migración, rotación).
- **Cabeceras**: HSTS (producción), Permissions-Policy restrictiva, CSP con `script-src 'self'`, `object-src 'none'`, `base-uri 'self'`.
- **Límites de acceso**: 8 fallos / 15 min por IP+correo, 30 fallos / 15 min por IP en total, 600 peticiones/min a `/api` por IP, aperturas demo y envíos del formulario público limitados.
- **Registro de accesos**: página **Registro de accesos** (solo administrador) con fichas abiertas, exportaciones CSV e informes, filtrable por usuario y fecha; el nombre de la persona se guarda cifrado; retención `ACCESS_LOG_DAYS`.
- **Copias**: diaria local (7), comprobación de que la copia se abre y es íntegra, subida opcional a S3 firmada (SigV4) y resultado visible en `/api/health`. Restauración documentada en `docs/BACKEND.md`.
- **Monitorización**: `/api/health` (base de datos, antigüedad de la última copia, cifrado) y Sentry opcional con datos de personas tachados.

### Escalado y producción
- Servidor compilado a JavaScript (`dist-server/`) y ejecutado con `node`; imagen de Docker en tres fases, solo dependencias de ejecución, con healthcheck.
- `/api/snapshot?part=core` + colecciones grandes (alumnos, asistencia, pagos, prácticas) por trozos; el modo sin conexión sigue funcionando (caché por parte y vuelta a la instantánea completa).
- Una cola de escritura por negocio (los negocios no se bloquean entre sí; rollback solo del negocio que falla; operaciones de plataforma en exclusiva). Test: `tests/colas.ts`.
- **Topes de plan en el servidor** (según el PDF): Esencial 150 alumnos activos / 4 usuarios del equipo; Profesional 500 alumnos / usuarios ilimitados; Premium sin topes; módulos fuera de plan no se pueden activar desde los ajustes (WhatsApp automático y permisos desde Profesional; Asistente de IA solo Premium). Mensajes claros y sin pérdida de datos. WhatsApp sin tope (contador de uso razonable). Test: `tests/planes.ts`.

### Diseño y textos
- Todo en español y por etiquetas del negocio («Panel de la clínica», «Panel de la autoescuela»…); «SYSTEM ONLINE» sustituido por el estado real (conectado, hora de la última sincronización, sin conexión).
- `PRODUCT_NAME`, `ASSISTANT_NAME` («Asistente») y `PERSONAL_ASSISTANT_NAME` (JARVIS, solo modo personal) en `src/config/brand.ts`.
- Tema claro por defecto y sin efectos HUD en los negocios, mayúsculas espaciadas solo en etiquetas de sección, texto mínimo de 12 px, contraste revisado con axe (claro y oscuro).
- Calendario: títulos completos (varias líneas y tooltip), franja horaria ajustada al horario real del negocio, filtros con el desplegable de la app.
- Móvil: anillo de ocupación reducido y KPIs visibles sin desplazarse.
- Aspecto por suscripción (Profesional y Premium), barra lateral con contenedores, interacciones cuidadas (atajos `G`+letra, menú contextual, avisos con barra de tiempo).

### Producto
- Autoescuela Atlanta: coches, prácticas 1 a 1 con choques y series, horas del alumno, firma táctil, parte mensual, exámenes de conducir, importación CSV, modo sin conexión (PWA) con cola de cierres idempotente, datos de demostración.
- Avisos a alumnos por WhatsApp con plantillas, horas de descanso, recordatorios y reintentos; contador interno de WhatsApp por negocio y mes (Plataforma).
- Formulario público de matrícula para todos los negocios (antispam y consentimiento RGPD).
- Panel «Clientes» y modo personal (Gazael/Hokage): HUD, finanzas, voz del sistema, iPad/móvil.
- Calidad: CI en GitHub Actions (`.github/workflows/ci.yml`), `npm test` lanza todo (`tests/run-all.mjs`).

---

## C. Pendiente técnico

- [ ] **PostgreSQL con aislamiento por fila (RLS)** si se esperan muchas academias (hoy SQLite en un proceso; fuera de esta tanda a propósito).
- [ ] **Recuperación de contraseña y MFA** (necesita correo, B1).
- [ ] **Sedes** como entidad propia (para hacer cumplir el tope de sedes del PDF).
- [ ] **Sentry oficial** (hoy hay un cliente mínimo por «envelope», sin trazas de rendimiento ni breadcrumbs): cambiar por `@sentry/node` y `@sentry/browser` si se quiere más detalle.
- [ ] **Registro de accesos desde el servidor** para lecturas masivas: hoy lo avisa el navegador (el servidor valida persona y negocio), porque la instantánea envía listas completas.
- [ ] Recortar en el cliente las colecciones grandes que no usa cada pantalla (hoy se cargan todas tras el núcleo, y las pantallas que las necesitan esperan).
- [ ] Textos con artículo fijo («este grupo», «del alumno») que aún no usan el género de la etiqueta personalizada.
- [ ] Módulos propios de sectores: citas con profesional, historia clínica con consentimiento, recursos y flota (náutica), fichas de jugador y partidos (clubes).
- [ ] Autoescuela: avisos push, cola offline también para «Marcar como hecha» sin firma, QR del formulario público, inicio de sesión único con Volanta.
- [ ] Modo personal: botón de micrófono (dictado) y, si gusta, voz neuronal (clave en el servidor).
- [ ] Iconos PWA definitivos y versión de una sola tinta del logo.
