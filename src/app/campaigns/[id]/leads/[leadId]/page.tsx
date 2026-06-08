import LeadWorkspace from '@/components/leads/LeadWorkspace';

interface PageProps {
  params: Promise<{ id: string; leadId: string }>;
}

export default async function CampaignLeadDetailPage({ params }: PageProps) {
  const resolved = await params;

  return (
    <LeadWorkspace
      leadId={resolved.leadId}
      title="Campaign Lead Workspace"
      subtitle="Review intelligence, compose manual emails, and inspect history without leaving the campaign flow."
      backHref={`/campaigns/${resolved.id}`}
      backLabel="Campaign"
    />
  );
}
