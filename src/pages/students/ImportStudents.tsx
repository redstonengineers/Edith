import { useMemo, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { FormModal } from '@/components/ui/FormModal';
import { useAction, useUser } from '@/hooks';
import { normDate, parseCsv } from '@/lib/practices';
import { downloadCsv } from '@/lib/reports';
import { fieldErrors, studentSchema, type StudentInput } from '@/lib/schemas';
import { importStudents } from '@/services/mutations';
import { norm } from '@/utils/format';

const ALIAS: Record<string, string[]> = {
  firstName: ['nombre', 'name', 'first name'], lastName: ['apellidos', 'apellido', 'last name', 'surname'],
  birthDate: ['nacimiento', 'fecha de nacimiento', 'fecha nacimiento', 'birthdate', 'birth date'], email: ['email', 'correo', 'correo electronico', 'e-mail'], phone: ['telefono', 'movil', 'phone', 'tel'],
};

/** Importa alumnos desde un CSV (Excel → Guardar como CSV). Valida fila a fila y muestra qué se importará. */
export function ImportStudents({ onClose }: { onClose: () => void }) {
  const user = useUser(); const run = useAction(); const [text, setText] = useState(''); const [top, setTop] = useState<string | null>(null);
  const parsed = useMemo(() => {
    const rows = parseCsv(text); if (rows.length < 2) return { ok: [] as StudentInput[], bad: [] as { line: number; why: string }[], missing: [] as string[] };
    const head = rows[0].map((h) => norm(h)); const idx = (k: string) => head.findIndex((h) => ALIAS[k].includes(h));
    const cols = Object.fromEntries(Object.keys(ALIAS).map((k) => [k, idx(k)])); const missing = Object.entries(cols).filter(([, i]) => i < 0).map(([k]) => k);
    const ok: StudentInput[] = []; const bad: { line: number; why: string }[] = [];
    if (missing.length) return { ok, bad, missing };
    rows.slice(1).forEach((r, n) => {
      const v = (k: string) => r[cols[k]] ?? '';
      const res = studentSchema.safeParse({ firstName: v('firstName'), lastName: v('lastName'), birthDate: normDate(v('birthDate')), email: v('email'), phone: v('phone'), notes: '' });
      if (res.success) ok.push(res.data); else bad.push({ line: n + 2, why: Object.values(fieldErrors(res.error))[0] ?? 'Fila no válida' });
    });
    return { ok, bad, missing };
  }, [text]);
  const file = (f?: File) => { if (f) void f.text().then(setText); };
  const submit = async () => {
    setTop(null); if (!parsed.ok.length) { setTop('No hay filas válidas que importar.'); return; }
    try { const r = await run(() => importStudents(user, parsed.ok), `${parsed.ok.length} alumnos importados`); if (r) onClose(); } catch (e) { setTop((e as Error).message); }
  };
  const tpl = () => downloadCsv('plantilla-alumnos', { columns: ['Nombre', 'Apellidos', 'Fecha de nacimiento', 'Correo', 'Teléfono'], rows: [['Lucía', 'Pérez Gil', '2005-03-14', 'lucia@correo.es', '600123456']] });
  return (
    <FormModal open onClose={onClose} title="Importar alumnos" description="Sube un CSV (en Excel: Guardar como → CSV). Columnas: Nombre, Apellidos, Fecha de nacimiento, Correo y Teléfono." onSubmit={submit} submitLabel={parsed.ok.length ? `Importar ${parsed.ok.length}` : 'Importar'} error={top} wide>
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-line px-3 text-sm hover:bg-surface-2"><Upload size={15} />Elegir archivo CSV<input type="file" accept=".csv,text/csv" className="sr-only" aria-label="Archivo CSV" onChange={(e) => file(e.target.files?.[0])} /></label>
        <button type="button" onClick={tpl} className="inline-flex h-10 items-center gap-2 text-sm text-muted hover:text-fg"><Download size={15} />Descargar plantilla</button>
      </div>
      <textarea aria-label="Contenido CSV" value={text} onChange={(e) => setText(e.target.value)} rows={5} placeholder="…o pega aquí el contenido del CSV" className="w-full rounded-lg border border-line bg-surface p-3 font-mono text-xs" />
      {parsed.missing.length > 0 && <p role="alert" className="text-sm text-bad">Faltan columnas: {parsed.missing.map((m) => ({ firstName: 'Nombre', lastName: 'Apellidos', birthDate: 'Fecha de nacimiento', email: 'Correo', phone: 'Teléfono' })[m]).join(', ')}.</p>}
      {text && !parsed.missing.length && (
        <div className="text-sm" aria-live="polite"><p><b className="tnum">{parsed.ok.length}</b> filas válidas{parsed.bad.length > 0 && <> · <b className="tnum text-bad">{parsed.bad.length}</b> con errores (no se importarán)</>}</p>
          {parsed.bad.length > 0 && <ul className="mt-1 max-h-28 overflow-auto text-xs text-bad">{parsed.bad.slice(0, 20).map((b) => <li key={b.line}>Línea {b.line}: {b.why}</li>)}</ul>}</div>)}
    </FormModal>
  );
}
