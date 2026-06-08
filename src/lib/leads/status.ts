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
      return 'border-slate-500/20 bg-slate-500/10 text-slate-200';
    case 'violet':
      return 'border-violet-500/20 bg-violet-500/10 text-violet-200';
    case 'blue':
      return 'border-blue-500/20 bg-blue-500/10 text-blue-200';
    case 'emerald':
      return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200';
    case 'amber':
      return 'border-amber-500/20 bg-amber-500/10 text-amber-200';
    case 'rose':
      return 'border-rose-500/20 bg-rose-500/10 text-rose-200';
    default:
      return 'border-zinc-700 bg-zinc-900 text-zinc-300';
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
