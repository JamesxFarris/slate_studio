import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

// Native <select> styled to match the rest of the inputs. Radix Select isn't
// in the lockfile, and the only place we need a select right now is the
// Standard/Deep mode picker — overkill to pull in a portal-based component.
export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, children, ...rest },
  ref
) {
  return (
    <select
      ref={ref}
      className={cn(
        'flex h-10 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm',
        'text-zinc-100',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-500 focus-visible:border-studio-500',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...rest}
    >
      {children}
    </select>
  );
});
