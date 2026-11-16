# EDITH — Pendientes que requieren a una persona

Lo que no puedo resolver desde la sesión (credenciales, DNS, cuentas de terceros, decisiones de negocio).
Marca cada punto cuando esté hecho.

## 1. Despliegue y dominio
- [ ] **Comprobar en un navegador `https://edith.redstonengineers.com`** (la única app: servidor y modo personal EDITH). Desde la sesión el proxy bloquea el dominio, así que solo he podido confirmar el estado en Coolify. Verificar DNS y certificado.
- [ ] **Decidir si se despliega el modo servidor.** Ahora está publicada la demo estática (datos en el navegador de cada visitante). Para datos compartidos hay que desplegar el `Dockerfile` de la raíz en Coolify (app aparte, volumen persistente `/data`) con `BOOTSTRAP_ADMIN_EMAIL` y `BOOTSTRAP_ADMIN_PASSWORD` (o `SEED_DEMO=1` solo para una demo). Pasar el frontend a `VITE_DATA_MODE=api`.
- [~] **Copias de seguridad**: el servidor ya hace una copia consistente de la base cada 24 h en `/app/data/backups` (últimas 7; variables `BACKUP_HOURS`, `BACKUP_KEEP`, `BACKUP_DIR`). Falta sacarlas fuera del volumen (Coolify → Backups o S3), porque si se pierde el volumen se pierden también.
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
- [~] **Voz en EDITH personal**: HECHO la síntesis con la voz del sistema (Ajustes → Voz de EDITH: activar, elegir voz y velocidad; lee respuestas y recordatorios; altavoz en cada respuesta). Falta el botón de micrófono (dictado); después, si gusta, voz neuronal (p. ej. ElevenLabs) con la clave guardada en el servidor. Descartado de momento: escucha permanente tipo «Oye EDITH» y conversación en tiempo real.

## Autoescuela Atlanta (híbrido EDITH + gestión de prácticas)
Hecho: coches (km, taller, ITV/seguro), prácticas 1 a 1 con choques de coche/profesor/alumno y series semanales, horas del alumno frente a su objetivo, profesor asignado, portada propia, firma táctil, parte mensual (CSV/impresión) y avisos por WhatsApp.
- [ ] **Exámenes de conducir** (teórico/práctico, resultado y % de aprobados) en la ficha del alumno y en el parte.
- [ ] **Importar alumnos** desde Excel/CSV.
- [ ] **Firma sin conexión**: cola offline que envía las firmas al recuperar la red.
- [ ] Alta real del tenant «Autoescuela Atlanta» desde el onboarding (la demo `@atlanta.demo` solo existe con `SEED_DEMO=1`).
- [ ] Avisos push de clases y copias de seguridad (equivalentes a los de Volanta).
- [x] **Modo sin conexión (como Volanta)**: app instalable (manifiesto + service worker), abre sin red con la última copia de datos (IndexedDB, se borra al cerrar sesión) y aviso «Sin conexión». Los cierres de práctica con firma se guardan en el móvil y se envían solos al volver la red (cada cierre lleva un `opId`: el servidor lo reconoce y no duplica km ni firmas; guarda la hora real de la firma). Si el servidor rechaza un cierre (p. ej. práctica cancelada) se conserva con aviso Reintentar / Descartar. Crear/mover prácticas y el resto de acciones siguen necesitando conexión. Test: `tests/e2e/offline.cjs`. Pendiente: probar en un iPad/móvil real (instalar en pantalla de inicio) y, si se quiere, cola offline también para «Marcar como hecha» sin firma.

## Autoescuela Atlanta — fase 3 (hecha)
- Exámenes de conducir (teórico/práctico, resultado) en la ficha del alumno y «Exámenes del mes» con % de aprobados en el parte mensual.
- Importar alumnos desde CSV (Excel → Guardar como CSV; coma o punto y coma; fechas dd/mm/aaaa o aaaa-mm-dd), validando fila a fila, con plantilla descargable.
- Sigue pendiente: alta real del tenant «Autoescuela Atlanta» desde el onboarding (hoy solo existe la demo con SEED_DEMO=1), firma sin conexión, avisos push y copias de seguridad.

## Acceso por negocio (Atlanta, Academia, Clínica)
- `/login` muestra tres tarjetas bajo el formulario; cada una lleva a `/acceso/<negocio>` (logo, colores y perfiles propios). Usuario = nombre del perfil (Atlanta: director, secretaria, profesor, alumno; Academia: director, secretaria, profesor, alumno, padre; Clínica: director, recepcion, doctor, paciente, familiar). **Contraseña de todas: `demo`** (variable `TENANT_PASSWORD` para cambiarla; el acceso personal de EDITH no cambia).
- Al arrancar con `PROVISION_ACADEMY_NAME` + `PROVISION_ADMIN_EMAIL` (o `TENANTS=1`) el servidor deja listos, de forma idempotente: Atlanta (la academia real, vacía), Academia y Clínica (negocios de ejemplo con datos de muestra), sus módulos y una cuenta por perfil. `PROVISION_ADMIN_PASSWORD` ya no se usa (borrarla de Coolify).
- Aviso de seguridad: con contraseña «demo» cualquiera puede entrar en las cuentas de estos tres negocios. Para uso real de Atlanta conviene `TENANT_PASSWORD` propio o cambiar la contraseña de cada cuenta.
- Pendiente: datos fiscales y logo definitivo de Atlanta (el actual es un logo de muestra en `public/brand/`).

## Avisos automáticos al alumno (correo y WhatsApp)
Hecho: al apuntar, cambiar de hora o cancelar una práctica, o anotar un examen/resultado, se crea un aviso al alumno (y a su tutor si es menor) según su preferencia (ficha → Prácticas → «Avisar al alumno por»). Página **Avisos a alumnos** (`/avisos-alumnos`) con el estado de cada canal. Cambios seguidos sobre lo mismo antes de enviarse sustituyen al aviso (no spamean).
- [ ] **Correo**: crear cuenta en Resend (resend.com), verificar el dominio y poner en Coolify `RESEND_API_KEY` y `MAIL_FROM` («Autoescuela Atlanta <avisos@tudominio>»).
- [ ] **WhatsApp automático** (opcional): WhatsApp Business Platform de Meta → `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID` y una plantilla aprobada con un único parámetro `{{1}}` (`WHATSAPP_TEMPLATE`, idioma `WHATSAPP_LANG`, por defecto es). Meta solo permite texto libre si el alumno escribió en las últimas 24 h; fuera de esa ventana hace falta la plantilla.
- Sin esas claves: el correo no se envía y WhatsApp queda «por enviar» con un botón que abre WhatsApp con el mensaje ya escrito.

## Avisos a alumnos: infraestructura (lista para conectar mensajería)
Página `/avisos-alumnos` (Bandeja + Configuración). Eventos: práctica nueva/serie/cambio/cancelada/restaurada/recordatorio, examen anotado/aprobado/suspendido, clase cancelada/cambiada. Cada academia activa/desactiva cada evento y edita su texto (variables `{nombre} {fecha} {hora}…`, con vista previa), elige canales, recordatorio automático (horas antes; 0 = no) y horas de descanso (por defecto 22:00–08:00, hora `NOTICES_TZ` = Europe/Madrid). Preferencia por alumno (ficha). Reintentos automáticos (3) y botón Reintentar. Prueba de canales desde la propia página.
Canales (se activan solos con sus claves en Coolify): correo (`RESEND_API_KEY`, `MAIL_FROM`), WhatsApp Business (`WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_TEMPLATE`), y **webhook firmado** (`NOTIFY_WEBHOOK_URL`, `NOTIFY_WEBHOOK_SECRET`) para conectar Telegram, SMS, Slack, Make, Zapier o n8n sin tocar el código: JSON con cabeceras `X-Edith-Timestamp` y `X-Edith-Signature: sha256=HMAC(secreto, "timestamp.cuerpo")`.

## Datos de demostración de Autoescuela Atlanta (para enseñarla a clientes)
Al arrancar, si Atlanta está vacía (sin alumnos ni prácticas) se llena **una sola vez** con datos ficticios: 4 profesores, 5 vehículos (uno en el taller, ITV y seguros próximos), 46 alumnos con permisos B, A2 y AM (algunos menores con tutor), grupos de teórico, ~6 semanas de prácticas hechas (con firmas) y 2 de programadas, exámenes de la DGT con resultados y repeticiones (parte mensual con % de aprobados), ~140 cobros (algunos vencidos), incidencias y avisos. La cuenta «alumno» ve a un alumno modelo (14 de 20 h, teórico aprobado, práctico fijado). Atlanta ya no tiene perfil «padre».
- No pisa datos reales: si ya hay alumnos (las ffichas de relleno del alta de cuentas no cuentan), profesores o prácticas no hace nada, y no vuelve a rellenarse aunque se borren (marca `demoSeeded`).
- Para quitarla antes de usar la academia de verdad: borrar los alumnos/prácticas desde la app, o usar `ATLANTA_DEMO=0` en Coolify **antes** del primer arranque para no crearla.

## Formulario público de solicitud de matrícula (todos los negocios)
Cada negocio tiene un enlace público `/matricula/<slug o id>` (Atlanta: `/matricula/atlanta`) para que cualquiera pida plaza sin cuenta. Las solicitudes llegan a **Matrículas → Solicitud** con la etiqueta «Web», el mensaje y, si es menor, los datos del tutor. El formulario se adapta al negocio (logo, colores y la pregunta «qué te interesa»: permiso, motivo de consulta, actividad…).
- Control desde Matrículas (tarjeta «Formulario público»): copiar enlace, activar/desactivar, texto de bienvenida y opciones. Activo por defecto en todos los negocios.
- Antispam: señuelo oculto, tiempo mínimo de relleno, 6 envíos por hora y red, 80 al día por negocio, sin duplicados (mismo correo o teléfono en 7 días) y consentimiento RGPD obligatorio.
- Avisos: notificación dentro de la app siempre; con correo conectado (Resend) también correo al director/secretaría y acuse al interesado.
- Pendiente: texto legal propio de privacidad enlazado en el formulario; QR del enlace para carteles.

- [x] **Planes y precios** (el PDF ya no muestra pago anual): `docs/EDITH-planes-y-precios.pdf` (Esencial 39 €/mes, Profesional 69 €/mes, Premium 99 €/mes; altas 590 / 990 / 1.490 €; sin IVA; el Esencial ya incluye prácticas, coches, firma, parte y modo sin conexión; el WhatsApp automático empieza en Profesional). WhatsApp automático incluido en Profesional y Premium **sin tope visible**; cláusula de uso razonable en el contrato. Contador interno: `Academy.waUsage` («AAAA-MM» → avisos enviados por la API de WhatsApp), visible solo en Plataforma (columna «WhatsApp (mes)», aviso «Uso alto» si > 8 por alumno activo, no bloquea). Test: `tests/e2e/wa-contador.cjs`.
- [ ] Control de plan por negocio (módulos y topes de sedes/usuarios/alumnos según contrato): hoy los límites del PDF no los aplica el programa; los planes de Plataforma son prueba/básico/pro (sin «premium» aún).
- [x] **Panel «Clientes» en EDITH personal** (módulo 7 del dock, también en «Más»): lista los negocios con plan, precio, usuarios, alumnos y WhatsApp del mes; permite cambiar la suscripción (Prueba / Esencial 39 € / Profesional 69 € / Premium 99 €), con la opción de desactivar los módulos que el nuevo plan no incluye (`src/config/plans.ts`; nunca activa módulos solos), y suspender/reactivar un negocio. API: `GET/POST /api/personal/clients…` (solo con sesión personal; devuelve cifras, nunca datos de personas). Test: `tests/e2e/clientes-personal.cjs`. Pendiente: que el servidor impida activar módulos fuera del plan desde los ajustes del propio negocio (hoy solo se aplica al cambiar de plan) y los topes de usuarios/alumnos por plan.
- [x] **«Mantener la sesión iniciada»** en el acceso general y en el de cada negocio: sin marcar la sesión dura 12 h (`SESSION_HOURS`); marcada, 30 días (`REMEMBER_DAYS`) en ese dispositivo. La casilla recuerda la elección (nunca guarda credenciales) y viene sin marcar. El acceso personal ya dura 30 días. Test: `tests/e2e/recordar-sesion.cjs`.
- [x] **Parpadeo del núcleo al empezar (modo personal)**: la escena 3D se destruía y se volvía a crear al elegir perfil (pantalla «INICIANDO SISTEMAS…» desmontaba todo) y los tirones normales de los primeros segundos (compilar shaders) apagaban el brillo. Ahora hay una sola escena para todo el modo personal (el núcleo se desplaza suavemente de «elegir perfil» al HUD) y la degradación automática espera 2,5 s. Verificado por medición de fotogramas (sin flash negro, 1 contexto WebGL); no probado en GPU real.
