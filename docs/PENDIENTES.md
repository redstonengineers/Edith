# EDITH — Pendientes que requieren a una persona

Lo que no puedo resolver desde la sesión (credenciales, DNS, cuentas de terceros, decisiones de negocio).
Marca cada punto cuando esté hecho.

## 1. Despliegue y dominio
- [ ] **Comprobar en un navegador `https://edith.redstonengineers.com`** (la única app: servidor y modo personal EDITH). Desde la sesión el proxy bloquea el dominio, así que solo he podido confirmar el estado en Coolify. Verificar DNS y certificado.
- [ ] **Decidir si se despliega el modo servidor.** Ahora está publicada la demo estática (datos en el navegador de cada visitante). Para datos compartidos hay que desplegar el `Dockerfile` de la raíz en Coolify (app aparte, volumen persistente `/data`) con `BOOTSTRAP_ADMIN_EMAIL` y `BOOTSTRAP_ADMIN_PASSWORD` (o `SEED_DEMO=1` solo para una demo). Pasar el frontend a `VITE_DATA_MODE=api`.
- [ ] **Copias de seguridad** del volumen `/data` hacia almacenamiento externo (Coolify → Backups o S3).
- [ ] Token de GitHub con permisos de creación de repos si quieres que la sesión cree repos nuevos por sí sola (hoy hay que crearlos a mano).

## 2. Servicios externos (cada uno necesita una cuenta o clave tuya)
- [ ] **Email (Resend)**: el código ya está (`server/mailer.ts`, canal «Correo electrónico»). Falta: cuenta en resend.com, verificar un dominio (SPF/DKIM en el DNS) y definir en Coolify `RESEND_API_KEY` y `MAIL_FROM` en la app del servidor.
- [ ] **WhatsApp / SMS / push**: hoy los canales están simulados y marcados como tal. Requiere WhatsApp Business API (Meta o proveedor como Twilio) y plantillas aprobadas.
- [ ] **JARVIS con Claude**: el código ya está (`server/claude.ts`). Falta crear una clave en console.anthropic.com y definir en Coolify `ANTHROPIC_API_KEY` (y opcionalmente `ANTHROPIC_MODEL`) en la app del servidor. Sin clave usa el motor local.
- [ ] **Pagos online** (cobro con tarjeta, domiciliación SEPA): Stripe o Redsys; hoy los pagos se registran a mano.
- [ ] **Almacenamiento en Google Drive** (decidido): hoy solo se guardan metadatos. Falta: proyecto en Google Cloud con la API de Drive activada, una cuenta de servicio con su clave JSON (variable `GOOGLE_SERVICE_ACCOUNT_JSON` en Coolify) y una carpeta raíz de Drive compartida con esa cuenta (`DRIVE_ROOT_FOLDER_ID`). Si hay clínicas, usar Google Workspace de pago con el acuerdo de tratamiento de datos firmado, no una cuenta personal. Después lo implemento en el servidor (una subcarpeta por academia, descargas autenticadas por el servidor).
- [ ] **Facturación SaaS** (suscripciones y MRR de la plataforma): cifras orientativas; depende del proveedor de pagos anterior.

## 3. Producto y negocio (decisiones tuyas)
- [ ] **Qué sectores se venden primero.** Hay 18 plantillas (ver `docs/VERTICALES.md`). Elegir 2-3 y definir precio por sector.
- [x] **Autoescuelas / Volanta**: hecho por integración (módulo «Prácticas y vehículos» que abre Volanta, ya desplegada). Pendiente: inicio de sesión único y alumnos compartidos entre EDITH y Volanta (requiere unificar usuarios), o portarlo por completo a EDITH.
- [ ] **Textos legales**: política de privacidad, aviso legal y contrato de encargado de tratamiento (RGPD), imprescindibles al guardar datos de alumnos, menores y, en clínicas, datos de salud. Revisión por un abogado.
- [x] **Logo**: elegida la propuesta B (hexágono con E), aplicada en acceso, onboarding y favicon. Pendiente: iconos PWA y versión de una sola tinta si se imprime.
- [ ] **Dominio por cliente** (white-label): decidir si cada academia tendrá subdominio propio (`cliente.edith…`) o dominio propio.

## 4. Seguridad antes de producción real
- [ ] Prueba con HTTPS real de la cookie `Secure` y del proxy (`TRUST_PROXY=1`).
- [ ] Recuperación de contraseña y MFA (necesita email, punto 2).
- [ ] Migrar a PostgreSQL con aislamiento por fila (RLS) si se esperan muchas academias (hoy SQLite, un solo proceso).
- [ ] Revisión externa de seguridad / pentest antes de gestionar datos de clientes reales.
- [ ] Rotar cualquier credencial que se haya compartido fuera de los canales seguros.

## 5. Mejoras técnicas conocidas (las puedo hacer yo cuando lo pidas)
- [ ] Paginación de `/api/snapshot` para academias grandes.
- [ ] Textos con artículo fijo («este grupo», «del alumno») que aún no usan el género de la etiqueta personalizada.
- [ ] Módulos propios de sectores: citas con profesional (estética/clínica), historia clínica con consentimiento, recursos y flota (autoescuela/náutica), fichas de jugador y partidos (clubes).

## Ideas para más adelante
- [ ] **Voz en EDITH personal**: empezar con voz del navegador (síntesis) + botón de micrófono (dictado); después, si gusta, voz neuronal (p. ej. ElevenLabs) con la clave guardada en el servidor. Descartado de momento: escucha permanente tipo «Oye EDITH» y conversación en tiempo real.

## Autoescuela Atlanta (híbrido EDITH + gestión de prácticas)
Hecho: coches (km, taller, ITV/seguro), prácticas 1 a 1 con choques de coche/profesor/alumno y series semanales, horas del alumno frente a su objetivo, profesor asignado, portada propia, firma táctil, parte mensual (CSV/impresión) y avisos por WhatsApp.
- [ ] **Exámenes de conducir** (teórico/práctico, resultado y % de aprobados) en la ficha del alumno y en el parte.
- [ ] **Importar alumnos** desde Excel/CSV.
- [ ] **Firma sin conexión**: cola offline que envía las firmas al recuperar la red.
- [ ] Alta real del tenant «Autoescuela Atlanta» desde el onboarding (la demo `@atlanta.demo` solo existe con `SEED_DEMO=1`).
- [ ] Avisos push de clases y copias de seguridad (equivalentes a los de Volanta).
