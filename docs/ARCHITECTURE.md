# ACADEMY CONTROL — Arquitectura técnica

## 0. Análisis del proyecto existente

El directorio de trabajo estaba **vacío** (sin repo, sin stack, sin dependencias). No hay nada que reutilizar ni que preservar, por lo que el stack se elige libremente.

## 1. Stack

| Capa | Elección | Motivo |
|---|---|---|
| UI | React 19 + TypeScript estricto | Pedido; ecosistema y contratación |
| Build | Vite | Arranque y HMR rápidos; SPA basta (app tras login, sin SEO) |
| Estilos | Tailwind CSS v4 + variables CSS | Tokens de marca en runtime → white-label sin recompilar |
| Routing | React Router 7 | Rutas anidadas, lazy loading por módulo |
| Estado | Zustand (sesión, tema, UI, config) | Pequeño, sin boilerplate. Datos de servidor viven en `services/` |
| Validación | Zod | Un esquema sirve para formularios y (luego) para el backend |
| Iconos | lucide-react | Trazo fino y consistente |
| Fechas | date-fns | Ligero, tree-shakeable |

Sin framer-motion ni librería de UI pesada: las transiciones son CSS (rápidas, `prefers-reduced-motion` respetado). Los gráficos (Fase 5) se harán con SVG propio o Recharts bajo un único componente `Chart`.

## 2. Capas y regla de dependencias

```
pages ─▶ components ─▶ hooks ─▶ services ─▶ (repositories ─▶ data source)
                          └──▶ lib (reglas de negocio puras) ◀── types
```

- `types/` — entidades y enums. Sin dependencias.
- `lib/` — **lógica de negocio pura** (permisos, conflictos de horario, métricas, motor de IA mock). Testeable sin React.
- `services/` — acceso a datos. `repositories/` define la interfaz y cada implementación (`mock` ahora, `http` después). **Los componentes nunca tocan localStorage ni fetch.**
- `hooks/` — adaptan servicios a React (`useAsync`, `useAcademyData`, `useHotkey`…).
- `components/ui` — primitivas visuales sin lógica de dominio (Button, Badge, Modal, DataTable…).
- `components/layout|command|ai|dashboard` — piezas con conocimiento de la app.
- `config/` — registro de módulos, navegación, plantillas por tipo de academia, permisos.
- `data/` — generador determinista de datos de demostración (no hay datos incrustados en componentes).

## 3. Multi-tenancy y aislamiento (academy_id)

- **Toda** entidad de negocio lleva `academyId`.
- El `TenantContext` (academia activa) lo fija la **sesión**, no la URL ni el cliente: `repositories` reciben `academyId` en construcción y filtran siempre. No existe ninguna función "listar todo".
- El seed crea **2 academias** (Horizonte e Instituto Atlas) con datos distintos para demostrar y poder probar el aislamiento y el white-label.
- Backend futuro: PostgreSQL con `academy_id NOT NULL` en cada tabla + **Row Level Security** (`USING academy_id = current_setting('app.academy_id')`) + el `academy_id` se deriva del JWT, nunca del body. El frontend nunca es la barrera de seguridad; solo la mejora de UX.

## 4. Modelo de datos

```
Academy 1─* User ─* Role(enum)            Academy 1─1 Settings (branding, labels, módulos)
Academy 1─* Student *─* Guardian          Academy 1─* Teacher
Academy 1─* Subject                       Academy 1─* Classroom
Group (subject, teacher, classroom, capacity, schedule[])  Group *─* Student  (vía Enrollment)
Class (sesión concreta: group, fecha, hora, aula, profesor, estado)  ← generada desde Schedule
Enrollment (student, group, estado, fechas)       WaitlistEntry (→ convertible en Student)
Attendance (class, student, estado)               Exam (group, fecha...) 1─* Grade (exam, student)
Payment (student, concepto, importe, vencimiento, estado)
Incident (tipo, prioridad, estado, responsable, entidad relacionada)
Document (entidad polimórfica: student|teacher|group|enrollment)
Message / Notification (canal: in-app|email|whatsapp|sms|push — preparado)
ActivityLog (actor, acción, entidad, antes/después, timestamp)
```

`types/entities.ts` define todas, con IDs string (UUID en producción) y fechas ISO.

## 5. Vocabulario y módulos configurables (white-label)

`Settings` contiene:
- `branding`: nombre, logo, favicon, `primary`, `secondary`, tema por defecto.
- `labels`: por entidad `{ singular, plural }` (Alumnos → "Conductores", Asignaturas → "Permisos"…). **Ningún componente escribe "Alumnos" a mano**: usa `useLabels().student.plural`.
- `modules`: mapa `moduleId → boolean`.

`config/modules.ts` es el **registro único** de módulos: id, ruta, icono, sección de sidebar, entidad (para etiquetas), permiso requerido y dependencias. Sidebar, router, buscador y command palette se **generan** de ese registro filtrado por módulos activos + permisos. Añadir un módulo = una entrada + una página.

`config/presets.ts` define plantillas por tipo de academia (Idiomas, Música, Autoescuela, Oposiciones…) con etiquetas y módulos por defecto, que usa el onboarding.

Los colores de marca se inyectan como variables CSS (`--brand`, `--brand-2`) y se derivan tonos con `color-mix`, de modo que cambiar el color actualiza toda la app al instante.

## 6. Autenticación y autorización

- `services/auth.ts`: interfaz `AuthProvider { signIn, signOut, currentSession }`. Ahora: proveedor mock (usuarios del seed, sin contraseñas reales en el bundle de producción: el login demo es un modo explícito). Después: JWT/cookie httpOnly emitidos por el backend.
- `lib/permissions.ts`: matriz `rol → permisos` (`student:read`, `payment:write`, `attendance:write`…) + helper `can(user, permiso)`. Roles: SUPER_ADMIN, ADMIN, SECRETARIA, PROFESOR, ALUMNO, TUTOR.
- `<RequirePermission>` y `useCan()` para UI; los repositorios **vuelven a comprobar** permisos y alcance (un PROFESOR solo ve sus grupos) — misma lógica que se trasladará al servidor.
- Secretos: ninguno en el frontend. Solo `VITE_*` no sensibles. La IA real se llamará **vía backend**.

## 7. JARVIS AI (arquitectura)

`AIProvider { ask(question, context): AsyncIterable<AIChunk> | Promise<AIAnswer> }`.
- Hoy: `MockAIProvider` = motor de intents determinista sobre los repositorios (responde con datos reales del seed).
- Mañana: `HttpAIProvider` → `POST /api/ai/chat` en tu backend, que añade el contexto del tenant (herramientas/consultas acotadas por `academy_id` y permisos del usuario), llama al modelo y hace streaming. La clave nunca sale del servidor.

## 8. Activity Log

`services/activity.ts` expone `log(action, entity, meta)`; los repositorios de escritura lo invocan **dentro** de la operación, de modo que ninguna pantalla puede olvidarlo.

## 9. Backend objetivo (post-prototipo)

Node + Fastify (o NestJS) + PostgreSQL + Prisma; REST `/api/v1/*`; OpenAPI generada desde los esquemas Zod; JWT + refresh en cookie httpOnly; RLS por `academy_id`; almacenamiento S3-compatible para documentos con URLs firmadas; cola (BullMQ) para email/WhatsApp/SMS. La interfaz `repositories/*` ya define exactamente este contrato.

## 10. Navegación

Generada desde el registro (secciones: Command Center · Gestión · Evaluación · Admisión · Administración · Comunicación · Analítica · Sistema). Rutas lazy por módulo. Móvil: barra inferior + drawer con el menú completo. `Ctrl/⌘+K` global.

## 11. Fases

| Fase | Contenido | Estado |
|---|---|---|
| 1 | Shell: auth, sidebar, header, rutas, dashboard, command palette, tema/branding, datos seed, JARVIS panel básico | Hecha |
| 2 | Alumnos, Profesores, Grupos, Asignaturas | **Hecha** |
| 3 | Calendario, clases, asistencia, exámenes | **Hecha** |
| 4 | Solicitudes, lista de espera, matrículas, pagos, facturación, incidencias, documentos, mensajes, avisos, notificaciones | **Hecha** |
| 5 | Analítica: estadísticas con gráficos, informes con exportación CSV | **Hecha** |
| 6 | JARVIS AI: motor de intents con permisos, historial, página y proveedor HTTP | **Hecha** |
| 7 | Personalización white-label, onboarding, panel Super Admin | **Hecha** |
| 8 | Usuarios, permisos editables por academia, portal de alumno/tutor | **Hecha** |
| 9 | Pulido: accesibilidad (axe: 0 violaciones A/AA), error boundary, atajos, foco y títulos | **Hecha** |

Decisión deliberada: construir pocas cosas **profundas** en lugar de muchas superficiales. Los módulos aún no implementados aparecen en la navegación con una pantalla honesta de "próxima fase", no con datos de relleno.

## 12. Estado final y qué falta para producción

> Actualización: existe backend real (`server/`, ver `docs/BACKEND.md`). Los puntos de abajo sobre «seguridad en el navegador» aplican solo al modo demo.

El frontend implementa los 9 módulos de fases. Todo el acceso a datos pasa por `services/` (mutaciones con permisos, aislamiento por `academyId` y registro de actividad), de modo que sustituir el almacenamiento local por una API no toca las pantallas.

**Lo que NO es producción todavía (deliberado en un MVP sin backend):**
- Autenticación y autorización se ejecutan en el navegador: son UX, no seguridad. El servidor debe repetir autenticación (cookie httpOnly), la matriz de permisos y el filtro `academy_id` (RLS).
- Datos en `localStorage` (se regeneran cada día en demo). Los documentos guardan solo metadatos.
- Canales email/WhatsApp/SMS/push y proveedor de IA real: interfaces listas (`services/channels.ts`, `lib/ai`), sin proveedor conectado.
- Facturación SaaS (suscripciones) y MRR: cifras orientativas.
- Sin tests unitarios automatizados en el repositorio (la verificación se hizo con pruebas end-to-end en navegador y auditoría axe).
