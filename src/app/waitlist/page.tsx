'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, ArrowLeft } from 'lucide-react';

export default function WaitlistPage() {
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
    <div className="min-h-screen bg-[#0A0A0A] text-zinc-100 selection:bg-violet-500/30 flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full max-w-4xl bg-violet-600/10 blur-[120px] rounded-full mix-blend-screen opacity-70" />
      </div>

      <Link href="/" className="absolute top-8 left-8 text-zinc-400 hover:text-white transition-colors inline-flex items-center gap-2 text-sm z-20">
        <ArrowLeft className="w-4 h-4" />
        Back to Home
      </Link>

      <div className="relative z-10 w-full max-w-lg px-6 flex flex-col items-center">
        {/* Logo */}
        <div className="mb-8 p-4 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-sm">
          <Image 
            src="/reachmira-logo.png" 
            alt="ReachMira Logo" 
            width={64} 
            height={64} 
            className="w-16 h-16 object-contain"
          />
        </div>

        <h1 className="text-4xl font-extrabold tracking-tight text-white mb-4 text-center">
          Join the Private Beta
        </h1>
        <p className="text-zinc-400 text-center mb-10 text-lg">
          Secure your spot on the waitlist and be the first to experience the manual-first CRM.
        </p>

        <div className="w-full relative">
          <div className="absolute -inset-1 bg-gradient-to-r from-violet-500 to-teal-500 rounded-2xl blur opacity-20 transition duration-1000 group-hover:opacity-30"></div>
          <form onSubmit={handleJoinWaitlist} className="relative flex flex-col gap-3 p-3 rounded-2xl bg-zinc-900/90 border border-zinc-800 backdrop-blur-xl shadow-2xl">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email address..."
              className="w-full bg-zinc-950/50 rounded-xl px-5 py-4 text-base text-white placeholder:text-zinc-500 border border-zinc-800/50 outline-none focus:border-violet-500/50 transition-colors"
              disabled={status === 'loading' || status === 'success'}
            />
            <button
              type="submit"
              disabled={status === 'loading' || status === 'success'}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-4 text-base font-semibold text-white transition hover:opacity-95 disabled:opacity-50"
            >
              {status === 'loading' ? 'Joining...' : status === 'success' ? 'Joined!' : 'Join Waitlist'}
              {status !== 'loading' && status !== 'success' && <ArrowRight className="h-5 w-5" />}
            </button>
          </form>
          {message && (
            <p className={`mt-6 text-center text-sm font-medium ${status === 'success' ? 'text-teal-400' : 'text-rose-400'}`}>
              {message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
