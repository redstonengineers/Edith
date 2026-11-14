import { useSettings } from '@/hooks';

export function BrandMark({ size = 32 }: { size?: number }) {
  const { branding } = useSettings();
  if (branding.logoUrl) return <img src={branding.logoUrl} alt="" width={size} height={size} className="rounded-lg object-contain" />;
  return (
    <span aria-hidden className="grid shrink-0 place-items-center rounded-[10px] font-bold text-on-brand" style={{ width: size, height: size, fontSize: size * 0.42, background: 'linear-gradient(135deg, var(--brand), var(--brand-2))' }}>
      {branding.name.trim()[0]?.toUpperCase()}
    </span>
  );
}
