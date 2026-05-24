import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, type = 'text', ...rest },
  ref
) {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        'flex h-10 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm',
        'text-zinc-100 placeholder:text-zinc-500',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-500 focus-visible:border-studio-500',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...rest}
    />
  );
});
