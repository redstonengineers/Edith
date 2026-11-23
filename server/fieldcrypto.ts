import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * Cifrado de campos sensibles (AES-256-GCM). Cada valor se guarda como «enc:v1:<idClave>:<iv>:<tag>:<texto>» (base64url) y lleva
 * el JSON del valor original, así que recupera su tipo (texto, lista, objeto). La clave sale de DATA_ENCRYPTION_KEY (32 bytes en base64);
 * DATA_ENCRYPTION_KEY_PREVIOUS (separadas por comas) permite leer datos de claves anteriores durante una rotación.
 */
const PREFIX = 'enc:v1:';

/** Campos de personas y de salud que se cifran, por tabla. «[]» recorre listas; «.» entra en objetos. */
export const SENSITIVE: Record<string, string[]> = {
  students: ['email', 'phone', 'birthDate', 'notes', 'dni', 'document', 'documentId', 'clinicalHistory', 'clinicalNotes', 'reports', 'medicalNotes', 'allergies'],
  guardians: ['name', 'phone', 'email', 'dni', 'document'],
  teachers: ['email', 'phone', 'dni'],
  users: ['email'],
  waitlist: ['name', 'phone', 'email', 'birthDate'],
  enrollments: ['applicant.name', 'applicant.email', 'applicant.phone', 'applicant.birthDate', 'applicant.message', 'applicant.guardianName', 'applicant.guardianPhone', 'applicant.dni'],
  incidents: ['description'],
  messages: ['body'],
  notifications: ['body'],
  outbox: ['body', 'to'],
  practices: ['notes'],
};

export interface Key { id: string; key: Buffer }
const keyId = (k: Buffer) => createHash('sha256').update(k).digest('hex').slice(0, 8);

export function parseKey(b64: string): Key {
  const key = Buffer.from(b64.trim(), 'base64');
  if (key.length !== 32) throw new Error('DATA_ENCRYPTION_KEY debe ser de 32 bytes en base64 (genera una con: openssl rand -base64 32).');
  return { id: keyId(key), key };
}

export class FieldCipher {
  private keys = new Map<string, Buffer>();
  readonly current: Key;
  constructor(current: string, previous: string[] = []) {
    this.current = parseKey(current); this.keys.set(this.current.id, this.current.key);
    for (const p of previous.filter(Boolean)) { const k = parseKey(p); this.keys.set(k.id, k.key); }
  }

  isEncrypted(v: unknown): v is string { return typeof v === 'string' && v.startsWith(PREFIX); }
  /** ¿Está cifrado con la clave actual? */
  isCurrent(v: string) { return v.startsWith(PREFIX + this.current.id + ':'); }

  encryptValue(v: unknown): string {
    const iv = randomBytes(12); const c = createCipheriv('aes-256-gcm', this.current.key, iv);
    const ct = Buffer.concat([c.update(JSON.stringify(v), 'utf8'), c.final()]);
    return `${PREFIX}${this.current.id}:${iv.toString('base64url')}:${c.getAuthTag().toString('base64url')}:${ct.toString('base64url')}`;
  }
  decryptValue(s: string): unknown {
    const [, , id, iv, tag, ct] = s.split(':'); const key = this.keys.get(id);
    if (!key) throw new Error(`Dato cifrado con una clave desconocida (${id}). Define DATA_ENCRYPTION_KEY_PREVIOUS con la clave anterior.`);
    const d = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url')); d.setAuthTag(Buffer.from(tag, 'base64url'));
    return JSON.parse(Buffer.concat([d.update(Buffer.from(ct, 'base64url')), d.final()]).toString('utf8'));
  }
}

/** Recorre una ruta («a.b», «x[]») sobre `o` y aplica `fn` a cada hoja existente; `fn` devuelve el valor nuevo. */
function walk(o: Record<string, unknown>, path: string[], fn: (v: unknown) => unknown) {
  const [head, ...rest] = path; if (!head || o == null || typeof o !== 'object') return;
  if (!(head in o)) return; const v = o[head];
  if (rest.length === 0) { if (v !== undefined && v !== null && v !== '') o[head] = fn(v); return; }
  if (Array.isArray(v)) for (const it of v) walk(it as Record<string, unknown>, rest, fn); else walk(v as Record<string, unknown>, rest, fn);
}

/** Copia de la fila con los campos sensibles cifrados (los ya cifrados con la clave actual se dejan igual). */
export function encryptRow<T extends object>(c: FieldCipher, tbl: string, row: T): T {
  const paths = SENSITIVE[tbl]; if (!paths) return row; const out = structuredClone(row) as Record<string, unknown>;
  for (const p of paths) walk(out, p.split('.'), (v) => (c.isEncrypted(v) && c.isCurrent(v) ? v : c.encryptValue(c.isEncrypted(v) ? c.decryptValue(v) : v)));
  return out as T;
}

/** Descifra en sitio los campos sensibles. Devuelve true si algo estaba SIN cifrar o con otra clave (la fila debe reescribirse). */
export function decryptRow(c: FieldCipher | null, tbl: string, row: Record<string, unknown>): boolean {
  const paths = SENSITIVE[tbl]; if (!paths) return false; let rewrite = false;
  for (const p of paths) walk(row, p.split('.'), (v) => {
    if (typeof v === 'string' && v.startsWith(PREFIX)) {
      if (!c) throw new Error('La base contiene datos cifrados: define DATA_ENCRYPTION_KEY (la misma con que se cifraron).');
      if (!c.isCurrent(v)) rewrite = true; return c.decryptValue(v);
    }
    if (c) rewrite = true; return v;
  });
  return rewrite;
}

/** Cuerpo completo cifrado (para el modo personal, que no tiene campos fijos). */
export const encryptBlob = (c: FieldCipher, text: string) => c.encryptValue(text);
export const isBlob = (s: string) => s.startsWith(PREFIX);
export const decryptBlob = (c: FieldCipher | null, s: string): string => {
  if (!isBlob(s)) return s; if (!c) throw new Error('El estado personal está cifrado: define DATA_ENCRYPTION_KEY.'); return c.decryptValue(s) as string;
};
