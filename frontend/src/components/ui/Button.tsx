import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

// Minimal shadcn-style Button. Tailwind only, no Radix. Three variants kept
// because that's everything the v1 UI needs (primary CTA, secondary surface,
// quiet inline button).
type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'sm' | 'md';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-studio-500 text-zinc-950 hover:bg-studio-400 focus-visible:ring-studio-300 disabled:bg-studio-800 disabled:text-zinc-400',
  secondary:
    'bg-zinc-800 text-zinc-100 hover:bg-zinc-700 focus-visible:ring-zinc-500 disabled:opacity-50',
  ghost:
    'bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 focus-visible:ring-zinc-600',
};

const sizeClasses: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', className, type = 'button', ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950',
        'disabled:cursor-not-allowed',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...rest}
    />
  );
});
