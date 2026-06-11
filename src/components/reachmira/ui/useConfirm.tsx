'use client';

import { useCallback, useRef, useState, type ReactNode } from 'react';
import ConfirmDialog from './ConfirmDialog';

type ConfirmOptions = {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'default';
};

/**
 * Promise-based confirm for mid-flow checks — a drop-in replacement for
 * `window.confirm`: `if (!(await confirm({...}))) return;`
 * Render `confirmDialog` once at the component root.
 */
export function useConfirm(): { confirm: (opts: ConfirmOptions) => Promise<boolean>; confirmDialog: ReactNode } {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    setOptions(opts);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const settle = (value: boolean) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setOptions(null);
  };

  const confirmDialog = options ? (
    <ConfirmDialog
      open
      title={options.title}
      description={options.description}
      confirmLabel={options.confirmLabel || 'Confirm'}
      cancelLabel={options.cancelLabel || 'Cancel'}
      tone={options.tone || 'default'}
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    />
  ) : null;

  return { confirm, confirmDialog };
}
