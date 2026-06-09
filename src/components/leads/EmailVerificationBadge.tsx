type EmailVerificationStatus =
  | 'not_checked'
  | 'valid'
  | 'risky'
  | 'invalid'
  | 'role_based'
  | 'disposable'
  | 'suppressed'
  | 'unknown'
  | 'failed';

const STATUS_STYLES: Record<EmailVerificationStatus, string> = {
  valid: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  risky: 'bg-amber-50 text-amber-700 ring-amber-200',
  invalid: 'bg-rose-50 text-rose-700 ring-rose-200',
  role_based: 'bg-sky-50 text-sky-700 ring-sky-200',
  disposable: 'bg-orange-50 text-orange-700 ring-orange-200',
  suppressed: 'bg-zinc-100 text-zinc-700 ring-zinc-200',
  not_checked: 'bg-zinc-50 text-zinc-600 ring-zinc-200',
  unknown: 'bg-violet-50 text-violet-700 ring-violet-200',
  failed: 'bg-rose-50 text-rose-700 ring-rose-200',
};

const STATUS_LABELS: Record<EmailVerificationStatus, string> = {
  valid: 'Valid',
  risky: 'Risky',
  invalid: 'Invalid',
  role_based: 'Role-based',
  disposable: 'Disposable',
  suppressed: 'Suppressed',
  not_checked: 'Not Checked',
  unknown: 'Unknown',
  failed: 'Failed',
};

function normalizeStatus(value?: string | null): EmailVerificationStatus {
  const candidate = String(value || 'not_checked').trim().toLowerCase() as EmailVerificationStatus;
  return candidate in STATUS_STYLES ? candidate : 'not_checked';
}

export default function EmailVerificationBadge({
  status,
}: {
  status?: string | null;
}) {
  const normalizedStatus = normalizeStatus(status);

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ring-1 ${STATUS_STYLES[normalizedStatus]}`}
    >
      {STATUS_LABELS[normalizedStatus]}
    </span>
  );
}
