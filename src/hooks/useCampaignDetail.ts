'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';

/**
 * Core campaign detail data (campaign row, leads, audit logs, sent emails)
 * plus the header-level mutations (email account, risky-email toggle,
 * launch/pause, clear leads) extracted from campaigns/[id]/page.tsx.
 *
 * `setSequences` is passed in from the separate useSequenceSteps hook so
 * loadCampaignData can keep populating it exactly as before.
 */
export function useCampaignDetail(campaignId: string, setSequences: (sequences: any[]) => void) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [campaign, setCampaign] = useState<any>(null);
  const [leads, setLeads] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [sentEmails, setSentEmails] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadCampaignData = async () => {
    try {
      // 1. Fetch Campaign
      const { data: camp, error: campError } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', campaignId)
        .single();

      if (campError) throw campError;
      setCampaign(camp);

      // 2. Fetch Leads
      const { data: leadList } = await supabase
        .from('leads')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: false });
      setLeads(leadList || []);

      // 3. Fetch Sequences
      const { data: seqList } = await supabase
        .from('sequences')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('step_number', { ascending: true });
      setSequences(seqList || []);

      const { data: logs } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: false })
        .limit(10);
      setAuditLogs(logs || []);

      const { data: campaignSentEmails } = await supabase
        .from('sent_emails')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('sent_at', { ascending: false });
      setSentEmails(campaignSentEmails || []);

    } catch (err: any) {
      setError(err.message || 'Error loading campaign details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadCampaignData();
  }, [campaignId]);

  const handleCampaignEmailAccountChange = async (emailAccountId: string) => {
    try {
      const { error: updateError } = await supabase
        .from('campaigns')
        .update({ email_account_id: emailAccountId || null, updated_at: new Date().toISOString() })
        .eq('id', campaignId);

      if (updateError) throw updateError;

      setCampaign((prev: any) => (prev ? { ...prev, email_account_id: emailAccountId || null } : prev));
      setSuccess('Email account saved for this campaign.');
    } catch (err: any) {
      setError(err.message || 'Error saving campaign email account');
    }
  };

  const handleAllowRiskyEmailsChange = async (nextValue: boolean) => {
    try {
      const { error: updateError } = await supabase
        .from('campaigns')
        .update({ allow_risky_emails: nextValue, updated_at: new Date().toISOString() })
        .eq('id', campaignId);

      if (updateError) {
        if (String(updateError.message || '').toLowerCase().includes('allow_risky_emails')) {
          throw new Error('Apply the latest database migration to save the risky-email campaign setting.');
        }
        throw updateError;
      }

      setCampaign((prev: any) => (prev ? { ...prev, allow_risky_emails: nextValue } : prev));
      setSuccess(nextValue ? 'Campaign will allow risky or unchecked emails during automation.' : 'Campaign will now skip risky or unchecked emails during automation.');
    } catch (err: any) {
      setError(err.message || 'Error saving risky-email setting');
    }
  };

  const handleLaunchCampaign = async (hasSequenceSteps: boolean) => {
    if (!hasSequenceSteps) {
      setError('Please add at least one email sequence step before launching.');
      return;
    }
    if (!campaign?.email_account_id) {
      setError('Please add an email account before starting a campaign.');
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/campaigns/${campaignId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active' }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Error launching campaign');

      setSuccess('Campaign launched! Approved leads will now be dispatched.');
      await loadCampaignData();
    } catch (err: any) {
      setError(err.message || 'Error launching campaign');
    }
  };

  const handlePauseCampaign = async () => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'paused' }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Error pausing campaign');

      setSuccess('Campaign paused. Outbox dispatches are temporarily halted.');
      await loadCampaignData();
    } catch (err: any) {
      setError(err.message || 'Error pausing campaign');
    }
  };

  const handleClearLeads = async () => {
    try {
      const { error: deleteError } = await supabase
        .from('leads')
        .delete()
        .eq('campaign_id', campaignId);
      if (deleteError) throw deleteError;
      setSuccess('All leads deleted.');
      await loadCampaignData();
    } catch (err: any) {
      setError(err.message || 'Error clearing leads');
    }
  };

  return {
    loading,
    campaign,
    leads,
    auditLogs,
    sentEmails,
    error,
    success,
    setError,
    setSuccess,
    loadCampaignData,
    handleCampaignEmailAccountChange,
    handleAllowRiskyEmailsChange,
    handleLaunchCampaign,
    handlePauseCampaign,
    handleClearLeads,
  };
}
