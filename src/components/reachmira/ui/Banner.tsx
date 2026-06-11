'use client';

import type { ReactNode } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

type Tone = 'error' | 'success' | 'info' | 'warning';

const toneConfig: Record<Tone, { classes: string; Icon: typeof AlertCircle }> = {
  error: { classes: 'border-rose-200 bg-rose-50 text-rose-700', Icon: AlertCircle },
  success: { classes: 'border-emerald-200 bg-emerald-50 text-emerald-700', Icon: CheckCircle2 },
  info: { classes: 'border-sky-200 bg-sky-50 text-sky-700', Icon: Info },
  warning: { classes: 'border-amber-200 bg-amber-50 text-amber-700', Icon: AlertTriangle },
};

type BannerProps = {
  tone: Tone;
  children: ReactNode;
  onDismiss?: () => void;
  className?: string;
};

export default function Banner({ tone, children, onDismiss, className = '' }: BannerProps) {
  const { classes, Icon } = toneConfig[tone];
  return (
    <div className={`flex items-center gap-2 rounded-2xl border p-4 text-sm ${classes} ${className}`} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon className="h-5 w-5 shrink-0" />
      <span className="flex-1">{children}</span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="cursor-pointer rounded-lg p-1 opacity-60 transition hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
