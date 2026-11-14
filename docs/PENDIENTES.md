# EDITH — Pendientes que requieren a una persona

Lo que no puedo resolver desde la sesión (credenciales, DNS, cuentas de terceros, decisiones de negocio).
Marca cada punto cuando esté hecho.

## 1. Despliegue y dominio
- [ ] **Comprobar `https://edith.redstonengineers.com`** en un navegador: desde la sesión el proxy bloquea el dominio, así que solo he podido confirmar el estado en Coolify (`running:healthy`). Verificar DNS (registro A/CNAME) y certificado.
- [ ] **Decidir si se despliega el modo servidor.** Ahora está publicada la demo estática (datos en el navegador de cada visitante). Para datos compartidos hay que desplegar el `Dockerfile` de la raíz en Coolify (app aparte, volumen persistente `/data`) con `BOOTSTRAP_ADMIN_EMAIL` y `BOOTSTRAP_ADMIN_PASSWORD` (o `SEED_DEMO=1` solo para una demo). Pasar el frontend a `VITE_DATA_MODE=api`.
- [ ] **Copias de seguridad** del volumen `/data` hacia almacenamiento externo (Coolify → Backups o S3).
- [ ] Token de GitHub con permisos de creación de repos si quieres que la sesión cree repos nuevos por sí sola (hoy hay que crearlos a mano).

## 2. Servicios externos (cada uno necesita una cuenta o clave tuya)
- [ ] **Email transaccional** (recuperación de contraseña, avisos, recibos): elegir proveedor (Resend, Postmark, SES) y facilitar la clave por el formulario seguro de credenciales.
- [ ] **WhatsApp / SMS / push**: hoy los canales están simulados y marcados como tal. Requiere WhatsApp Business API (Meta o proveedor como Twilio) y plantillas aprobadas.
- [ ] **IA real para JARVIS**: hoy responde con un motor de intenciones sobre los datos. Para un modelo de lenguaje hay que dar una clave de API; irá solo en el servidor (`/api/ai/chat`).
- [ ] **Pagos online** (cobro con tarjeta, domiciliación SEPA): Stripe o Redsys; hoy los pagos se registran a mano.
- [ ] **Almacenamiento de documentos**: hoy solo se guardan metadatos. Hace falta un bucket S3-compatible (o volumen) y claves.
- [ ] **Facturación SaaS** (suscripciones y MRR de la plataforma): cifras orientativas; depende del proveedor de pagos anterior.

## 3. Producto y negocio (decisiones tuyas)
- [ ] **Qué sectores se venden primero.** Hay 18 plantillas (ver `docs/VERTICALES.md`). Elegir 2-3 y definir precio por sector.
- [ ] **Autoescuelas: traer las funciones de Volanta** (firma táctil offline, vehículos con ITV/seguro/taller, parte mensual de prácticas, avisos push). Es trabajo de desarrollo grande: confirmar prioridad y si se reutiliza el código de `redstonengineers/volanta`.
- [ ] **Textos legales**: política de privacidad, aviso legal y contrato de encargado de tratamiento (RGPD), imprescindibles al guardar datos de alumnos, menores y, en clínicas, datos de salud. Revisión por un abogado.
- [ ] **Marca**: logo y nombre definitivo (EDITH), favicon e iconos PWA propios.
- [ ] **Dominio por cliente** (white-label): decidir si cada academia tendrá subdominio propio (`cliente.edith…`) o dominio propio.

## 4. Seguridad antes de producción real
- [ ] Prueba con HTTPS real de la cookie `Secure` y del proxy (`TRUST_PROXY=1`).
- [ ] Recuperación de contraseña y MFA (necesita email, punto 2).
- [ ] Migrar a PostgreSQL con aislamiento por fila (RLS) si se esperan muchas academias (hoy SQLite, un solo proceso).
- [ ] Revisión externa de seguridad / pentest antes de gestionar datos de clientes reales.
- [ ] Rotar cualquier credencial que se haya compartido fuera de los canales seguros.

## 5. Mejoras técnicas conocidas (las puedo hacer yo cuando lo pidas)
- [ ] Activar `is_spa` de forma nativa en Coolify (hoy se resuelve con un Dockerfile/nginx en `site/`).
- [ ] Paginación de `/api/snapshot` para academias grandes.
- [ ] Textos con artículo fijo («este grupo», «del alumno») que aún no usan el género de la etiqueta personalizada.
- [ ] Módulos propios de sectores: citas con profesional (estética/clínica), historia clínica con consentimiento, recursos y flota (autoescuela/náutica), fichas de jugador y partidos (clubes).
