// Comprueba que una copia de seguridad es restaurable: npm run backup:verify -- /ruta/academy-....db
import { verifyBackup } from './backup';
const f = process.argv[2]; if (!f) { console.error('Uso: npm run backup:verify -- <archivo.db>'); process.exit(2); }
const r = verifyBackup(f); console.log(r.ok ? `OK: copia válida (${r.entities} registros).` : `ERROR: ${r.error}`); process.exit(r.ok ? 0 : 1);
