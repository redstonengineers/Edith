import { useEffect } from 'react';
import { Modal } from './Overlay';
import { Kbd } from './primitives';
import { useUi } from '@/store/ui';

const ROWS: [string[], string][] = [[['Ctrl', 'K'], 'Buscador global y comandos'], [['?'], 'Mostrar esta ayuda'], [['↑', '↓'], 'Navegar por los resultados'], [['↵'], 'Abrir / ejecutar'], [['Esc'], 'Cerrar paneles y diálogos'], [['Tab'], 'Moverse entre controles']];
export function ShortcutsDialog() {
  const open = useUi((s) => s.shortcutsOpen); const set = useUi((s) => s.setShortcuts);
  useEffect(() => {
    const on = (e: KeyboardEvent) => { const t = e.target as HTMLElement; if (e.key === '?' && !/INPUT|TEXTAREA|SELECT/.test(t.tagName) && !t.isContentEditable) { e.preventDefault(); set(true); } };
    window.addEventListener('keydown', on); return () => window.removeEventListener('keydown', on);
  }, [set]);
  return (
    <Modal open={open} onClose={() => set(false)} label="Atajos de teclado" className="max-w-md">
      <div className="p-6"><h2 className="text-base font-semibold">Atajos de teclado</h2>
        <ul className="mt-4 space-y-2.5">{ROWS.map(([k, d]) => <li key={d} className="flex items-center justify-between gap-4 text-sm"><span>{d}</span><span className="flex gap-1">{k.map((x) => <Kbd key={x}>{x}</Kbd>)}</span></li>)}</ul></div>
    </Modal>
  );
}
