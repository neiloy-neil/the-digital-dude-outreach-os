'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import {
  Activity,
  CalendarClock,
  LayoutDashboard,
  Mail,
  MailPlus,
  Megaphone,
  Settings,
  Users,
} from 'lucide-react';

type NavItem = {
  name: string;
  href: string;
  icon: typeof LayoutDashboard;
};

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [displayName, setDisplayName] = useState<string>('ReachMira user');
  const [emailAddress, setEmailAddress] = useState<string>('Connected workspace');

  const navItems: NavItem[] = useMemo(
    () => [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { name: 'Leads', href: '/leads', icon: Users },
      { name: 'Campaigns', href: '/campaigns', icon: Megaphone },
      { name: 'Manual Emails', href: '/manual-emails', icon: MailPlus },
      { name: 'Email Accounts', href: '/settings/email-accounts', icon: Mail },
      { name: 'Activity', href: '/activity', icon: Activity },
      { name: 'Settings', href: '/settings', icon: Settings },
    ],
    []
  );

  const isNavItemActive = (href: string) => {
    if (!pathname) return false;
    if (href === '/settings') {
      return pathname === '/settings' || (pathname.startsWith('/settings/') && !pathname.startsWith('/settings/email-accounts'));
    }

    if (href === '/settings/email-accounts') {
      return pathname === '/settings/email-accounts' || pathname.startsWith('/settings/email-accounts/');
    }

    if (href === '/leads') {
      return pathname === '/leads' || pathname.startsWith('/leads/');
    }

    if (href === '/campaigns') {
      return pathname === '/campaigns' || pathname.startsWith('/campaigns/');
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  };

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      setEmailAddress(user.email || 'Connected workspace');

      const { data } = await supabase
        .from('profiles')
        .select('mailgun_from_name')
        .eq('id', user.id)
        .maybeSingle();

      if (data?.mailgun_from_name) {
        setDisplayName(data.mailgun_from_name);
      } else {
        const prefix = user.email?.split('@')[0] || 'ReachMira user';
        setDisplayName(prefix.charAt(0).toUpperCase() + prefix.slice(1));
      }
    };

    fetchUser();
  }, [router, supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <aside className="sticky top-0 flex h-screen w-72 shrink-0 flex-col border-r border-[var(--border)] bg-white/90 px-4 py-5 shadow-[0_20px_60px_rgba(17,24,39,0.05)] backdrop-blur">
      <div className="rounded-2xl border border-[var(--border)] bg-gradient-to-br from-violet-50 via-white to-teal-50 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border border-white/70 bg-white shadow-lg shadow-violet-500/10">
            <Image
              src="/reachmira-logo.png"
              alt="ReachMira logo"
              width={44}
              height={44}
              className="h-full w-full object-cover"
              priority
            />
          </div>
          <div>
            <div className="text-lg font-semibold tracking-tight text-zinc-900">ReachMira</div>
            <p className="text-xs text-zinc-500">Personalized outreach, simplified.</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 text-[11px]">
          <div className="rounded-xl border border-white/70 bg-white/80 px-3 py-2 text-zinc-600 shadow-sm">
            <div className="font-semibold text-zinc-900">AI companion</div>
            <div>Lead insights + drafting</div>
          </div>
          <div className="rounded-xl border border-white/70 bg-white/80 px-3 py-2 text-zinc-600 shadow-sm">
            <div className="font-semibold text-zinc-900">Send safe</div>
            <div>Manual approval first</div>
          </div>
        </div>
      </div>

      <nav className="mt-5 space-y-1.5 overflow-y-auto pr-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = isNavItemActive(item.href);

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium transition-all ${
                isActive
                  ? 'bg-violet-50 text-violet-700 ring-1 ring-violet-100'
                  : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
              }`}
            >
              <Icon className={`h-4.5 w-4.5 ${isActive ? 'text-violet-600' : 'text-zinc-400'}`} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-3 pt-5">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="text-[11px] uppercase tracking-[0.22em] text-zinc-400">Workspace</div>
          <div className="mt-1 font-semibold text-zinc-900">{displayName}</div>
          <div className="mt-1 text-xs text-zinc-500">{emailAddress}</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
              Connected
            </span>
            <span className="inline-flex rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-violet-700">
              ReachMira
            </span>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
        >
          <CalendarClock className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
