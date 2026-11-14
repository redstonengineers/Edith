import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, CheckSquare, CreditCard, FileText, Hourglass, Keyboard, Palette, Plus, Settings, Sparkles, AlertTriangle, UserPlus, type LucideIcon } from 'lucide-react';
import { can } from '@/lib/permissions';
import { useSession } from '@/store/session';
import { useUi } from '@/store/ui';
import { useVisibleModules, useModuleTitle } from '@/hooks';
import type { ModuleId } from '@/types';

export interface Command { id: string; title: string; hint?: string; group: 'Acciones rápidas' | 'Ir a' | 'Sistema'; icon: LucideIcon; keywords: string; run: () => void; quick?: boolean }

/** Acciones y navegación generadas del registro de módulos + permisos + etiquetas de la academia. */
export function useCommands(): Command[] {
  const navigate = useNavigate();
  const user = useSession((s) => s.user);
  const labels = useSession((s) => s.data?.settings.labels);
  const modules = useVisibleModules();
  const title = useModuleTitle();
  const { setAi, setTheme, theme, setShortcuts } = useUi();
  const settingsTheme = useSession((s) => s.data?.settings.branding.theme);
  const enabled = useMemo(() => new Set<ModuleId>(modules.map((m) => m.id)), [modules]);

  return useMemo(() => {
    if (!labels) return [];
    const l = (k: keyof typeof labels) => labels[k].singular.toLowerCase();
    const out: Command[] = [];
    const action = (mod: ModuleId, write: Parameters<typeof can>[1], c: Omit<Command, 'group'>) => { if (enabled.has(mod) && can(user, write)) out.push({ ...c, group: 'Acciones rápidas' }); };
    action('students', 'students:write', { id: 'new-student', title: `Nuevo ${l('student')}`, hint: `Crear ${l('student')}`, icon: UserPlus, keywords: `nuevo crear añadir alta ${l('student')} alumno`, run: () => navigate('/alumnos?nuevo=1'), quick: true });
    action('classes', 'classes:write', { id: 'new-class', title: `Nueva ${l('class')}`, hint: `Crear ${l('class')}`, icon: Plus, keywords: `nueva crear ${l('class')} clase`, run: () => navigate('/clases?nuevo=1'), quick: true });
    action('exams', 'exams:write', { id: 'new-exam', title: `Nuevo ${l('exam')}`, hint: `Crear ${l('exam')}`, icon: FileText, keywords: `nuevo crear ${l('exam')} examen`, run: () => navigate('/examenes?nuevo=1'), quick: true });
    action('attendance', 'attendance:write', { id: 'attendance', title: 'Registrar asistencia', icon: CheckSquare, keywords: 'asistencia faltas pasar lista registrar', run: () => navigate('/asistencia'), quick: true });
    action('incidents', 'incidents:write', { id: 'new-incident', title: `Añadir ${l('incident')}`, icon: AlertTriangle, keywords: `añadir nueva ${l('incident')} incidencia problema`, run: () => navigate('/incidencias?nuevo=1'), quick: true });
    action('payments', 'payments:write', { id: 'new-payment', title: `Nuevo ${l('payment')}`, hint: `Registrar ${l('payment')}`, icon: CreditCard, keywords: `nuevo registrar ${l('payment')} pago cobro`, run: () => navigate('/pagos?nuevo=1'), quick: true });
    if (enabled.has('schedule')) out.push({ id: 'open-calendar', title: 'Abrir calendario', icon: CalendarDays, group: 'Acciones rápidas', keywords: 'calendario horarios agenda semana', run: () => navigate('/horarios') });
    if (enabled.has('waitlist')) out.push({ id: 'open-waitlist', title: 'Abrir lista de espera', icon: Hourglass, group: 'Acciones rápidas', keywords: 'lista espera waitlist', run: () => navigate('/lista-espera') });
    if (enabled.has('ai')) out.push({ id: 'open-ai', title: 'Abrir JARVIS AI', icon: Sparkles, group: 'Sistema', keywords: 'jarvis ia asistente preguntar inteligencia', run: () => setAi(true) });
    const current = theme ?? settingsTheme ?? 'dark';
    out.push({ id: 'toggle-theme', title: `Cambiar a tema ${current === 'dark' ? 'claro' : 'oscuro'}`, icon: Palette, group: 'Sistema', keywords: 'tema claro oscuro modo dark light apariencia', run: () => setTheme(current === 'dark' ? 'light' : 'dark') });
    out.push({ id: 'shortcuts', title: 'Atajos de teclado', icon: Keyboard, group: 'Sistema', keywords: 'atajos teclado ayuda shortcuts', run: () => setShortcuts(true) });
    for (const m of modules) {
      if (m.id === 'ai') continue;
      out.push({ id: `go-${m.id}`, title: m.id === 'settings' ? 'Abrir configuración' : `Ir a ${title(m)}`, icon: m.id === 'settings' ? Settings : m.icon, group: 'Ir a', keywords: `${m.title} ${(m.keywords ?? []).join(' ')} ${m.description}`, run: () => navigate(m.path) });
    }
    return out;
  }, [labels, enabled, modules, user, navigate, title, setAi, setTheme, theme, settingsTheme, setShortcuts]);
}
