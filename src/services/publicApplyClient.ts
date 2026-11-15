import type { PublicApplyInput } from '@/lib/schemas';
import { getDatabase, persist } from './database';
import { get, post } from './http';
import { IS_API } from './mode';
import { PublicApplyError, publicApplyInfo, submitPublicApplication, type PublicApplyInfo } from './publicApply';

/** Datos del formulario público de un negocio (null si no existe o está desactivado). */
export async function loadApplyForm(key: string): Promise<PublicApplyInfo | null> {
  if (IS_API) { try { return (await get<{ info: PublicApplyInfo }>(`/public/apply/${encodeURIComponent(key)}`)).info; } catch { return null; } }
  return publicApplyInfo(getDatabase(), key);
}

/** Envía la solicitud. En modo demo local se guarda en el navegador; en modo API la recibe el servidor. */
export async function sendApplication(key: string, input: PublicApplyInput): Promise<void> {
  if (IS_API) { await post(`/public/apply/${encodeURIComponent(key)}`, input); return; }
  try { submitPublicApplication(getDatabase(), key, input); persist(); } catch (e) { if (e instanceof PublicApplyError) throw new Error(e.message); throw e; }
}
