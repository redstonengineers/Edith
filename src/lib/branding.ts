import { PRODUCT_NAME } from '@/config/brand';
import type { Settings, ThemeMode } from '@/types';
import { onColor } from './color';

/** Aplica marca y tema al documento. Única vía por la que la marca llega a los estilos. */
export function applyBranding(settings: Settings | null, theme: ThemeMode) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  if (!settings) return;
  root.style.setProperty('--brand', settings.branding.primary);
  root.style.setProperty('--brand-2', settings.branding.secondary);
  root.style.setProperty('--on-brand', onColor(settings.branding.primary));
  document.title = `${settings.branding.name} · ${PRODUCT_NAME}`;
  const link = document.getElementById('app-favicon') as HTMLLinkElement | null;
  if (link && settings.branding.faviconUrl) link.href = settings.branding.faviconUrl;
}
