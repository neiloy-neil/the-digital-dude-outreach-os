'use client'

import { useState } from 'react';
import { Mail, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { processUnsubscribe } from './actions';

export default function UnsubscribeClient({ token, emailAddress }: { token: string, emailAddress: string }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleUnsubscribe = async () => {
    setStatus('loading');
    try {
      const res = await processUnsubscribe(token);
      if (res.status === 'success') {
        setStatus('success');
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  };

  if (status === 'success') {
    return (
      <div className="flex flex-col items-center text-center">
        <div className="mb-6 rounded-full bg-emerald-50 p-4 text-emerald-600">
          <CheckCircle className="h-12 w-12" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">Unsubscribed successfully</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          The email address <span className="font-semibold text-zinc-900">{emailAddress}</span> has been removed from our list. You will not receive any further outreach emails from ReachMira.
        </p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex flex-col items-center text-center">
        <div className="mb-6 rounded-full bg-rose-50 p-4 text-rose-600">
          <AlertCircle className="h-12 w-12" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">Something went wrong</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          There was an issue processing your unsubscribe request. Please try again later or reply directly to the email to opt-out.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-6 rounded-full bg-amber-50 p-4 text-amber-600">
        <Mail className="h-12 w-12" />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">Unsubscribe from ReachMira</h1>
      <p className="mt-3 text-sm leading-6 text-zinc-600 mb-8">
        Are you sure you want to stop receiving emails to <span className="font-semibold text-zinc-900">{emailAddress}</span>? You will not be able to undo this action.
      </p>
      <button 
        onClick={handleUnsubscribe} 
        disabled={status === 'loading'}
        className="bg-rose-600 hover:bg-rose-700 text-white font-semibold py-3 px-8 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[200px]"
      >
        {status === 'loading' ? <Loader2 className="w-5 h-5 animate-spin" /> : "Yes, Unsubscribe"}
      </button>
    </div>
  );
}
