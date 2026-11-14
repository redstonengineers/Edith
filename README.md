# Academy Control

Centro de control multi-academia (SaaS white-label) · React 19 + TypeScript + Vite + Tailwind v4.
Arquitectura, modelo de datos y plan: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + build de producción
```

## Demo
Pulsa una cuenta en la pantalla de acceso (contraseña `demo`). Hay 2 academias con marca, vocabulario y módulos distintos
(Academia Horizonte — oscuro/azul; Centro Educativo Atlas — claro/ámbar) y los roles Administrador, Secretaría, Profesor,
Alumno, Tutor y Super Admin. También puedes crear una academia nueva desde **Crea tu academia** (onboarding).

## Qué incluye
Command Center · buscador global y comandos (Ctrl+K) · alumnos, profesores, grupos, asignaturas · calendario (día/semana/mes,
arrastrar, conflictos) · clases · asistencia · exámenes y calificaciones · solicitudes, lista de espera y matrículas · pagos y
facturación · incidencias · documentos · mensajes, avisos y notificaciones · estadísticas e informes (CSV) · JARVIS AI ·
personalización (marca, vocabulario, módulos) · usuarios y permisos por rol · panel Super Admin · portal de alumno/tutor.

## Backend real
Hay dos modos: **demo** (todo en el navegador, `npm run dev`) y **API** (servidor Fastify + SQLite con sesión por cookie, validación y aislamiento por academia en servidor: `SEED_DEMO=1 npm run server` + `npm run dev:api`). Detalle, modelo de seguridad y límites en [`docs/BACKEND.md`](docs/BACKEND.md).

## Estado
MVP funcional con backend propio (single-process, SQLite). Para producción a escala falta migrar a PostgreSQL con RLS, almacenamiento
de ficheros, proveedores de email/IA y recuperación de contraseña; ver `docs/BACKEND.md` (Límites conocidos).
