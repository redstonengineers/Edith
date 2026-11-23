import { ASSISTANT_NAME } from '@/config/brand';
import { Link } from 'react-router-dom';
import { Maximize2 } from 'lucide-react';
import { Drawer } from '@/components/ui/Overlay';
import { aiProvider } from '@/lib/ai';
import { useUi } from '@/store/ui';
import { AiHeader, Chat } from './Chat';

export function AiPanel() {
  const open = useUi((s) => s.aiOpen); const setOpen = useUi((s) => s.setAi);
  return (
    <Drawer open={open} onClose={() => setOpen(false)} label={ASSISTANT_NAME} className="w-[min(94vw,440px)]">
      <AiHeader provider={aiProvider.label} />
      <Link to="/jarvis" onClick={() => setOpen(false)} className="absolute top-3 right-12 grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg" aria-label="Abrir en pantalla completa"><Maximize2 size={15} /></Link>
      <Chat autoFocus onNavigate={() => setOpen(false)} />
    </Drawer>
  );
}
