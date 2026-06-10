'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Sparkles, Target, Clock, CheckCircle2, Bot, Layers, Send } from 'lucide-react';

export default function HomePage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleJoinWaitlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setStatus('loading');
    setMessage('');

    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (res.ok) {
        setStatus('success');
        setMessage(data.message || 'Success! You have been added to the waitlist.');
        setEmail('');
      } else {
        setStatus('error');
        setMessage(data.error || data.message || 'Failed to join. Please try again.');
      }
    } catch (err) {
      setStatus('error');
      setMessage('Network error. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-zinc-100 selection:bg-violet-500/30">
      {/* Background gradients */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-violet-600/10 blur-[120px] rounded-full mix-blend-screen opacity-50" />
        <div className="absolute top-0 right-0 w-3/4 h-3/4 bg-teal-600/10 blur-[120px] rounded-full mix-blend-screen opacity-50" />
      </div>

      <div className="relative z-10">
        {/* Navigation */}
        <nav className="container mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 shadow-[0_0_20px_rgba(139,92,246,0.3)]">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white">ReachMira</span>
          </div>
          <Link href="/login" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">
            Login
          </Link>
        </nav>

        {/* Hero Section */}
        <main className="container mx-auto px-6 pt-24 pb-32 flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-300 mb-8 shadow-[0_0_20px_rgba(139,92,246,0.15)]">
            <Sparkles className="h-3 w-3" />
            <span>Private Beta Currently Full</span>
          </div>

          <h1 className="max-w-4xl text-5xl md:text-7xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-zinc-500 leading-tight mb-8">
            Outreach without the <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-teal-400">automation overwhelm.</span>
          </h1>

          <p className="max-w-2xl text-lg md:text-xl text-zinc-400 mb-12 leading-relaxed">
            A manual-first CRM built for B2B agencies that value deep personalization over volume. Scrape websites, manage pipelines, and track follow-ups—all in one gorgeous workspace.
          </p>

          <div className="w-full max-w-md relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-violet-500 to-teal-500 rounded-2xl blur opacity-20 transition duration-1000 group-hover:opacity-30"></div>
            <form onSubmit={handleJoinWaitlist} className="relative flex flex-col sm:flex-row gap-3 p-2 rounded-2xl bg-zinc-900/80 border border-zinc-800 backdrop-blur-xl shadow-2xl">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="flex-1 bg-transparent px-4 py-3 text-sm text-white placeholder:text-zinc-500 outline-none"
                disabled={status === 'loading' || status === 'success'}
              />
              <button
                type="submit"
                disabled={status === 'loading' || status === 'success'}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-3 text-sm font-semibold text-white transition hover:opacity-95 disabled:opacity-50"
              >
                {status === 'loading' ? 'Joining...' : status === 'success' ? 'Joined!' : 'Join Waitlist'}
                {status !== 'loading' && status !== 'success' && <ArrowRight className="h-4 w-4" />}
              </button>
            </form>
            {message && (
              <p className={`mt-4 text-sm font-medium ${status === 'success' ? 'text-teal-400' : 'text-rose-400'}`}>
                {message}
              </p>
            )}
          </div>
        </main>

        {/* Features Section */}
        <section className="container mx-auto px-6 py-24 border-t border-zinc-800/50">
          <div className="grid gap-12 md:grid-cols-3">
            <FeatureCard 
              icon={<Bot />}
              title="AI Auto-Research"
              description="Drop in a lead's URL. ReachMira scrapes their website and uses Gemini to automatically extract their company summary and pain points."
            />
            <FeatureCard 
              icon={<Layers />}
              title="Complete Manual Control"
              description="No robotic sequences. Write personalized emails and send from your real connected inbox, keeping you fully in the driver's seat."
            />
            <FeatureCard 
              icon={<Clock />}
              title="Follow-Up Tracking"
              description="Never forget to reply. Built-in reminders tell you exactly who needs a follow-up and when, so no lead slips through the cracks."
            />
          </div>
        </section>

        {/* Footer */}
        <footer className="container mx-auto px-6 py-12 border-t border-zinc-800/50 flex flex-col md:flex-row items-center justify-between text-zinc-500 text-sm">
          <p>© {new Date().getFullYear()} ReachMira. All rights reserved.</p>
          <div className="flex gap-6 mt-4 md:mt-0">
            <Link href="/login" className="hover:text-zinc-300 transition-colors">Login</Link>
          </div>
        </footer>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="relative group rounded-3xl border border-zinc-800/50 bg-zinc-900/30 p-8 hover:bg-zinc-900/50 transition-colors">
      <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-400 border border-violet-500/20 group-hover:bg-violet-500/20 transition-colors">
        {icon}
      </div>
      <h3 className="mb-3 text-lg font-semibold text-white">{title}</h3>
      <p className="text-zinc-400 leading-relaxed text-sm">
        {description}
      </p>
    </div>
  );
}
