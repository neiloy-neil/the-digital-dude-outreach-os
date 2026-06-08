'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, use } from 'react';
import type { ComponentType } from 'react';
import Sidebar from '@/components/Sidebar';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import { ArrowLeft, Activity, CheckCircle2, Mail, Pause, Play, Ban, Bot, Inbox, Undo2, ChevronDown } from 'lucide-react';

interface PageProps {
  params: Promise<{ id: string }>;
}

const iconMap: Record<string, ComponentType<{ className?: string }>> = {
  campaign_started: Play,
  campaign_paused: Pause,
  campaign_completed: CheckCircle2,
  email_sent: Mail,
  email_approved: CheckCircle2,
  ai_generated: Bot,
  reply_received: Undo2,
  lead_unsubscribed: Ban,
  email_bounced: Inbox,
  lead_imported: Activity,
};

export default function CampaignActivityPage({ params }: PageProps) {
  const resolved = use(params);
  const campaignId = resolved.id;
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [campaign, setCampaign] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: camp } = await supabase
          .from('campaigns')
          .select('*')
          .eq('id', campaignId)
          .single();
        setCampaign(camp);

        const { data } = await supabase
          .from('audit_logs')
          .select('*, leads(email, first_name, last_name, company)')
          .eq('campaign_id', campaignId)
          .order('created_at', { ascending: false })
          .limit(100);
        setLogs(data || []);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [campaignId]);

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto max-w-6xl">
        <div className="flex items-center gap-3 mb-6">
          <Link href={`/campaigns/${campaignId}`} className="p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-all">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Campaign Activity</h2>
            <p className="text-xs text-zinc-400">
              {campaign ? <span className="text-violet-400 font-semibold">{campaign.name}</span> : 'Loading campaign...'}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" />
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/20 backdrop-blur-sm overflow-hidden">
            <div className="border-b border-zinc-800 px-5 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white">Audit Timeline</h3>
                <p className="text-xs text-zinc-500">Latest audit entries for this campaign.</p>
              </div>
              <span className="text-xs text-zinc-400">{logs.length} events</span>
            </div>

            <div className="divide-y divide-zinc-900">
              {logs.length === 0 ? (
                <div className="p-8 text-center text-sm text-zinc-500">No audit logs yet.</div>
              ) : (
                logs.map((log) => {
                  const Icon = iconMap[log.action] || Activity;
                  const lead = log.leads as any;
                  return (
                    <div key={log.id} className="p-5 hover:bg-zinc-900/20 transition-colors">
                      <div className="flex items-start gap-4">
                        <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 text-violet-400 border border-zinc-800">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-white">{log.action}</span>
                            <span className="text-[10px] uppercase tracking-wider rounded-full border border-zinc-800 bg-zinc-950 px-2 py-0.5 text-zinc-400">
                              {new Date(log.created_at).toLocaleString()}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-zinc-300">{log.message || 'No message'}</p>
                          <p className="mt-2 text-xs text-zinc-500">
                            {lead ? `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || lead.company || lead.email : 'No lead context'}
                          </p>

                          {log.metadata && Object.keys(log.metadata).length > 0 && (
                            <details className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
                              <summary className="cursor-pointer text-xs font-semibold text-zinc-300 flex items-center gap-2">
                                Metadata <ChevronDown className="h-3.5 w-3.5" />
                              </summary>
                              <pre className="mt-3 overflow-x-auto text-[11px] text-zinc-400 whitespace-pre-wrap">
                                {JSON.stringify(log.metadata, null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
