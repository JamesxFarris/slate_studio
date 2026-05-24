import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, ...rest },
  ref
) {
  return (
    <textarea
      ref={ref}
      className={cn(
        'flex min-h-[120px] w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm',
        'text-zinc-100 placeholder:text-zinc-500',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-500 focus-visible:border-studio-500',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'font-mono leading-relaxed',
        className
      )}
      {...rest}
    />
  );
});
