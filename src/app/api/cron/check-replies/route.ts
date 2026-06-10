import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createServiceClient } from '@/utils/supabase/service';
import { sendTelegramReport } from '@/utils/telegram';
import Imap from 'imap';
import { createAuditLog } from '@/lib/audit/create-audit-log';
import { resolveLeadOwnerFromLead } from '@/lib/leads/resolve-lead-owner';
import { isBlockedLeadStatus } from '@/lib/leads/status';

type ImapReplyBody = {
  bodyText: string;
  bodyHtml: string;
  snippet: string;
};

function decodeTransferContent(content: string, encoding: string) {
  const normalizedEncoding = encoding.toLowerCase();

  if (normalizedEncoding.includes('base64')) {
    try {
      return Buffer.from(content.replace(/\s+/g, ''), 'base64').toString('utf8').trim();
    } catch {
      return content.trim();
    }
  }

  if (normalizedEncoding.includes('quoted-printable')) {
    const binary = content
      .replace(/=\r?\n/g, '')
      .replace(/=([A-Fa-f0-9]{2})/g, (_match, hex: string) => String.fromCharCode(parseInt(hex, 16)));
    return Buffer.from(binary, 'binary').toString('utf8').trim();
  }

  return content.trim();
}

function htmlToText(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractMimePart(rawBody: string, contentType: 'text/plain' | 'text/html') {
  const parts = rawBody.split(/\r?\n--[^\r\n]+(?:\r?\n|$)/g);

  for (const part of parts) {
    const headerEnd = part.search(/\r?\n\r?\n/);
    if (headerEnd === -1) continue;

    const headers = part.slice(0, headerEnd);
    const body = part.slice(headerEnd).replace(/^\r?\n\r?\n?/, '');

    if (!new RegExp(`Content-Type:\\s*${contentType.replace('/', '\\/')}`, 'i').test(headers)) continue;

    const transferEncoding = headers.match(/Content-Transfer-Encoding:\s*([^\r\n]+)/i)?.[1] || '';
    return decodeTransferContent(body, transferEncoding);
  }

  return '';
}

function stripMimeNoise(value: string) {
  return value
    .replace(/\r/g, '')
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('--')) return false;
      if (/^(Content-Type|Content-Transfer-Encoding|Content-Disposition|charset=|boundary=)/i.test(trimmed)) return false;
      return true;
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function parseImapReplyBody(rawBody: string): ImapReplyBody {
  const bodyHtml = extractMimePart(rawBody, 'text/html');
  const bodyText = extractMimePart(rawBody, 'text/plain') || (bodyHtml ? htmlToText(bodyHtml) : stripMimeNoise(rawBody));
  const snippet = bodyText.replace(/\s+/g, ' ').slice(0, 300);

  return { bodyText, bodyHtml, snippet };
}

function firstRelation<T>(value: T[] | T | null | undefined): T | null {
  return Array.isArray(value) ? value[0] || null : value || null;
}

function extractEmailAddress(value: string) {
  return value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]?.toLowerCase() || '';
}

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

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const serviceSupabase = createServiceClient();
  const { data: profile, error: profileError } = await serviceSupabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  if (!profile?.imap_host || !profile?.imap_user || !profile?.imap_pass) {
    return NextResponse.json({ error: 'IMAP is not configured for this user.' }, { status: 400 });
  }

  try {
    const repliesFound = await checkIMAPRepliesForUser(profile, serviceSupabase);
    return NextResponse.json({
      success: true,
      userId: user.id,
      repliesProcessed: repliesFound.length,
      details: repliesFound,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'IMAP error';
    return NextResponse.json({ error: message }, { status: 500 });
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

        // Search for all messages (including SEEN) received in the last 30 days to keep scanning fast and bounded
        const last30Days = new Date();
        last30Days.setDate(last30Days.getDate() - 30);

        imap.search(['ALL', ['SINCE', last30Days]], (searchErr, uids) => {
          if (searchErr || !uids || uids.length === 0) {
            imap.end();
            return resolve([]);
          }

          const fetchOption = {
            bodies: ['HEADER.FIELDS (FROM SUBJECT IN-REPLY-TO DATE)', 'TEXT'],
            struct: true
          };

          const f = imap.fetch(uids, fetchOption);
          const messageTasks: Promise<void>[] = [];

          f.on('message', (msg, seqno) => {
            let from = '';
            let subject = '';
            let rawBody = '';

            msg.on('body', (stream, info) => {
              let buffer = '';
              stream.on('data', (chunk) => {
                buffer += chunk.toString('utf8');
              });
              stream.once('end', () => {
                if (String(info.which || '').toUpperCase().includes('HEADER')) {
                  const parsedHeaders = Imap.parseHeader(buffer);
                  from = parsedHeaders.from?.[0] || '';
                  subject = parsedHeaders.subject?.[0] || '';
                  // Store the actual date from the email header instead of generating one later
                  (msg as any).receivedDate = parsedHeaders.date?.[0] || new Date().toISOString();
                } else {
                  rawBody += buffer;
                }
              });
            });

            msg.once('end', () => {
              const task = (async () => {
                const senderEmail = extractEmailAddress(from);
                if (senderEmail) {
                  const replyBody = parseImapReplyBody(rawBody);

                  // Match replies to any lead owned by this user, including manual/global leads.
                  const { data: possibleLeads } = await supabase
                    .from('leads')
                    .select(`
                      id,
                      first_name,
                      last_name,
                      company,
                      email,
                      status,
                      user_id,
                      campaign_id,
                      lead_list_id,
                      campaigns (
                        id,
                        name,
                        user_id
                      ),
                      lead_lists (
                        id,
                        user_id
                      )
                    `)
                    .eq('email', senderEmail)
                    .order('updated_at', { ascending: false });

                  const leads = (possibleLeads || []).filter((lead: any) => {
                    const owner = resolveLeadOwnerFromLead(lead);
                    return owner.userId === profile.id && !isBlockedLeadStatus(lead.status);
                  });

                  if (leads && leads.length > 0) {
                    for (const lead of leads) {
                      const owner = resolveLeadOwnerFromLead(lead);
                      const campaign = firstRelation(lead.campaigns as any);
                      const campaignId = owner.campaignId;
                      const campaignName = owner.campaignName || campaign?.name || 'ReachMira outreach';
                      const receivedDateRaw = (msg as any).receivedDate;
                      const receivedDate = receivedDateRaw ? new Date(receivedDateRaw) : new Date();
                      const repliedAt = (isNaN(receivedDate.getTime()) ? new Date() : receivedDate).toISOString();

                      // Mark lead as replied
                      const { error: leadUpdateError } = await supabase
                        .from('leads')
                        .update({
                          status: 'replied',
                          reply_status: 'replied',
                          next_email_at: null,
                          next_follow_up_at: null,
                          updated_at: new Date().toISOString(),
                        })
                        .eq('id', lead.id);

                      if (leadUpdateError) {
                        // Keep older databases usable if newer reply columns have not been migrated yet.
                        const { error: fallbackLeadUpdateError } = await supabase
                          .from('leads')
                          .update({
                            status: 'replied',
                            updated_at: repliedAt,
                          })
                          .eq('id', lead.id);

                        if (fallbackLeadUpdateError) {
                          throw fallbackLeadUpdateError;
                        }
                      }

                      // Cancel outbox items
                      await supabase
                        .from('outbox')
                        .update({ status: 'cancelled', error_message: 'IMAP reply detected' })
                        .eq('lead_id', lead.id)
                        .eq('status', 'pending');

                      const replyMetadata = {
                        sender: senderEmail,
                        subject,
                        snippet: replyBody.snippet,
                        body_text: replyBody.bodyText,
                        body_html: replyBody.bodyHtml,
                        source: 'imap_cron',
                        reply_received_at: repliedAt,
                      };

                      const { data: latestSentEmail } = await supabase
                        .from('sent_emails')
                        .select('id')
                        .eq('lead_id', lead.id)
                        .order('sent_at', { ascending: false })
                        .limit(1)
                        .maybeSingle();

                      if (latestSentEmail?.id) {
                        const { error: sentEmailUpdateError } = await supabase
                          .from('sent_emails')
                          .update({ replied_at: repliedAt, status: 'replied' })
                          .eq('id', latestSentEmail.id);

                        if (sentEmailUpdateError) {
                          // Legacy tables may not have replied_at yet; status is still enough for dashboards.
                          const { error: fallbackSentEmailError } = await supabase
                            .from('sent_emails')
                            .update({ status: 'replied' })
                            .eq('id', latestSentEmail.id);

                          if (fallbackSentEmailError) {
                            throw fallbackSentEmailError;
                          }
                        }
                      }

                      if (campaignId) {
                        // Log Activity for campaign-owned leads. Global/manual leads use audit logs.
                        await supabase.from('activity_logs').insert({
                          campaign_id: campaignId,
                          lead_id: lead.id,
                          event_type: 'replied',
                          payload: replyMetadata,
                        });
                      }

                      await createAuditLog({
                        userId: profile.id,
                        campaignId,
                        leadId: lead.id,
                        action: 'reply_received',
                        message: `Reply detected via IMAP for ${lead.email}`,
                        metadata: replyMetadata,
                      });

                      // Insert into Inbox Messages (Deduplicate)
                      const { data: existingMsg } = await supabase
                        .from('inbox_messages')
                        .select('id')
                        .eq('lead_id', lead.id)
                        .eq('sender_email', senderEmail)
                        .eq('subject', subject)
                        .maybeSingle();

                      if (!existingMsg) {
                        const { error: inboxError } = await supabase.from('inbox_messages').insert({
                          user_id: profile.id,
                          lead_id: lead.id,
                          campaign_id: campaignId || null,
                          sender_email: senderEmail,
                          recipient_email: profile.imap_user || '',
                          subject,
                          body_text: replyBody.bodyText,
                          body_html: replyBody.bodyHtml,
                          snippet: replyBody.snippet,
                          received_at: repliedAt,
                          status: 'unread'
                        });

                        if (inboxError) {
                          console.error('Failed to insert into inbox_messages', inboxError);
                        }
                      }

                      // Trigger Telegram Notification
                      if (profile.telegram_chat_id && profile.telegram_bot_token) {
                        const name = `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Someone';
                        const companyStr = lead.company ? ` at *${lead.company}*` : '';
                        const alertMsg =
`📥 *New Email Reply Detected! (cPanel IMAP)*
📬 Campaign: *${campaignName}*
👤 Lead: *${name}* (${lead.email})${companyStr}

💬 *Subject*: ${subject}
📝 *Body snippet*:
_"${replyBody.snippet}${replyBody.bodyText.length > 300 ? '...' : ''}"_

🛑 _All follow-ups for this lead have been automatically stopped._`;

                        await sendTelegramReport(profile.telegram_bot_token, profile.telegram_chat_id, alertMsg);
                      }

                      repliesProcessed.push({ leadId: lead.id, email: lead.email });
                    }
                  }
                }
              })();
              messageTasks.push(task);
            });
          });

          f.once('error', (fetchErr) => {
            imap.end();
            return reject(fetchErr);
          });

          f.once('end', async () => {
            try {
              await Promise.all(messageTasks);
              imap.end();
              return resolve(repliesProcessed);
            } catch (taskErr) {
              imap.end();
              return reject(taskErr);
            }
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
