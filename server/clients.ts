import { PRESETS } from '../src/config/presets';
import type { AcademyType } from '../src/types';
import { getDatabase } from '../src/services/database';
import { changeAcademyPlan } from '../src/services/platform';
import { DomainError, createAcademy } from '../src/services/mutations.local';
import { generatePassword } from './access';

export interface NewClient { academyName: string; type: AcademyType; plan: 'trial' | 'basic' | 'pro' | 'premium'; adminEmail: string; adminName?: string; primary?: string }

/**
 * Alta de un cliente real. La contraseña la genera el servidor (se devuelve UNA vez y solo se guarda su hash) y el administrador debe
 * cambiarla en su primer acceso. Nace con `isDemo: false`, sin slug (no aparece en las tarjetas de demos) y con los módulos de su plantilla
 * recortados a los del plan elegido.
 */
export async function createClient(input: NewClient): Promise<{ academyId: string; name: string; plan: string; adminEmail: string; password: string }> {
  const email = input.adminEmail.trim().toLowerCase(); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new DomainError('Correo del administrador no válido.');
  const password = generatePassword();
  const admin = await createAcademy({ academyName: input.academyName.trim(), type: input.type, modules: PRESETS[input.type].modules, adminName: (input.adminName ?? '').trim() || 'Administrador', adminEmail: email, adminPassword: password, primary: input.primary });
  const db = getDatabase(); const a = db.academies.find((x) => x.id === admin.academyId)!;
  a.isDemo = false; admin.mustChangePassword = true;
  changeAcademyPlan(db, a.id, input.plan, true);
  return { academyId: a.id, name: a.name, plan: a.plan, adminEmail: email, password };
}
