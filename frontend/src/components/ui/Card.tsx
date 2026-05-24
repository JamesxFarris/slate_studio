import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function Card({ className, ...rest }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          'rounded-lg border border-zinc-800 bg-zinc-900/60 shadow-sm backdrop-blur-sm',
          className
        )}
        {...rest}
      />
    );
  }
);

export const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function CardHeader({ className, ...rest }, ref) {
    return (
      <div
        ref={ref}
        className={cn('flex items-center justify-between px-4 py-3 border-b border-zinc-800', className)}
        {...rest}
      />
    );
  }
);

export const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  function CardTitle({ className, ...rest }, ref) {
    return (
      <h3
        ref={ref}
        className={cn('text-sm font-semibold tracking-tight text-zinc-100', className)}
        {...rest}
      />
    );
  }
);

export const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function CardContent({ className, ...rest }, ref) {
    return <div ref={ref} className={cn('px-4 py-3', className)} {...rest} />;
  }
);

export const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function CardFooter({ className, ...rest }, ref) {
    return (
      <div
        ref={ref}
        className={cn('px-4 py-2 border-t border-zinc-800 text-xs text-zinc-500', className)}
        {...rest}
      />
    );
  }
);
