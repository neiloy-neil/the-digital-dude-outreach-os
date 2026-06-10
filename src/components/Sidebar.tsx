'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useToast } from '@/lib/toast/toast-context';
import {
  Activity,
  CalendarClock,
  LayoutDashboard,
  Mail,
  MailPlus,
  Megaphone,
  Settings,
  Users,
  Inbox,
  ShieldAlert,
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
  const [workspaceName, setWorkspaceName] = useState<string>('Connected workspace');
  const [emailAddress, setEmailAddress] = useState<string>('Connected workspace');
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const toast = useToast();

  const navItems: NavItem[] = useMemo(() => {
    const items = [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { name: 'Inbox', href: '/inbox', icon: Inbox },
      { name: 'Leads', href: '/leads', icon: Users },
      { name: 'Campaigns', href: '/campaigns', icon: Megaphone },
      { name: 'Manual Emails', href: '/manual-emails', icon: MailPlus },
      { name: 'Email Accounts', href: '/settings/email-accounts', icon: Mail },
      { name: 'Activity', href: '/activity', icon: Activity },
      { name: 'Settings', href: '/settings', icon: Settings },
    ];
    if (isAdmin) {
      items.push({ name: 'Admin Waitlist', href: '/admin/waitlist', icon: ShieldAlert });
    }
    return items;
  }, [isAdmin]);

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

    if (href === '/inbox') {
      return pathname === '/inbox' || pathname.startsWith('/inbox/');
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  };

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      setEmailAddress(user.email || 'Connected workspace');

      const fetchUnreadCount = async () => {
        const { count: unreadCountRes } = await supabase
          .from('inbox_messages')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('status', 'unread');

        if (unreadCountRes !== null) {
          setUnreadCount(unreadCountRes);
        }
      };

      await fetchUnreadCount();

      // Realtime subscription
      channel = supabase
        .channel('inbox-changes')
        .on(
          'postgres_changes',
          {
            event: '*', // Listen to INSERT, UPDATE, DELETE
            schema: 'public',
            table: 'inbox_messages',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            fetchUnreadCount();
            if (payload.eventType === 'INSERT') {
              const msg = payload.new as any;
              if (msg.status === 'unread') {
                toast.success('New reply received!');
              }
            }
          }
        )
        .subscribe();

      let { data, error } = await supabase
        .from('profiles')
        .select('display_name, workspace_name, mailgun_from_name, is_admin')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        // Fallback before migration is applied
        const { data: fallbackData } = await supabase
          .from('profiles')
          .select('display_name, workspace_name, mailgun_from_name')
          .eq('id', user.id)
          .maybeSingle();
        data = fallbackData as any;
      }

      if (data?.is_admin) {
        setIsAdmin(true);
      }

      if (data?.workspace_name) {
        setWorkspaceName(data.workspace_name);
      } else {
        setWorkspaceName(data?.mailgun_from_name || 'Connected workspace');
      }

      if (data?.display_name) {
        setDisplayName(data.display_name);
      } else if (data?.mailgun_from_name) {
        setDisplayName(data.mailgun_from_name);
      } else {
        const prefix = user.email?.split('@')[0] || 'ReachMira user';
        setDisplayName(prefix.charAt(0).toUpperCase() + prefix.slice(1));
      }
    };

    fetchUser();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [router, supabase, toast]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    /*
     * Responsive sidebar:
     * - Default (mobile/tablet <lg): 56px icon-only rail
     * - lg+: full 288px with labels
     * - hover on collapsed rail: expands to full width with labels visible
     * The `group` class enables child selectors like group-hover:
     */
    <aside className="group sticky top-0 flex h-screen shrink-0 flex-col border-r border-[var(--border)] bg-white/90 px-2 py-5 shadow-[0_20px_60px_rgba(17,24,39,0.05)] backdrop-blur transition-[width,padding] duration-200 w-14 lg:w-72 hover:w-72 overflow-hidden lg:px-4 hover:px-4">

      {/* Logo / Brand */}
      <div className="rounded-2xl border border-[var(--border)] bg-gradient-to-br from-violet-50 via-white to-teal-50 p-2 lg:p-4 group-hover:p-4 transition-[padding] duration-200">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 lg:h-11 lg:w-11 items-center justify-center overflow-hidden rounded-2xl border border-white/70 bg-white shadow-lg shadow-violet-500/10 shrink-0 transition-[width,height] duration-200 group-hover:h-11 group-hover:w-11">
            <Image
              src="/reachmira-logo.png"
              alt="ReachMira logo"
              width={44}
              height={44}
              className="h-full w-full object-cover"
              priority
            />
          </div>
          <div className="hidden lg:block group-hover:block overflow-hidden whitespace-nowrap">
            <div className="text-lg font-semibold tracking-tight text-zinc-900">ReachMira</div>
            <p className="text-xs text-zinc-500">Personalized outreach, simplified.</p>
          </div>
        </div>

        <div className="mt-4 hidden lg:grid group-hover:grid grid-cols-2 gap-2 text-[11px]">
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

      {/* Nav */}
      <nav className="mt-5 space-y-1.5 overflow-y-auto overflow-x-hidden pr-0 lg:pr-1 group-hover:pr-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = isNavItemActive(item.href);

          return (
            <Link
              key={item.name}
              href={item.href}
              title={item.name}
              className={`relative flex items-center gap-3 rounded-xl px-2.5 py-3 text-sm font-medium transition-all ${
                isActive
                  ? 'bg-violet-50 text-violet-700 ring-1 ring-violet-100'
                  : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
              }`}
            >
              <Icon className={`h-[18px] w-[18px] shrink-0 ${isActive ? 'text-violet-600' : 'text-zinc-400'}`} />
              <span className="hidden lg:block group-hover:block whitespace-nowrap overflow-hidden">{item.name}</span>
              {item.name === 'Inbox' && unreadCount > 0 && (
                <span className="ml-auto hidden lg:inline-flex group-hover:inline-flex items-center justify-center rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm ring-1 ring-white">
                  {unreadCount}
                </span>
              )}
              {item.name === 'Inbox' && unreadCount > 0 && (
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-500 lg:hidden group-hover:hidden" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Workspace card + logout */}
      <div className="mt-auto space-y-3 pt-5">
        {/* Workspace card — shown full on lg/hover, icon-only on collapsed */}
        <div className="hidden lg:block group-hover:block rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="text-[11px] uppercase tracking-[0.22em] text-zinc-400">Workspace</div>
          <div className="mt-1 font-semibold text-zinc-900 truncate">{workspaceName}</div>
          <div className="mt-0.5 text-xs text-zinc-500 font-medium truncate">{displayName}</div>
          <div className="mt-1 text-xs text-zinc-400 truncate">{emailAddress}</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
              Connected
            </span>
            <span className="inline-flex rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-violet-700">
              ReachMira
            </span>
          </div>
        </div>

        {/* Collapsed workspace indicator (icon only) */}
        <div className="flex lg:hidden group-hover:hidden justify-center">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-50 text-xs font-bold uppercase text-violet-700">
            {displayName.charAt(0)}
          </div>
        </div>

        <button
          onClick={handleLogout}
          title="Sign Out"
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-2.5 py-3 text-sm font-semibold text-zinc-700 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
        >
          <CalendarClock className="h-4 w-4 shrink-0" />
          <span className="hidden lg:block group-hover:block whitespace-nowrap">Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
