import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

export function PageHeader({ title, description, actions, breadcrumbs }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; breadcrumbs?: { label: string; to?: string }[] }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {breadcrumbs && (
          <nav aria-label="Migas de pan" className="mb-1.5 flex items-center gap-1 text-xs text-muted">
            {breadcrumbs.map((b, i) => (<span key={i} className="flex items-center gap-1">{i > 0 && <ChevronRight size={12} aria-hidden />}{b.to ? <Link to={b.to} className="hover:text-fg">{b.label}</Link> : <span aria-current="page">{b.label}</span>}</span>))}
          </nav>
        )}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
