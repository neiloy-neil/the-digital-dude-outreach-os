import 'server-only';

import { createServiceClient } from '@/utils/supabase/service';

interface AuditLogPayload {
  userId: string;
  campaignId?: string | null;
  leadId?: string | null;
  action: string;
  message?: string | null;
  metadata?: Record<string, unknown>;
}

export async function createAuditLog({
  userId,
  campaignId,
  leadId,
  action,
  message,
  metadata = {},
}: AuditLogPayload) {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('audit_logs')
      .insert({
        user_id: userId,
        campaign_id: campaignId || null,
        lead_id: leadId || null,
        action,
        message,
        metadata,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create audit log:', error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (error: unknown) {
    console.error('Error in createAuditLog:', error);
    return { success: false, error };
  }
}
