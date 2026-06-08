import { NextResponse } from 'next/server';
import { createServiceClient } from '@/utils/supabase/service';
import { sendTelegramReport } from '@/utils/telegram';
import Imap from 'imap';
import { createAuditLog } from '@/lib/audit/create-audit-log';

export async function GET(request: Request) {
  // Validate Vercel Cron Secret (if set)
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();

  try {
    // 1. Fetch user profiles with IMAP configured
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .not('imap_host', 'is', null)
      .not('imap_user', 'is', null)
      .not('imap_pass', 'is', null);

    if (profileError) {
      console.error('Error fetching IMAP profiles:', profileError);
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    if (!profiles || profiles.length === 0) {
      return NextResponse.json({ message: 'No profiles with IMAP configured.' });
    }

    const checkResults = [];

    for (const profile of profiles) {
      try {
        const repliesFound = await checkIMAPRepliesForUser(profile, supabase);
        checkResults.push({ userId: profile.id, success: true, repliesProcessed: repliesFound.length, details: repliesFound });
      } catch (err: any) {
        console.error(`IMAP scan failed for user ${profile.id}:`, err);
        checkResults.push({ userId: profile.id, success: false, error: err.message || 'IMAP error' });
      }
    }

    return NextResponse.json({ processed: checkResults.length, results: checkResults });
  } catch (err: any) {
    console.error('Crash in check-replies cron:', err);
    return NextResponse.json({ error: err.message || 'Server crash' }, { status: 500 });
  }
}

// Function to handle IMAP connection and scan
function checkIMAPRepliesForUser(profile: any, supabase: any): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user: profile.imap_user,
      password: profile.imap_pass,
      host: profile.imap_host,
      port: profile.imap_port || 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false }, // Avoid self-signed cert failures
    });

    const repliesProcessed: any[] = [];

    imap.once('ready', () => {
      imap.openBox('INBOX', false, (err, box) => {
        if (err) {
          imap.end();
          return reject(err);
        }

        // Search for all messages received in the last 7 days to keep scanning fast and bounded
        const last7Days = new Date();
        last7Days.setDate(last7Days.getDate() - 7);

        imap.search([['SINCE', last7Days]], (searchErr, uids) => {
          if (searchErr || !uids || uids.length === 0) {
            imap.end();
            return resolve([]);
          }

          const fetchOption = {
            bodies: 'HEADER.FIELDS (FROM SUBJECT IN-REPLY-TO DATE)',
            struct: true
          };

          const f = imap.fetch(uids, fetchOption);

          f.on('message', (msg, seqno) => {
            let from = '';
            let subject = '';

            msg.on('body', (stream, info) => {
              let buffer = '';
              stream.on('data', (chunk) => {
                buffer += chunk.toString('utf8');
              });
              stream.once('end', () => {
                const parsedHeaders = Imap.parseHeader(buffer);
                from = parsedHeaders.from?.[0] || '';
                subject = parsedHeaders.subject?.[0] || '';
              });
            });

            msg.once('end', async () => {
              // Extract sender email using clean regex
              const emailMatch = from.match(/[\w.-]+@[\w.-]+\.[\w.-]+/);
              if (emailMatch) {
                const senderEmail = emailMatch[0].toLowerCase();
                
                // Match this sender to our active campaigns/leads for this user
                const { data: leads } = await supabase
                  .from('leads')
                  .select(`
                    id,
                    first_name,
                    last_name,
                    company,
                    email,
                    campaign_id,
                    campaigns!inner (
                      id,
                      name,
                      user_id
                    )
                  `)
                  .eq('email', senderEmail)
                  .eq('campaigns.user_id', profile.id)
                  .in('status', ['sending', 'sent']);

                if (leads && leads.length > 0) {
                  for (const lead of leads) {
                    const campaign = lead.campaigns as any;
                    
                    // Mark lead as replied
                    await supabase
                      .from('leads')
                      .update({ status: 'replied', updated_at: new Date().toISOString() })
                      .eq('id', lead.id);

                    // Cancel outbox items
                    await supabase
                      .from('outbox')
                      .update({ status: 'cancelled', error_message: 'IMAP reply detected' })
                      .eq('lead_id', lead.id)
                      .eq('status', 'pending');

                    // Log Activity
                    await supabase.from('activity_logs').insert({
                      campaign_id: campaign.id,
                      lead_id: lead.id,
                      event_type: 'replied',
                      payload: { subject, source: 'imap_cron' },
                    });

                    await createAuditLog({
                      userId: profile.id,
                      campaignId: campaign.id,
                      leadId: lead.id,
                      action: 'reply_received',
                      message: `Reply detected via IMAP for ${lead.email}`,
                      metadata: { subject, source: 'imap_cron' },
                    });

                    // Trigger Telegram Notification
                    if (profile.telegram_chat_id && profile.telegram_bot_token) {
                      const name = `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Someone';
                      const companyStr = lead.company ? ` at *${lead.company}*` : '';
                      const alertMsg = 
`📥 *New Email Reply Detected! (cPanel IMAP)*
📬 Campaign: *${campaign.name}*
👤 Lead: *${name}* (${lead.email})${companyStr}

💬 *Subject*: ${subject}

🛑 _All follow-ups for this lead have been automatically stopped._`;

                      await sendTelegramReport(profile.telegram_bot_token, profile.telegram_chat_id, alertMsg);
                    }

                    repliesProcessed.push({ leadId: lead.id, email: lead.email });
                  }
                }
              }
            });
          });

          f.once('error', (fetchErr) => {
            imap.end();
            return reject(fetchErr);
          });

          f.once('end', () => {
            imap.end();
            return resolve(repliesProcessed);
          });
        });
      });
    });

    imap.once('error', (err) => {
      return reject(err);
    });

    imap.connect();
  });
}
