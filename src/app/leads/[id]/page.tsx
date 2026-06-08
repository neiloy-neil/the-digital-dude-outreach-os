import LeadWorkspace from '@/components/leads/LeadWorkspace';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function LeadDetailPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <LeadWorkspace
      leadId={id}
      title="Lead Workspace"
      subtitle="Manage the lead data, AI draft, email history, and manual send flow from one place."
      backHref="/leads"
      backLabel="Lead Library"
    />
  );
}
