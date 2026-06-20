import 'server-only';

import { createServiceClient } from '@/utils/supabase/service';

interface AuditLogPayload {
  userId: string;
  campaignId?: string | null;
  leadId?: string | null;
  action: string;
  message?: string | null;
  metadata?: Record<string, unknown>;
  supabase?: any;
}

export async function createAuditLog({
  userId,
  campaignId,
  leadId,
  action,
  message,
  metadata = {},
  supabase,
}: AuditLogPayload) {
  try {
    const client = supabase || createServiceClient();
    const { error } = await client
      .from('audit_logs')
      .insert({
        user_id: userId,
        campaign_id: campaignId || null,
        lead_id: leadId || null,
        action,
        message,
        metadata,
      });

    if (error) {
      console.error('Failed to create audit log:', error);
      return { success: false, error };
    }

    return { success: true };
  } catch (error: unknown) {
    console.error('Error in createAuditLog:', error);
    return { success: false, error };
  }
}
