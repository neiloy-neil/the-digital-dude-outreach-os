'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/components/reachmira/AppShell';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/lib/toast/toast-context';
import { Sparkles, Send, Mail, CheckCircle, RefreshCcw } from 'lucide-react';

type Message = {
  id: string;
  sender_email: string;
  subject: string;
  snippet: string;
  status: string;
  received_at: string;
  lead_id: string;
  leads: { first_name: string; last_name: string; company: string; email: string };
};

type ThreadMessage = {
  id: string;
  type: 'sent' | 'received';
  subject: string;
  body_html: string;
  body_text: string;
  timestamp: string;
  sender_email: string;
  recipient_email: string;
};

export default function InboxPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [thread, setThread] = useState<ThreadMessage[]>([]);
  const [replyText, setReplyText] = useState('');
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [replying, setReplying] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const toast = useToast();

  const loadMessages = async (forceSync = false) => {
    setLoading(true);
    try {
      if (forceSync) {
        toast.success('Syncing inbox...', { icon: <RefreshCcw className="h-4 w-4 animate-spin text-violet-500" /> });
        await fetch('/api/cron/check-replies', { method: 'POST' });
      }
      const res = await fetch('/api/inbox');
      const data = await res.json();
      if (data.messages) {
        setMessages(data.messages);
      }
    } catch (err) {
      toast.error('Failed to load inbox');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMessages();
  }, []);

  const loadThread = async (id: string) => {
    setThreadLoading(true);
    setSelectedId(id);
    try {
      const res = await fetch(`/api/inbox/${id}`);
      const data = await res.json();
      if (data.thread) {
        setThread(data.thread);
      }
      
      // Auto-mark as read
      const msg = messages.find(m => m.id === id);
      if (msg && msg.status === 'unread') {
        await fetch(`/api/inbox/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'read' })
        });
        setMessages(messages.map(m => m.id === id ? { ...m, status: 'read' } : m));
      }
    } catch (err) {
      toast.error('Failed to load thread');
    } finally {
      setThreadLoading(false);
    }
  };

  const handleDraftAI = async () => {
    if (!selectedId) return;
    setDrafting(true);
    try {
      const res = await fetch(`/api/inbox/${selectedId}/draft`, { method: 'POST' });
      const data = await res.json();
      if (data.draft) {
        setReplyText(data.draft);
      } else {
        toast.error(data.error || 'Failed to draft AI reply');
      }
    } catch (err) {
      toast.error('Failed to draft AI reply');
    } finally {
      setDrafting(false);
    }
  };

  const handleReply = async () => {
    if (!selectedId || !replyText.trim()) return;
    setReplying(true);
    try {
      const res = await fetch(`/api/inbox/${selectedId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: replyText }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Reply sent successfully');
        setReplyText('');
        setMessages(messages.map(m => m.id === selectedId ? { ...m, status: 'replied' } : m));
        loadThread(selectedId);
      } else {
        toast.error(data.error || 'Failed to send reply');
      }
    } catch (err) {
      toast.error('Failed to send reply');
    } finally {
      setReplying(false);
    }
  };

  const selectedMsg = messages.find(m => m.id === selectedId);

  return (
    <AppShell>
      <div className="flex h-[calc(100vh-theme(spacing.16))] bg-zinc-50 -mx-6 -my-6">
        {/* Left Pane: Message List */}
        <div className="w-1/3 border-r border-[var(--border)] bg-white flex flex-col">
          <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
            <h2 className="text-lg font-bold text-zinc-900">Inbox</h2>
            <button onClick={() => loadMessages(true)} className="text-zinc-500 hover:text-zinc-900 transition-colors">
              <RefreshCcw className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-sm text-zinc-500">Loading...</div>
            ) : messages.length === 0 ? (
              <div className="p-4 text-center text-sm text-zinc-500">No messages found.</div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  onClick={() => loadThread(msg.id)}
                  className={`cursor-pointer border-b border-[var(--border)] p-4 hover:bg-zinc-50 ${selectedId === msg.id ? 'bg-violet-50 border-l-4 border-l-violet-500' : 'border-l-4 border-l-transparent'}`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className={`font-semibold text-sm ${msg.status === 'unread' ? 'text-zinc-900' : 'text-zinc-600'}`}>
                      {msg.leads?.first_name || msg.sender_email.split('@')[0]}
                    </span>
                    <span className="text-xs text-zinc-400">
                      {formatDistanceToNow(new Date(msg.received_at), { addSuffix: true })}
                    </span>
                  </div>
                  <div className={`text-xs mb-1 ${msg.status === 'unread' ? 'font-medium text-zinc-800' : 'text-zinc-500'}`}>
                    {msg.subject}
                  </div>
                  <div className="text-xs text-zinc-500 truncate">{msg.snippet}</div>
                  <div className="mt-2 flex items-center gap-2">
                    {msg.status === 'unread' && <span className="h-2 w-2 rounded-full bg-violet-500"></span>}
                    {msg.status === 'replied' && <CheckCircle className="h-3 w-3 text-emerald-500" />}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Pane: Thread View */}
        <div className="flex-1 flex flex-col bg-white">
          {selectedId && selectedMsg ? (
            <>
              {/* Thread Header */}
              <div className="border-b border-[var(--border)] p-4 flex items-center justify-between bg-zinc-50/50">
                <div>
                  <h2 className="text-lg font-bold text-zinc-900">{selectedMsg.subject}</h2>
                  <p className="text-sm text-zinc-500">
                    {selectedMsg.leads?.first_name} {selectedMsg.leads?.last_name} ({selectedMsg.sender_email})
                    {selectedMsg.leads?.company && ` • ${selectedMsg.leads.company}`}
                  </p>
                </div>
              </div>

              {/* Thread Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {threadLoading ? (
                  <div className="text-center text-sm text-zinc-500">Loading thread...</div>
                ) : (
                  thread.map((tMsg, i) => (
                    <div key={i} className={`flex ${tMsg.type === 'sent' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-2xl rounded-2xl p-4 shadow-sm ${tMsg.type === 'sent' ? 'bg-violet-600 text-white' : 'bg-zinc-100 text-zinc-900'}`}>
                        <div className={`text-xs mb-2 ${tMsg.type === 'sent' ? 'text-violet-200' : 'text-zinc-500'}`}>
                          {formatDistanceToNow(new Date(tMsg.timestamp), { addSuffix: true })}
                        </div>
                        <div className="text-sm whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: tMsg.body_html || tMsg.body_text }} />
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Reply Box */}
              <div className="border-t border-[var(--border)] p-4 bg-zinc-50/50">
                <div className="bg-white rounded-2xl border border-[var(--border)] shadow-sm focus-within:ring-2 focus-within:ring-violet-500/20 focus-within:border-violet-500 transition-all">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Type your reply..."
                    className="w-full bg-transparent p-4 text-sm outline-none resize-none min-h-[100px]"
                  />
                  <div className="flex items-center justify-between border-t border-[var(--border)] p-2 bg-zinc-50/50 rounded-b-2xl">
                    <button
                      onClick={handleDraftAI}
                      disabled={drafting}
                      className="flex items-center gap-2 rounded-xl bg-white border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition"
                    >
                      <Sparkles className="h-3 w-3 text-violet-500" />
                      {drafting ? 'Drafting...' : 'Draft with AI'}
                    </button>
                    <button
                      onClick={handleReply}
                      disabled={replying || !replyText.trim()}
                      className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50 transition"
                    >
                      <Send className="h-4 w-4" />
                      {replying ? 'Sending...' : 'Send Reply'}
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-zinc-400">
              <div className="text-center">
                <Mail className="mx-auto h-12 w-12 mb-3 text-zinc-300" />
                <p>Select a message to view the thread</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
