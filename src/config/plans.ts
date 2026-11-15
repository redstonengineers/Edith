import type { ModuleId } from '@/types';

/** Planes comerciales (ver docs/EDITH-planes-y-precios.pdf). Los identificadores internos se mantienen: basic = Esencial, pro = Profesional. */
export type PlanId = 'trial' | 'basic' | 'pro' | 'premium';
export const PLAN_IDS: PlanId[] = ['trial', 'basic', 'pro', 'premium'];
/** Módulos que dependen del plan: Esencial no los incluye; Profesional sí (salvo la IA); Premium todos. «Prueba» no limita nada. */
export const GATED: ModuleId[] = ['practicas', 'vehiculos', 'parte', 'avisos', 'ai'];
export const PLANS: Record<PlanId, { label: string; price: number; setup: number; allowed: ModuleId[]; summary: string }> = {
  trial: { label: 'Prueba', price: 0, setup: 0, allowed: GATED, summary: 'Sin cobro, todos los módulos.' },
  basic: { label: 'Esencial', price: 39, setup: 590, allowed: ['practicas', 'vehiculos', 'parte'], summary: 'Gestión completa con prácticas, coches, firma y parte mensual. WhatsApp «con un toque».' },
  pro: { label: 'Profesional', price: 69, setup: 990, allowed: ['practicas', 'vehiculos', 'parte', 'avisos'], summary: 'Todo lo anterior + WhatsApp automático, estadísticas, permisos por rol y marca completa.' },
  premium: { label: 'Premium', price: 99, setup: 1490, allowed: GATED, summary: 'Todo + varias sedes, JARVIS AI, soporte en 4 h y 1 h al mes de ajustes.' },
};
/** Módulos que se desactivarían al pasar a este plan (solo los controlados por plan que ahora estén activos). */
export const modulesToDisable = (plan: PlanId, active: Partial<Record<ModuleId, boolean>>): ModuleId[] => GATED.filter((m) => !PLANS[plan].allowed.includes(m) && active[m]);
