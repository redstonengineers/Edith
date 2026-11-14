import { Car, ExternalLink, FileSignature, PenLine, Wrench, FileBarChart, Smartphone } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Panel } from '@/components/ui/primitives';
import { useLabels } from '@/hooks';

/** URL de la aplicación de prácticas (Volanta). Configurable en el build: VITE_VOLANTA_URL. */
const VOLANTA_URL = import.meta.env.VITE_VOLANTA_URL ?? 'https://volanta.redstonengineers.com';

const FEATURES = [
  { icon: Car, title: 'Calendario de prácticas', text: 'Vista de día en móvil y de semana en pantalla grande, con franja de color por profesor, clases repetidas y aviso de choques.' },
  { icon: PenLine, title: 'Firma táctil sin conexión', text: 'El alumno y el profesor firman en el móvil tras cada clase; si no hay cobertura, se guarda y se envía al volver.' },
  { icon: Wrench, title: 'Vehículos', text: 'Kilómetros y gasto por coche, ITV, seguro y revisiones con aviso a 30 y 7 días, y coche en taller bloqueado.' },
  { icon: FileBarChart, title: 'Parte mensual', text: 'Informe del mes por profesor y por coche, con exámenes y porcentaje de aprobados; exporta a CSV o PDF.' },
  { icon: FileSignature, title: 'Ficha y exámenes', text: 'Historial de horas y kilómetros, barra de progreso hacia las horas objetivo y avisos de examen por WhatsApp.' },
  { icon: Smartphone, title: 'App instalable y avisos', text: 'Se instala en el móvil como una app y envía avisos push de las clases de mañana.' },
];

export default function PracticasPage() {
  const L = useLabels();
  return (
    <>
      <PageHeader title="Prácticas y vehículos" description={`Gestión diaria de ${L.class.plural.toLowerCase()} en carretera: firma, coches y parte mensual.`}
        actions={<a href={VOLANTA_URL} target="_blank" rel="noopener noreferrer" className="press inline-flex h-10 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-on-brand hover:brightness-110">Abrir prácticas <ExternalLink size={15} aria-hidden /></a>} />
      <Panel title="Qué incluye">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line bg-surface-2 text-brand-text"><Icon size={17} aria-hidden /></span>
              <div><h3 className="text-sm font-semibold">{title}</h3><p className="mt-0.5 text-sm text-muted">{text}</p></div></li>))}
        </ul>
      </Panel>
      <p className="mt-4 text-xs text-muted">Se abre en una pestaña nueva. La primera vez, entra con el correo y la contraseña de tu centro y pulsa «Instalar la app» desde el icono de perfil.</p>
    </>
  );
}
