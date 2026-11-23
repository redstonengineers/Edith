/**
 * Alta de un cliente desde la consola del servidor (alternativa al panel «Clientes» del modo personal):
 *   npm run client:new -- --name "Autoescuela Sol" --type autoescuela --plan pro --email admin@sol.es [--admin "Ana López"]
 * La contraseña inicial se genera al azar, se muestra UNA vez aquí y el cliente debe cambiarla en su primer acceso.
 * Úsalo con el servidor parado (o reinícialo después): escribe directamente en la base de DB_PATH.
 */
import { setHasher } from '../src/services/crypto';
import { installDatabase, getDatabase } from '../src/services/database';
import { PRESETS } from '../src/config/presets';
import { scryptHasher } from './password';
import { Store } from './store';
import { config } from './config';
import { createClient } from './clients';

const arg = (k: string) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : undefined; };
const name = arg('name'); const type = arg('type') ?? 'educativa'; const plan = (arg('plan') ?? 'basic') as 'trial' | 'basic' | 'pro' | 'premium'; const email = arg('email');
if (!name || !email || !(type in PRESETS) || !['trial', 'basic', 'pro', 'premium'].includes(plan)) { console.error('Uso: npm run client:new -- --name "Negocio" --type <sector> --plan <trial|basic|pro|premium> --email admin@negocio.es [--admin "Nombre"]\nSectores: ' + Object.keys(PRESETS).join(', ')); process.exit(1); }
setHasher(scryptHasher);
const store = new Store(config.dbPath); installDatabase(store.load(), () => undefined);
try {
  const r = await createClient({ academyName: name, type: type as never, plan, adminEmail: email, adminName: arg('admin') });
  store.flush(getDatabase());
  console.log(`\nCliente creado: ${r.name} (${r.academyId}) · plan ${r.plan}\n  Correo:     ${r.adminEmail}\n  Contraseña: ${r.password}\n\nGuárdala ahora: no se vuelve a mostrar. El cliente la cambiará en su primer acceso (/login).\n`);
} catch (e) { console.error(`No se pudo crear: ${(e as Error).message}`); process.exitCode = 1; } finally { store.close(); }
