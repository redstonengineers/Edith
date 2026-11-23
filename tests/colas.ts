// Colas de escritura por negocio: orden dentro de un negocio, paralelismo entre negocios, exclusividad de las operaciones de plataforma y rollback por negocio.
// Uso: npx tsx tests/colas.ts
import { generateDatabase } from '../src/data/seed';
import { KeyedQueue } from '../server/queues';
import { Store } from '../server/store';

let fails = 0; const ok = (c: boolean, m: string) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// 1. Orden dentro de un negocio y paralelismo entre dos negocios
const q = new KeyedQueue(); const log: string[] = [];
const t0 = Date.now();
const a1 = q.run('A', async () => { log.push('A1 start'); await wait(150); log.push('A1 end'); });
const a2 = q.run('A', async () => { log.push('A2 start'); await wait(10); log.push('A2 end'); });
const b1 = q.run('B', async () => { log.push('B1 start'); await wait(10); log.push('B1 end'); return Date.now() - t0; });
const bDone = await b1; await Promise.all([a1, a2]);
ok(log.indexOf('A1 end') < log.indexOf('A2 start'), 'en un mismo negocio las operaciones van de una en una y en orden');
ok(log.indexOf('B1 end') < log.indexOf('A1 end') && bDone < 120, `un negocio lento (150 ms) no bloquea a otro (B terminó a los ${bDone} ms)`);

// 2. Una operación que falla no bloquea la cola
const f = q.run('A', () => { throw new Error('boom'); }); await f.catch(() => undefined); ok(await q.run('A', () => 7) === 7, 'tras un fallo la cola sigue funcionando');

// 3. Las operaciones de plataforma son exclusivas
const order: string[] = [];
const p1 = q.run('A', async () => { order.push('A in'); await wait(60); order.push('A out'); });
const p2 = q.run('B', async () => { order.push('B in'); await wait(30); order.push('B out'); });
const all = q.runAll(async () => { order.push('ALL in'); await wait(30); order.push('ALL out'); });
const p3 = q.run('C', async () => { order.push('C in'); order.push('C out'); });
await Promise.all([p1, p2, all, p3]);
ok(order.indexOf('ALL in') > order.indexOf('A out') && order.indexOf('ALL in') > order.indexOf('B out'), 'la operación de plataforma espera a que acaben las de todos los negocios');
ok(order.indexOf('C in') > order.indexOf('ALL out'), 'y las que llegan después esperan a que ella termine');

// 4. Rollback por negocio: revierte lo no guardado de A sin tocar lo de B
const src = generateDatabase(new Date()); const st = new Store(':memory:'); st.load(); st.flush(src);
const ids = [...new Set(src.students.map((s) => s.academyId))]; const [A, B] = ids; const live = st.load();
const sA = live.students.filter((s) => s.academyId === A); const sB = live.students.filter((s) => s.academyId === B);
const keepA = sA[0].notes; const nA = sA.length; const nB = sB.length; const arrRef = live.students;
sA[0].notes = 'CAMBIO A MEDIAS'; live.students.push({ ...sA[1], id: 'nuevo_en_A' });            // operación de A que va a fallar
sB[0].notes = 'CAMBIO VÁLIDO DE B'; live.students.push({ ...sB[1], id: 'nuevo_en_B' });           // operación correcta de B, aún sin guardar
st.rollbackAcademy(live, A);
ok(live.students === arrRef, 'el rollback es en sitio (las referencias a los arrays siguen valiendo)');
ok(live.students.filter((s) => s.academyId === A).length === nA && !live.students.some((s) => s.id === 'nuevo_en_A') && live.students.find((s) => s.id === sA[0].id)!.notes === keepA, 'el negocio A vuelve a su estado guardado');
ok(live.students.find((s) => s.id === sB[0].id)!.notes === 'CAMBIO VÁLIDO DE B' && live.students.some((s) => s.id === 'nuevo_en_B') && live.students.filter((s) => s.academyId === B).length === nB + 1, 'el negocio B conserva su cambio válido');
st.flush(live); const again = st.load(); ok(again.students.some((s) => s.id === 'nuevo_en_B') && !again.students.some((s) => s.id === 'nuevo_en_A'), 'al guardar solo persiste lo de B'); st.close();
console.log(fails ? `${fails} FALLOS` : 'TODO OK'); process.exit(fails ? 1 : 0);
