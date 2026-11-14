import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { cn } from '@/utils/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg' | 'icon';
const base = 'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors duration-150 disabled:opacity-50 disabled:pointer-events-none select-none whitespace-nowrap';
const variants: Record<Variant, string> = {
  primary: 'bg-brand text-on-brand hover:brightness-110 active:brightness-95 shadow-[0_0_0_1px_color-mix(in_oklab,var(--brand)_60%,transparent)]',
  secondary: 'bg-surface-2 text-fg border border-line hover:border-line-strong hover:bg-line/40',
  ghost: 'text-muted hover:text-fg hover:bg-surface-2',
  danger: 'bg-bad/15 text-bad border border-bad/30 hover:bg-bad/25',
};
const sizes: Record<Size, string> = { sm: 'h-8 px-3 text-[13px]', md: 'h-9 px-3.5 text-sm', lg: 'h-11 px-5 text-sm', icon: 'h-9 w-9' };
export const buttonClass = (v: Variant = 'secondary', s: Size = 'md', extra?: string) => cn(base, variants[v], sizes[s], extra);

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: Variant; size?: Size }
export const Button = forwardRef<HTMLButtonElement, Props>(({ variant = 'secondary', size = 'md', className, type = 'button', ...rest }, ref) => (
  <button ref={ref} type={type} className={buttonClass(variant, size, className)} {...rest} />
));
Button.displayName = 'Button';

export function LinkButton({ variant = 'secondary', size = 'md', className, ...rest }: LinkProps & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...rest} />;
}
