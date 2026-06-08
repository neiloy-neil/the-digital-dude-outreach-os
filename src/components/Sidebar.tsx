'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { LayoutDashboard, Send, Settings, LogOut, User, Mail, Bot, Users, List } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Fetch profile to see if they set a name
        const { data } = await supabase
          .from('profiles')
          .select('mailgun_from_name')
          .eq('id', user.id)
          .maybeSingle();

        if (data?.mailgun_from_name) {
          setDisplayName(data.mailgun_from_name);
        } else {
          // Fallback to capitalized email prefix
          const prefix = user.email?.split('@')[0] || 'User';
          setDisplayName(prefix.charAt(0).toUpperCase() + prefix.slice(1));
        }
      } else {
        router.push('/');
      }
    };
    fetchUser();
  }, [router, supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Campaigns', href: '/campaigns', icon: Send },
    { name: 'Leads', href: '/leads', icon: Users },
    { name: 'Lead Lists', href: '/lead-lists', icon: List },
    { name: 'Email Accounts', href: '/settings/email-accounts', icon: Mail },
    { name: 'AI Usage', href: '/settings/ai-usage', icon: Bot },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  return (
    <aside className="w-64 border-r border-zinc-800 bg-zinc-950 flex flex-col justify-between shrink-0 h-screen sticky top-0">
      <div className="flex flex-col">
        {/* Brand */}
        <div className="p-6 border-b border-zinc-900 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-tr from-violet-600 to-blue-500 text-white shadow-md">
            <Send className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-bold text-white tracking-tight">Outreach OS</h1>
            <p className="text-[10px] text-zinc-500 font-medium">THE DIGITAL DUDE</p>
          </div>
        </div>

        {/* Links */}
        <nav className="p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-zinc-900 text-white border-l-2 border-violet-500'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40'
                }`}
              >
                <Icon className={`h-4.5 w-4.5 ${isActive ? 'text-violet-400' : 'text-zinc-400'}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* User Info & Logout */}
      <div className="p-4 border-t border-zinc-900 space-y-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900/30 overflow-hidden">
          <User className="h-4 w-4 text-zinc-500 shrink-0" />
          <span className="text-xs text-zinc-400 truncate font-sans font-semibold">{displayName}</span>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/5 transition-colors cursor-pointer"
        >
          <LogOut className="h-4.5 w-4.5" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
