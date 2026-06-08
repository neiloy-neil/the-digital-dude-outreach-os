export const LEAD_STATUSES = [
  'new',
  'imported',
  'data_reviewed',
  'ai_generated',
  'manual_email_draft',
  'email_approved',
  'mail_sent',
  'manual_email_sent',
  'follow_up_1_sent',
  'follow_up_2_sent',
  'follow_up_3_sent',
  'replied',
  'interested',
  'not_interested',
  'demo_scheduled',
  'proposal_sent',
  'won',
  'lost',
  'bounced',
  'unsubscribed',
  'do_not_contact',
  'excluded',
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const EMAIL_TYPES = [
  'first_email',
  'follow_up_1',
  'follow_up_2',
  'follow_up_3',
  'custom_email',
  'proposal_email',
  'demo_follow_up',
  'reply_follow_up',
] as const;

export type EmailType = (typeof EMAIL_TYPES)[number];

export function getLeadStatusLabel(status?: string | null) {
  if (!status) return 'Unknown';
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function getLeadStatusTone(status?: string | null) {
  switch (status) {
    case 'new':
    case 'imported':
    case 'data_reviewed':
      return 'slate';
    case 'ai_generated':
    case 'manual_email_draft':
    case 'email_approved':
      return 'violet';
    case 'mail_sent':
    case 'manual_email_sent':
    case 'follow_up_1_sent':
    case 'follow_up_2_sent':
    case 'follow_up_3_sent':
    case 'proposal_sent':
      return 'blue';
    case 'replied':
    case 'interested':
    case 'demo_scheduled':
    case 'won':
      return 'emerald';
    case 'not_interested':
    case 'lost':
      return 'amber';
    case 'bounced':
    case 'unsubscribed':
    case 'do_not_contact':
    case 'excluded':
      return 'rose';
    default:
      return 'zinc';
  }
}

export function getLeadStatusClassName(status?: string | null) {
  const tone = getLeadStatusTone(status);
  switch (tone) {
    case 'slate':
      return 'border-slate-200 bg-slate-100 text-slate-700';
    case 'violet':
      return 'border-violet-200 bg-violet-50 text-violet-700';
    case 'blue':
      return 'border-sky-200 bg-sky-50 text-sky-700';
    case 'emerald':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'amber':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'rose':
      return 'border-rose-200 bg-rose-50 text-rose-700';
    default:
      return 'border-zinc-200 bg-zinc-100 text-zinc-700';
  }
}

export function getStatusForEmailType(emailType: EmailType) {
  switch (emailType) {
    case 'first_email':
      return 'mail_sent';
    case 'follow_up_1':
      return 'follow_up_1_sent';
    case 'follow_up_2':
      return 'follow_up_2_sent';
    case 'follow_up_3':
      return 'follow_up_3_sent';
    case 'proposal_email':
      return 'proposal_sent';
    case 'custom_email':
      return 'manual_email_sent';
    case 'demo_follow_up':
      return 'demo_scheduled';
    case 'reply_follow_up':
      return 'replied';
    default:
      return 'manual_email_sent';
  }
}

export function isBlockedLeadStatus(status?: string | null) {
  return ['bounced', 'unsubscribed', 'do_not_contact', 'excluded'].includes(String(status || '').toLowerCase());
}

export function isRepliedStatus(status?: string | null) {
  return ['replied', 'interested', 'not_interested', 'demo_scheduled', 'proposal_sent', 'won', 'lost'].includes(
    String(status || '').toLowerCase()
  );
}

export function getFollowUpStage(status?: string | null) {
  switch (status) {
    case 'follow_up_1_sent':
      return 1;
    case 'follow_up_2_sent':
      return 2;
    case 'follow_up_3_sent':
      return 3;
    default:
      return 0;
  }
}
