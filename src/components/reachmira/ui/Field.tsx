'use client';

import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

const controlClasses =
  'mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm text-zinc-900 transition-colors placeholder:text-zinc-400 focus:border-violet-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/20 disabled:cursor-not-allowed disabled:bg-[var(--surface-muted)]';

type FieldProps = {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
};

export function Field({ label, htmlFor, hint, error, children }: FieldProps) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-xs font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-zinc-400">{hint}</p>}
      {error && <p className="mt-1 text-xs font-medium text-rose-600">{error}</p>}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className = '', ...rest },
  ref
) {
  return <input ref={ref} className={`${controlClasses} ${className}`} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className = '', children, ...rest },
  ref
) {
  return (
    <select ref={ref} className={`${controlClasses} ${className}`} {...rest}>
      {children}
    </select>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className = '', ...rest },
  ref
) {
  return <textarea ref={ref} className={`${controlClasses} ${className}`} {...rest} />;
});

/** Convenience wrapper: Field + Input with an auto-generated id wiring label to control. */
export function LabeledInput({
  label,
  hint,
  error,
  ...inputProps
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string | null }) {
  const id = useId();
  return (
    <Field label={label} htmlFor={id} hint={hint} error={error}>
      <Input id={id} {...inputProps} />
    </Field>
  );
}
