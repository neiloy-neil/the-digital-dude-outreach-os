import AppShell from '@/components/reachmira/AppShell';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell showSearch={false}>
      {children}
    </AppShell>
  );
}
