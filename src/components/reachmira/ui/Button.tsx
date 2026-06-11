'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import Spinner from '../Spinner';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
};

const baseClasses =
  'inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 disabled:cursor-not-allowed disabled:opacity-50';

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-gradient-to-r from-violet-600 to-teal-500 text-white shadow-lg shadow-violet-600/20 hover:opacity-95 active:scale-[0.98]',
  secondary:
    'border border-[var(--border)] bg-white text-zinc-700 shadow-sm hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700',
  ghost: 'text-zinc-600 hover:bg-violet-50 hover:text-violet-700',
  danger: 'border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100',
};

const sizeClasses: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2.5 text-sm',
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading = false, disabled, className = '', children, type = 'button', ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...rest}
    >
      {loading && <Spinner size={size === 'sm' ? 12 : 14} />}
      {children}
    </button>
  );
});

export default Button;
