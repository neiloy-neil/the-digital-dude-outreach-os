import 'server-only';

import { releaseStuckProcessingLeads } from '@/lib/queue/queue';

export async function releaseStuckLeads() {
  const releasedCount = await releaseStuckProcessingLeads();
  return { releasedCount };
}
