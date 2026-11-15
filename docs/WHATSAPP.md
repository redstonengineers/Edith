# Conectar WhatsApp (API oficial de Meta)

EDITH envía los avisos a alumnos por WhatsApp sin intervención cuando están estas variables en Coolify (app `edith`, pestaña Environment Variables). Sin ellas funciona en modo «con un toque» (enlace `wa.me`, envío manual).

## Qué hace falta
1. **Meta Business** (business.facebook.com) a nombre del negocio. Para enviar a muchos contactos, Meta pide **verificar la empresa** (CIF + documento). Puede tardar días: empezar por aquí.
2. **App en developers.facebook.com** (tipo «Empresa») con el producto **WhatsApp**.
3. **Número de teléfono** dedicado. Un número que ya usa WhatsApp normal hay que migrarlo o usar la coexistencia con WhatsApp Business app: decidirlo antes.
4. **Plantilla aprobada** (WhatsApp Manager > Plantillas), categoría **Utilidad**, idioma español, con **un único parámetro**:
   `Autoescuela Atlanta: {{1}}`
5. **Token permanente**: Configuración de empresa > Usuarios > Usuarios del sistema > crear usuario, asignar la app y generar token con permiso `whatsapp_business_messaging`. (El token temporal caduca en 24 h.)

## Variables en Coolify
| Variable | Valor |
|---|---|
| `WHATSAPP_TOKEN` | token permanente del usuario del sistema |
| `WHATSAPP_PHONE_ID` | «Identificador del número de teléfono» (API Setup) |
| `WHATSAPP_TEMPLATE` | nombre exacto de la plantilla aprobada |
| `WHATSAPP_LANG` | `es` (por defecto) |

Redesplegar. En **Avisos a alumnos** el canal pasa a «conectado»; usar «Prueba de canales» con un teléfono propio.

## Reglas
- **Consentimiento**: el formulario público incluye una casilla aparte y opcional de WhatsApp. Si el solicitante no la marca, al matricularlo sus avisos van solo por correo. En la ficha del alumno se cambia con «Avisar por».
- **Horario de descanso**: 22:00–08:00 (Europe/Madrid), configurable.
- **Reintentos**: 3 por aviso.
- **Coste**: Meta cobra por plantilla enviada según país y categoría; comprobar la tarifa vigente antes de ofrecer precios.
- **Respuestas**: hoy EDITH solo envía; las respuestas llegan al teléfono del negocio.
