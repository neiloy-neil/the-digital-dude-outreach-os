import { NextResponse } from 'next/server';
import { createServiceClient } from '@/utils/supabase/service';
import { sendTelegramReport } from '@/utils/telegram';

export async function GET(request: Request) {
  // Validate Vercel Cron Secret (if set)
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const past24Hours = new Date();
  past24Hours.setHours(past24Hours.getHours() - 24);
  const timeLimitISO = past24Hours.toISOString();

  try {
    // 1. Fetch profiles that have Telegram configured
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .not('telegram_chat_id', 'is', null)
      .not('telegram_bot_token', 'is', null);

    if (profilesError) {
      console.error('Error fetching telegram profiles:', profilesError);
      return NextResponse.json({ error: profilesError.message }, { status: 500 });
    }

    if (!profiles || profiles.length === 0) {
      return NextResponse.json({ message: 'No profiles with Telegram configured.' });
    }

    const reportsSent = [];

    for (const profile of profiles) {
      // Get all campaign IDs owned by this user
      const { data: campaigns } = await supabase
        .from('campaigns')
        .select('id, name, status')
        .eq('user_id', profile.id);

      const campaignIds = campaigns?.map(c => c.id) || [];
      const activeCampaignsCount = campaigns?.filter(c => c.status === 'active').length || 0;

      if (campaignIds.length === 0) {
        // Skip user if they have no campaigns
        continue;
      }

      // Fetch activity logs for this user's campaigns in the last 24 hours
      const { data: logs, error: logsError } = await supabase
        .from('activity_logs')
        .select('event_type')
        .in('campaign_id', campaignIds)
        .gte('created_at', timeLimitISO);

      if (logsError) {
        console.error(`Error fetching logs for profile ${profile.id}:`, logsError);
        continue;
      }

      // Aggregate metrics
      let sentCount = 0;
      let openCount = 0;
      let replyCount = 0;
      let bounceCount = 0;
      let unsubscribeCount = 0;

      logs?.forEach(log => {
        switch (log.event_type) {
          case 'sent':
            sentCount++;
            break;
          case 'opened':
            openCount++;
            break;
          case 'replied':
            replyCount++;
            break;
          case 'bounced':
            bounceCount++;
            break;
          case 'unsubscribed':
            unsubscribeCount++;
            break;
        }
      });

      // Construct Telegram report message
      const message = 
`🤖 *Digital Dude Outreach OS Report*
📅 Last 24 Hours Metrics

📈 *Campaigns Status*
• Active Campaigns: ${activeCampaignsCount}
• Total Campaigns: ${campaigns?.length || 0}

📊 *Activity stats (24h)*:
• ✉️ Emails Sent: *${sentCount}*
• 👁️ Opens tracked: *${openCount}*
• 💬 Replies detected: *${replyCount}*
• ❌ Bounces: *${bounceCount}*
• 🔕 Unsubscribes: *${unsubscribeCount}*

🚀 _Let's keep booking meetings!_`;

      // Dispatch to Telegram Bot API
      const result = await sendTelegramReport(
        profile.telegram_bot_token!,
        profile.telegram_chat_id!,
        message
      );

      reportsSent.push({
        userId: profile.id,
        success: result.success,
        error: result.error,
      });
    }

    return NextResponse.json({ processed: reportsSent.length, details: reportsSent });
  } catch (err: any) {
    console.error('Crash in telegram-report cron:', err);
    return NextResponse.json({ error: err.message || 'Server crash' }, { status: 500 });
  }
}
