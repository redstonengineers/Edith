import { Lock, RotateCcw } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { useAction, useCan, useSettings, useUser } from '@/hooks';
import { EDITABLE_RESOURCES, LOCKED_ROLES, ROLE_LABELS, ROLE_PERMISSIONS, type Permission, type Resource } from '@/lib/permissions';
import { resetRolePermissions, setRolePermission } from '@/services/mutations';
import type { RoleId } from '@/types';
import { cn } from '@/utils/cn';

const RES_LABEL: Record<Resource, string> = { dashboard: 'Command Center', students: 'Alumnos', teachers: 'Profesores', groups: 'Grupos', classes: 'Clases', subjects: 'Asignaturas', schedule: 'Horarios', exams: 'Exámenes', grades: 'Calificaciones', attendance: 'Asistencia', applications: 'Solicitudes', waitlist: 'Lista de espera', enrollments: 'Matrículas', payments: 'Pagos', billing: 'Facturación', documents: 'Documentos', practicas: 'Prácticas y vehículos', incidents: 'Incidencias', messages: 'Mensajes', announcements: 'Avisos', notifications: 'Notificaciones', statistics: 'Estadísticas', reports: 'Informes', ai: 'JARVIS AI', settings: 'Configuración', users: 'Usuarios', permissions: 'Permisos', customization: 'Personalización', platform: 'Plataforma' };
const ROLES: RoleId[] = ['ADMIN', 'SECRETARIA', 'PROFESOR', 'ALUMNO', 'TUTOR'];

export default function PermissionsPage() {
  const st = useSettings(); const user = useUser(); const can = useCan(); const run = useAction(); const write = can('permissions:write');
  const eff = (role: RoleId, p: Permission) => LOCKED_ROLES.includes(role) ? ROLE_PERMISSIONS[role].has(p) : st.permissionOverrides?.[role]?.[p] ?? ROLE_PERMISSIONS[role].has(p);
  const changed = (role: RoleId) => Object.keys(st.permissionOverrides?.[role] ?? {}).length > 0;
  return (
    <>
      <PageHeader title="Permisos" description="Qué puede ver («Ver») y modificar («Editar») cada rol. El Administrador siempre conserva todo acceso." />
      <div className="panel overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm" aria-label="Matriz de permisos">
          <thead><tr className="border-b border-line text-[11px] tracking-[0.1em] text-muted uppercase"><th scope="col" className="px-4 py-3 text-left font-semibold">Sección</th>
            {ROLES.map((r) => <th key={r} scope="col" className="px-3 py-3 text-center font-semibold"><span className="block">{ROLE_LABELS[r]}</span>{LOCKED_ROLES.includes(r) ? <Lock size={11} className="mx-auto mt-1" aria-label="Bloqueado" /> : write && changed(r) ? <button onClick={() => void run(() => resetRolePermissions(user, r), 'Permisos restablecidos')} className="mt-1 inline-flex items-center gap-1 text-[10px] normal-case text-brand-text hover:underline"><RotateCcw size={10} />Restablecer</button> : null}</th>)}</tr></thead>
          <tbody>{EDITABLE_RESOURCES.map((res) => (
            <tr key={res} className="border-b border-line/60 last:border-0"><th scope="row" className="px-4 py-2.5 text-left font-medium">{RES_LABEL[res]}</th>
              {ROLES.map((r) => (
                <td key={r} className="px-3 py-2.5"><div className="flex items-center justify-center gap-3">
                  {(['read', 'write'] as const).map((a) => { const p = `${res}:${a}` as Permission; const on = eff(r, p); const locked = LOCKED_ROLES.includes(r) || !write; const diff = !LOCKED_ROLES.includes(r) && on !== ROLE_PERMISSIONS[r].has(p);
                    return <label key={a} className={cn('flex items-center gap-1 text-xs', locked ? 'text-muted' : 'cursor-pointer')}><input type="checkbox" checked={on} disabled={locked} aria-label={`${ROLE_LABELS[r]}: ${a === 'read' ? 'ver' : 'editar'} ${RES_LABEL[res]}`} onChange={(e) => void run(() => setRolePermission(user, r, p, e.target.checked), 'Permiso actualizado')} className="h-4 w-4 accent-[var(--brand)]" /><span className={diff ? 'font-semibold text-brand-text' : ''}>{a === 'read' ? 'Ver' : 'Editar'}</span></label>; })}
                </div></td>))}</tr>))}</tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted">Los cambios respecto a la plantilla aparecen resaltados. Editar implica poder ver. El servidor aplicará exactamente la misma matriz.</p>
      {!write && <Button className="mt-3" disabled>Solo lectura</Button>}
    </>
  );
}
