/**
 * Restaura los datos de las demos (Atlanta, Academia, Clínica) a su estado de fábrica:  npm run demo:reset
 * Solo toca negocios con isDemo: true. Hazlo con el servidor parado (o usa el botón «Restaurar demos» del panel Clientes,
 * que lo hace sin parar nada). El servidor ya lo hace solo cada día a las 4:00 (DEMO_RESET_HOUR, DEMO_RESET_DAILY=0 lo desactiva).
 */
import { setHasher } from '../src/services/crypto';
import { installDatabase, getDatabase } from '../src/services/database';
import { scryptHasher } from './password';
import { Store } from './store';
import { config } from './config';
import { resetDemos } from './demo';

setHasher(scryptHasher);
const store = new Store(config.dbPath); installDatabase(store.load(), () => undefined);
try { const r = resetDemos(store); store.flush(getDatabase()); console.log(`Demos restauradas: ${r.join(', ') || 'ninguna (¿hay negocios con isDemo?)'}`); } finally { store.close(); }
