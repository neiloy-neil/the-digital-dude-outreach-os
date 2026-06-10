import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ReachMira Early Beta Waitlist',
  description: 'Join the ReachMira early beta and help test a simple outreach workspace for managing leads, writing personalized emails, and tracking follow-ups.',
};

export default function WaitlistLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
