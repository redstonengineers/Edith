// Genera src/services/mutations.remote.ts a partir de las funciones exportadas por mutations.local.ts.
import { readFileSync, writeFileSync } from 'node:fs';
const src = readFileSync(new URL('./src/services/mutations.local.ts', import.meta.url), 'utf8');
const fns = [...src.matchAll(/^export (?:async )?function (\w+)\(/gm)].map((m) => m[1]).filter((n) => n !== 'createAcademy');
const consts = [...src.matchAll(/^export (?:const|class) (\w+)/gm)].map((m) => m[1]);
const out = `// ARCHIVO GENERADO por scripts-gen-remote.mjs: no editar a mano.
import { rpc, post } from './http';
import type * as L from './mutations.local';
export { ${consts.join(', ')} } from './mutations.local';

${fns.map((n) => `export const ${n} = ((_user: unknown, ...args: unknown[]) => rpc('${n}', args)) as unknown as typeof L.${n};`).join('\n')}

/** Alta pública de academia (onboarding): endpoint propio, sin sesión previa. */
export const createAcademy = ((input: unknown) => post('/onboarding', input)) as unknown as typeof L.createAcademy;
`;
writeFileSync(new URL('./src/services/mutations.remote.ts', import.meta.url), out);
console.log('generated', fns.length, 'wrappers');
