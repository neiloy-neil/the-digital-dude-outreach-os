'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { ArrowRight, CheckCircle2, Lock, Mail, Sparkles, ShieldCheck, Send } from 'lucide-react';

type AuthMode = 'toggle' | 'login' | 'register';

type AuthScreenProps = {
  mode?: AuthMode;
};

export default function AuthScreen({ mode = 'toggle' }: AuthScreenProps) {
  const [isSignUp, setIsSignUp] = useState(mode === 'register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const router = useRouter();
  const supabase = createClient();
  const fixedMode = mode !== 'toggle';

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) router.push('/dashboard');
    };

    checkUser();
  }, [router, supabase]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;
        setMessage('Check your email for the confirmation link.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push('/dashboard');
        router.refresh();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred during authentication');
    } finally {
      setLoading(false);
    }
  };

  const title = isSignUp ? 'Create your account' : 'Sign in to ReachMira';
  const subtitle = isSignUp
    ? 'Create a workspace for ReachMira and start managing outreach.'
    : 'Manage leads, craft emails, and keep your outreach human.';

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(124,58,237,0.12),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(20,184,166,0.12),_transparent_26%),var(--background)] px-4 py-8 text-zinc-900 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl overflow-hidden rounded-[2rem] border border-white/70 bg-white/80 shadow-[0_30px_100px_rgba(15,23,42,0.08)] backdrop-blur-xl lg:grid-cols-[1.1fr_0.9fr]">
        <div className="relative overflow-hidden bg-gradient-to-br from-violet-600 via-violet-500 to-teal-500 p-8 text-white lg:p-12">
          <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,0.3)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.3)_1px,transparent_1px)] [background-size:3.5rem_3.5rem]" />
          <div className="relative z-10 flex h-full flex-col justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/90">
                <Sparkles className="h-3.5 w-3.5" />
                ReachMira
              </div>
              <h1 className="mt-6 max-w-xl text-4xl font-semibold tracking-tight lg:text-5xl">
                Personalized outreach, simplified.
              </h1>
              <p className="mt-4 max-w-xl text-base leading-7 text-white/85">
                Import lead lists, understand each lead, craft polished emails, send manually or through campaigns, and track every follow-up in one calm workspace.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                'Manual-first, AI-assisted workflows',
                'Rich text email drafts and clean previews',
                'Lead context for ChatGPT or Gemini',
                'Track replies, opens, bounces, and follow-ups',
              ].map((item) => (
                <div key={item} className="rounded-2xl border border-white/20 bg-white/10 p-4 text-sm text-white/90 shadow-[0_12px_30px_rgba(15,23,42,0.12)]">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{item}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-center bg-white p-8 lg:p-12">
          <div className="mx-auto w-full max-w-md">
            <div className="mb-8">
              <div className="inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-700">
                <ShieldCheck className="h-3.5 w-3.5" />
                ReachMira workspace
              </div>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-950">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-500">{subtitle}</p>
            </div>

            <form onSubmit={handleAuth} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">Email Address</label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-3 h-4.5 w-4.5 text-zinc-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-10 py-3 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-violet-300 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">Password</label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-3 h-4.5 w-4.5 text-zinc-400" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-10 py-3 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-violet-300 focus:bg-white"
                  />
                </div>
              </div>

              {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
              {message && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}

              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50"
              >
                {loading ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <>
                    {isSignUp ? <Sparkles className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                    {isSignUp ? 'Create account' : 'Sign in'}
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            {fixedMode ? (
              <div className="mt-6 text-sm text-zinc-500">
                {isSignUp ? (
                  <Link href="/login" className="font-medium text-violet-700 hover:text-violet-800">
                    Already have an account? Sign in
                  </Link>
                ) : (
                  <Link href="/register" className="font-medium text-violet-700 hover:text-violet-800">
                    Don’t have an account? Sign up
                  </Link>
                )}
              </div>
            ) : (
              <button onClick={() => setIsSignUp(!isSignUp)} className="mt-6 text-sm font-medium text-violet-700 hover:text-violet-800">
                {isSignUp ? 'Already have an account? Sign in' : "Don’t have an account? Sign up"}
              </button>
            )}

            <p className="mt-8 text-xs leading-6 text-zinc-500">
              ReachMira helps you import leads, understand their pain points, draft personalized outreach, and keep follow-ups visible.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
