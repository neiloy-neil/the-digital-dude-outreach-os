'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { 
  CheckCircle2, ArrowRight, FileSpreadsheet, 
  Users, CheckSquare, Search, Send, FileText, AlertCircle, Loader2, Zap
} from 'lucide-react';

export default function WaitlistPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg('');

    const formData = new FormData(e.currentTarget);
    const data = {
      full_name: formData.get('full_name'),
      email: formData.get('email'),
      company_name: formData.get('company_name'),
      role: formData.get('role'),
      current_outreach_method: formData.get('current_outreach_method'),
      use_case: formData.get('use_case'),
      monthly_outreach_volume: formData.get('monthly_outreach_volume'),
      website_url: formData.get('website_url'),
      agreed_to_updates: formData.get('agreed_to_updates') === 'on'
    };

    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || result.message || 'Something went wrong.');
      }
      setSuccess(true);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#111827] font-sans selection:bg-[#7C3AED]/20 scroll-smooth">
      
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-[#FFFFFF]/80 backdrop-blur-md border-b border-[#E5E7EB]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/reachmira-logo.png" alt="ReachMira Logo" width={32} height={32} className="w-8 h-8 object-contain" />
            <span className="font-bold text-xl tracking-tight text-[#111827]">ReachMira</span>
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-[#6B7280]">
            <Link href="/#features" className="hover:text-[#7C3AED] transition-colors">Features</Link>
            <Link href="/#how-it-works" className="hover:text-[#7C3AED] transition-colors">How It Works</Link>
            <Link href="/#pricing" className="hover:text-[#7C3AED] transition-colors">Pricing</Link>
          </div>
          <div className="hidden md:flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium text-[#6B7280] hover:text-[#111827] transition-colors">Login</Link>
            <a href="#waitlist-form" className="text-sm font-medium bg-[#7C3AED] hover:bg-[#6D28D9] text-white px-5 py-2 rounded-full transition-colors shadow-sm">
              Join Waitlist
            </a>
          </div>
          <button className="md:hidden" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            <svg className="w-6 h-6 text-[#111827]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
          </button>
        </div>
      </nav>

      {/* Hero & Form Section */}
      <section className="relative pt-20 pb-32 px-6 max-w-7xl mx-auto">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-[400px] bg-gradient-to-b from-[#7C3AED]/10 to-transparent blur-3xl -z-10 rounded-full" />
        
        <div className="flex flex-col lg:flex-row gap-16 items-start">
          {/* Left: Copy */}
          <div className="flex-1 lg:sticky lg:top-32 pt-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#CCFBF1] text-[#14B8A6] text-xs font-semibold uppercase tracking-wider mb-8">
              <span>Early Beta Access</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-[#111827] mb-6 leading-tight">
              Join the ReachMira early beta.
            </h1>
            <p className="text-xl text-[#6B7280] mb-8 leading-relaxed">
              Be among the first to test a simple outreach workspace built for importing leads, verifying emails, writing personalized outreach, and tracking follow-ups without expensive cold email tools.
            </p>
            <p className="text-lg font-medium text-[#111827]">
              Get early access and help shape ReachMira before public launch.
            </p>
          </div>

          {/* Right: Form */}
          <div id="waitlist-form" className="w-full lg:w-[500px] bg-white border border-[#E5E7EB] rounded-2xl shadow-xl p-8 relative overflow-hidden">
            {success ? (
              <div className="py-16 text-center">
                <div className="w-16 h-16 bg-[#CCFBF1] rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 className="w-8 h-8 text-[#14B8A6]" />
                </div>
                <h3 className="text-2xl font-bold text-[#111827] mb-4">You&apos;re on the list.</h3>
                <p className="text-[#6B7280] mb-8">We&apos;ll contact you when early beta access opens.</p>
                <p className="text-sm font-medium text-[#111827]">Thank you for helping shape ReachMira.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                {errorMsg && (
                  <div className="p-4 bg-red-50 text-red-700 text-sm font-medium rounded-lg flex gap-2 items-start border border-red-100">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    {errorMsg}
                  </div>
                )}
                
                <div>
                  <label className="block text-sm font-medium text-[#111827] mb-1.5">Full name *</label>
                  <input required name="full_name" type="text" className="w-full bg-[#F8FAFC] border border-[#E5E7EB] rounded-lg px-4 py-2.5 outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 transition-all text-[#111827]" placeholder="Jane Doe" />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-[#111827] mb-1.5">Work email *</label>
                  <input required name="email" type="email" className="w-full bg-[#F8FAFC] border border-[#E5E7EB] rounded-lg px-4 py-2.5 outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 transition-all text-[#111827]" placeholder="jane@company.com" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#111827] mb-1.5">Company or brand name</label>
                  <input name="company_name" type="text" className="w-full bg-[#F8FAFC] border border-[#E5E7EB] rounded-lg px-4 py-2.5 outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 transition-all text-[#111827]" placeholder="Acme Corp" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#111827] mb-1.5">Role</label>
                  <select name="role" className="w-full bg-[#F8FAFC] border border-[#E5E7EB] rounded-lg px-4 py-2.5 outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 transition-all text-[#111827] appearance-none">
                    <option value="">Select a role...</option>
                    <option value="Founder">Founder</option>
                    <option value="Freelancer">Freelancer</option>
                    <option value="Small agency owner">Small agency owner</option>
                    <option value="Marketer">Marketer</option>
                    <option value="Sales professional">Sales professional</option>
                    <option value="Developer / builder">Developer / builder</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#111827] mb-1.5">Current outreach method</label>
                  <select name="current_outreach_method" className="w-full bg-[#F8FAFC] border border-[#E5E7EB] rounded-lg px-4 py-2.5 outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 transition-all text-[#111827] appearance-none">
                    <option value="">Select current method...</option>
                    <option value="Google Sheets / Excel">Google Sheets / Excel</option>
                    <option value="Gmail / manual email">Gmail / manual email</option>
                    <option value="ChatGPT + manual sending">ChatGPT + manual sending</option>
                    <option value="Instantly / Smartlead / Lemlist">Instantly / Smartlead / Lemlist</option>
                    <option value="Apollo / Outreach / Salesloft">Apollo / Outreach / Salesloft</option>
                    <option value="Not doing outreach yet">Not doing outreach yet</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#111827] mb-1.5">Monthly outreach volume</label>
                  <select name="monthly_outreach_volume" className="w-full bg-[#F8FAFC] border border-[#E5E7EB] rounded-lg px-4 py-2.5 outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 transition-all text-[#111827] appearance-none">
                    <option value="">Select volume...</option>
                    <option value="1–50 leads">1–50 leads</option>
                    <option value="51–200 leads">51–200 leads</option>
                    <option value="201–500 leads">201–500 leads</option>
                    <option value="500+ leads">500+ leads</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#111827] mb-1.5">What do you want to use ReachMira for?</label>
                  <textarea name="use_case" rows={3} className="w-full bg-[#F8FAFC] border border-[#E5E7EB] rounded-lg px-4 py-2.5 outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 transition-all text-[#111827] resize-none" placeholder="Briefly describe your workflow..."></textarea>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#111827] mb-1.5">Website URL (Optional)</label>
                  <input name="website_url" type="url" className="w-full bg-[#F8FAFC] border border-[#E5E7EB] rounded-lg px-4 py-2.5 outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 transition-all text-[#111827]" placeholder="https://" />
                </div>

                <div className="flex items-start gap-3 mt-2">
                  <input type="checkbox" id="updates" name="agreed_to_updates" className="mt-1 w-4 h-4 rounded border-[#E5E7EB] text-[#7C3AED] focus:ring-[#7C3AED]" />
                  <label htmlFor="updates" className="text-sm text-[#6B7280]">I agree to receive updates about ReachMira beta access.</label>
                </div>

                <button 
                  disabled={isSubmitting} 
                  className="mt-4 w-full bg-[#7C3AED] hover:bg-[#6D28D9] disabled:bg-[#7C3AED]/50 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-[#7C3AED]/20 flex items-center justify-center gap-2"
                >
                  {isSubmitting && <Loader2 className="w-5 h-5 animate-spin" />}
                  Join Early Beta
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* Why Join Section */}
      <section className="bg-white py-24 border-y border-[#E5E7EB]">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center text-[#111827] mb-16">Why join the early beta?</h2>
          <div className="grid md:grid-cols-4 gap-6">
            {[
              { icon: Search, text: "Test ReachMira before public launch" },
              { icon: Send, text: "Share feedback on the workflow" },
              { icon: Users, text: "Help shape future features" },
              { icon: Zap, text: "Get early access to affordable outreach tools" }
            ].map((item, idx) => (
              <div key={idx} className="bg-[#F8FAFC] p-8 rounded-2xl border border-[#E5E7EB] flex flex-col items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-white border border-[#E5E7EB] flex items-center justify-center shadow-sm">
                  <item.icon className="w-5 h-5 text-[#6B7280]" />
                </div>
                <p className="font-medium text-[#111827] text-lg leading-snug">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What you'll test Section */}
      <section className="py-24 bg-[#F8FAFC]">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-[#111827] mb-12 text-center">What early beta testers will try</h2>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              { icon: FileSpreadsheet, title: "Import leads from CSV or Google Sheets" },
              { icon: CheckSquare, title: "See email verification status" },
              { icon: Search, title: "Organize pain points and solution ideas" },
              { icon: FileText, title: "Write personalized manual emails" },
              { icon: Send, title: "Track sent emails and follow-ups" },
              { icon: Users, title: "Keep lead history in one place" }
            ].map((feat, idx) => (
              <div key={idx} className="bg-white p-6 rounded-2xl border border-[#E5E7EB] shadow-sm flex items-start gap-4">
                <feat.icon className="w-6 h-6 text-[#7C3AED] shrink-0" />
                <span className="font-medium text-[#111827]">{feat.title}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Best For Section */}
      <section className="py-24 bg-white border-y border-[#E5E7EB]">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-[#111827] mb-12">Built for people doing outreach manually.</h2>
          <div className="flex flex-wrap justify-center gap-4 max-w-4xl mx-auto">
            {[
              'Founders testing sales', 'Freelancers finding clients', 'Small agencies managing leads', 
              'Marketers running outreach', 'B2B service providers', 'Early teams avoiding expensive tools'
            ].map((tag, i) => (
              <span key={i} className="bg-[#F8FAFC] border border-[#E5E7EB] text-[#111827] px-6 py-3 rounded-full font-medium shadow-sm text-base">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-32 bg-[#F8FAFC] text-center">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-4xl font-extrabold text-[#111827] mb-6">Help build a simpler way to manage outreach.</h2>
          <p className="text-xl text-[#6B7280] mb-10">Join the early beta list and tell us what would make ReachMira useful for your workflow.</p>
          <a href="#waitlist-form" className="inline-flex items-center gap-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold text-lg px-8 py-4 rounded-full transition-colors shadow-lg shadow-[#7C3AED]/20">
            Join Early Beta <ArrowRight className="w-5 h-5" />
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-[#E5E7EB] py-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex flex-col items-center md:items-start">
            <div className="flex items-center gap-2 mb-2">
              <Image src="/reachmira-logo.png" alt="Logo" width={24} height={24} className="w-6 h-6 object-contain grayscale opacity-60" />
              <span className="font-bold text-[#111827]">ReachMira</span>
            </div>
            <p className="text-sm text-[#6B7280]">Simple outreach workspace for early-stage teams.</p>
          </div>
          <div className="flex gap-6 text-sm font-medium text-[#6B7280]">
            <Link href="/login" className="hover:text-[#111827] transition-colors">Login</Link>
            <Link href="/register" className="hover:text-[#111827] transition-colors">Register</Link>
            <Link href="#" className="hover:text-[#111827] transition-colors">Terms</Link>
            <Link href="#" className="hover:text-[#111827] transition-colors">Privacy</Link>
          </div>
          <p className="text-sm text-[#6B7280]">© {new Date().getFullYear()} ReachMira. All rights reserved.</p>
        </div>
      </footer>

    </div>
  );
}
