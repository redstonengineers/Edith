import { getDatabase } from '../src/services/database';
import { restoreDemos } from './provision';
import type { Store } from './store';

const TZ = process.env.NOTICES_TZ ?? 'Europe/Madrid';
const localParts = () => { const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()).map((x) => [x.type, x.value])); return { day: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) }; };

/** Restaura las demos y cierra sus sesiones. Devuelve los negocios restaurados. */
export function resetDemos(store: Store, atlantaDemo = process.env.ATLANTA_DEMO !== '0'): string[] {
  const db = getDatabase(); const demoIds = db.academies.filter((a) => a.isDemo === true).map((a) => a.id);
  const done = restoreDemos(db, { atlantaDemo }); for (const id of demoIds) store.deleteAcademySessions(id);
  store.setMeta('demoResetDay', localParts().day); return done;
}

/**
 * Programa la restauración diaria (a partir de DEMO_RESET_HOUR, por defecto las 4:00 de NOTICES_TZ). DEMO_RESET_DAILY=0 la desactiva.
 * La primera vez que arranca no restaura nada: solo anota el día, para no pisar datos al desplegar.
 */
export function scheduleDemoReset(store: Store, run: (fn: () => void) => Promise<void>) {
  if (process.env.DEMO_RESET_DAILY === '0') return;
  const hour = Number(process.env.DEMO_RESET_HOUR ?? 4);
  const tick = () => {
    const { day, hour: h } = localParts(); const last = store.getMeta('demoResetDay');
    if (!last) { store.setMeta('demoResetDay', day); return; }
    if (last === day || h < hour) return;
    void run(() => { const r = resetDemos(store); console.warn(`Demos restauradas: ${r.join(', ') || 'ninguna'}`); });
  };
  tick(); setInterval(tick, 15 * 60_000).unref();
}
