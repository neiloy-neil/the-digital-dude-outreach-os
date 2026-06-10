'use client';

import { useEffect, useRef, useState } from 'react';
import { X, CheckCircle2, XCircle, Info, AlertTriangle } from 'lucide-react';
import { useToastContext, type Toast } from '@/lib/toast/toast-context';

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
};

const COLORS = {
  success: {
    border: 'border-l-emerald-500',
    icon: 'text-emerald-500',
    progress: 'bg-emerald-500',
  },
  error: {
    border: 'border-l-rose-500',
    icon: 'text-rose-500',
    progress: 'bg-rose-500',
  },
  info: {
    border: 'border-l-violet-500',
    icon: 'text-violet-500',
    progress: 'bg-violet-500',
  },
  warning: {
    border: 'border-l-amber-500',
    icon: 'text-amber-500',
    progress: 'bg-amber-500',
  },
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [progress, setProgress] = useState(100);
  const startRef = useRef<number>(0);
  const animFrameRef = useRef<number | null>(null);

  // Trigger enter animation on mount
  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // Progress bar countdown
  useEffect(() => {
    if (toast.duration <= 0) return;
    startRef.current = Date.now();

    const tick = () => {
      const elapsed = Date.now() - startRef.current;
      const pct = Math.max(0, 100 - (elapsed / toast.duration) * 100);
      setProgress(pct);
      if (pct > 0) {
        animFrameRef.current = requestAnimationFrame(tick);
      }
    };
    animFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [toast.duration]);

  const handleDismiss = () => {
    setLeaving(true);
    setTimeout(() => onDismiss(toast.id), 300);
  };

  const Icon = ICONS[toast.type];
  const colors = COLORS[toast.type];

  return (
    <div
      style={{
        transform: visible && !leaving ? 'translateX(0)' : 'translateX(calc(100% + 24px))',
        opacity: visible && !leaving ? 1 : 0,
        transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease',
      }}
      className={`relative w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-[0_8px_32px_rgba(15,23,42,0.12)] border-l-4 ${colors.border}`}
    >
      <div className="flex items-start gap-3 px-4 py-3.5">
        <Icon className={`mt-0.5 h-4.5 w-4.5 shrink-0 ${colors.icon}`} />
        <p className="flex-1 text-sm leading-snug text-zinc-800">{toast.message}</p>
        <button
          onClick={handleDismiss}
          className="shrink-0 rounded-lg p-0.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600"
          aria-label="Dismiss notification"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Progress bar */}
      {toast.duration > 0 && (
        <div className="h-0.5 w-full bg-zinc-100">
          <div
            className={`h-full transition-none ${colors.progress}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}

export default function ToastContainer() {
  const { toasts, dismissToast } = useToastContext();

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-[72px] right-5 z-[9999] flex flex-col gap-2.5"
      aria-live="assertive"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
      ))}
    </div>
  );
}
