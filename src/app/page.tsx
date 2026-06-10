'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { 
  CheckCircle2, ArrowRight, FileSpreadsheet, 
  Users, CheckSquare, Search, Send, FileText, Clock, Zap 
} from 'lucide-react';

export default function HomePage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#111827] font-sans selection:bg-[#7C3AED]/20">
      
      {/* 1. Navbar */}
      <nav className="sticky top-0 z-50 bg-[#FFFFFF]/80 backdrop-blur-md border-b border-[#E5E7EB]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <Image 
              src="/reachmira-logo.png" 
              alt="ReachMira Logo" 
              width={160} 
              height={40} 
              className="h-10 w-auto object-contain"
            />
          </Link>
          
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-[#6B7280]">
            <a href="#features" className="hover:text-[#7C3AED] transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-[#7C3AED] transition-colors">How It Works</a>
            <a href="#pricing" className="hover:text-[#7C3AED] transition-colors">Pricing</a>
          </div>

          <div className="hidden md:flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium text-[#6B7280] hover:text-[#111827] transition-colors">
              Login
            </Link>
            <Link href="/register" className="text-sm font-medium bg-[#7C3AED] hover:bg-[#6D28D9] text-white px-5 py-2 rounded-full transition-colors shadow-sm">
              Start Free
            </Link>
          </div>

          <button className="md:hidden" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            <svg className="w-6 h-6 text-[#111827]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
          </button>
        </div>
      </nav>

      {/* 2. Hero Section */}
      <section className="relative pt-24 pb-32 px-6 max-w-7xl mx-auto text-center">
        {/* Soft Violet gradient blob behind hero */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-[400px] bg-gradient-to-b from-[#7C3AED]/10 to-transparent blur-3xl -z-10 rounded-full" />
        
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-[#111827] max-w-4xl mx-auto mb-6 leading-tight">
          Turn your lead list into <br className="hidden md:block"/> 
          <span className="text-[#7C3AED]">personalized outreach.</span>
        </h1>
        
        <p className="text-lg md:text-xl text-[#6B7280] max-w-2xl mx-auto mb-10 leading-relaxed">
          ReachMira helps startups, freelancers, marketers, and small agencies import leads, verify emails, write better outreach, send manually, and track every follow-up from one simple workspace.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
          <Link href="/register" className="w-full sm:w-auto text-base font-semibold bg-[#7C3AED] hover:bg-[#6D28D9] text-white px-8 py-4 rounded-full transition-colors shadow-lg shadow-[#7C3AED]/20">
            Start Free
          </Link>
          <a href="#how-it-works" className="w-full sm:w-auto text-base font-medium bg-white border border-[#E5E7EB] hover:border-[#7C3AED]/50 hover:bg-[#F8FAFC] text-[#111827] px-8 py-4 rounded-full transition-colors">
            See How It Works
          </a>
        </div>

        <p className="text-sm text-[#6B7280] font-medium mb-16">
          Built for people using CSV, Google Sheets, ChatGPT, and their own email accounts.
        </p>

        {/* Hero Visual Mockup */}
        <div className="relative mx-auto max-w-5xl rounded-2xl bg-white border border-[#E5E7EB] shadow-2xl overflow-hidden text-left flex flex-col md:flex-row h-auto md:h-[450px]">
          {/* Mockup Sidebar */}
          <div className="w-full md:w-64 bg-[#F8FAFC] border-r border-[#E5E7EB] p-4 flex flex-col gap-2">
            <div className="flex items-center gap-2 mb-6 px-2">
              <div className="w-3 h-3 rounded-full bg-red-400"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
              <div className="w-3 h-3 rounded-full bg-green-400"></div>
            </div>
            <div className="flex items-center gap-3 px-3 py-2 bg-white rounded-lg shadow-sm border border-[#E5E7EB] text-sm font-semibold text-[#111827]">
              <Users className="w-4 h-4 text-[#7C3AED]" /> Lead Library
            </div>
            <div className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-[#6B7280]">
              <Send className="w-4 h-4" /> Ready to Send <span className="ml-auto bg-[#7C3AED] text-white text-xs px-2 py-0.5 rounded-full">12</span>
            </div>
            <div className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-[#6B7280]">
              <Clock className="w-4 h-4" /> Today&apos;s Follow-ups
            </div>
          </div>
          {/* Mockup Main */}
          <div className="flex-1 bg-white p-6 md:p-8 flex flex-col gap-6 overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#F3F4F6] pb-4">
              <div>
                <h3 className="font-bold text-lg text-[#111827]">Sarah Jenkins</h3>
                <p className="text-sm text-[#6B7280]">Acme Corp • Founder</p>
              </div>
              <div className="flex gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-50 text-green-700 text-xs font-medium border border-green-200">
                  <CheckCircle2 className="w-3 h-3" /> Valid Email
                </span>
              </div>
            </div>
            
            <div className="flex-1 bg-[#F8FAFC] rounded-xl border border-[#E5E7EB] p-5 flex flex-col">
              <div className="text-sm text-[#6B7280] mb-4 border-b border-[#E5E7EB] pb-2">Drafting manual email...</div>
              <div className="space-y-3">
                <div className="h-4 bg-[#E5E7EB] rounded w-3/4"></div>
                <div className="h-4 bg-[#E5E7EB] rounded w-full"></div>
                <div className="h-4 bg-[#E5E7EB] rounded w-5/6"></div>
              </div>
              <div className="mt-auto flex justify-end">
                <div className="bg-[#7C3AED] text-white text-sm px-4 py-2 rounded-lg font-medium flex items-center gap-2">
                  <Send className="w-4 h-4" /> Send Email
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Problem Section */}
      <section className="bg-white py-24 border-y border-[#E5E7EB]">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-[#111827] mb-16">Outreach gets messy fast.</h2>
          <div className="grid md:grid-cols-4 gap-6">
            {[
              { icon: FileSpreadsheet, text: "Lead lists stay scattered in spreadsheets" },
              { icon: FileText, text: "Personalized emails are hard to organize" },
              { icon: Clock, text: "Follow-ups are easy to forget" },
              { icon: Zap, text: "Most outreach tools cost too much too early" }
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

      {/* 4. Solution / Features Section */}
      <section id="features" className="py-24 bg-[#F8FAFC]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-[#111827] mb-4">ReachMira keeps your outreach organized from first lead to final follow-up.</h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: FileSpreadsheet, title: "Import leads from CSV or Google Sheets", desc: "Easily drop in your data and map it to your workspace." },
              { icon: CheckSquare, title: "Verify email status before sending", desc: "Detect invalid and risky emails instantly to protect your domain." },
              { icon: Search, title: "Store pain points and solution angles", desc: "Keep all your deep research perfectly attached to each lead." },
              { icon: FileText, title: "Write and save manual emails", desc: "Draft highly personalized emails right next to the lead&apos;s context." },
              { icon: Send, title: "Track sent emails and follow-ups", desc: "Never forget who you emailed or when it&apos;s time to reach back out." },
              { icon: Users, title: "Keep every lead history in one place", desc: "A unified view of every interaction you&apos;ve had with a prospect." }
            ].map((feat, idx) => (
              <div key={idx} className="bg-white p-6 rounded-2xl border border-[#E5E7EB] shadow-sm hover:shadow-md transition-shadow">
                <div className="w-12 h-12 rounded-xl bg-[#7C3AED]/10 flex items-center justify-center mb-5">
                  <feat.icon className="w-6 h-6 text-[#7C3AED]" />
                </div>
                <h3 className="font-bold text-lg text-[#111827] mb-2">{feat.title}</h3>
                <p className="text-[#6B7280]">{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. How it works Section */}
      <section id="how-it-works" className="py-24 bg-white border-y border-[#E5E7EB]">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-[#111827] mb-16">How ReachMira works</h2>
          
          <div className="space-y-12">
            {[
              { step: 1, title: "Import your leads", desc: "Upload a CSV or connect a Google Sheet." },
              { step: 2, title: "Review and verify", desc: "See email status, missing data, and outreach readiness." },
              { step: 3, title: "Write personalized emails", desc: "Use lead context, pain points, and solution ideas to write better emails." },
              { step: 4, title: "Send and track", desc: "Send manually from your connected email account and track every follow-up." }
            ].map((item) => (
              <div key={item.step} className="flex gap-6 items-start">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#14B8A6]/10 text-[#14B8A6] flex items-center justify-center font-bold text-lg border border-[#14B8A6]/20">
                  {item.step}
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-[#111827] mb-2">{item.title}</h3>
                  <p className="text-lg text-[#6B7280]">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. Best For Section */}
      <section className="py-24 bg-[#F8FAFC]">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-[#111827] mb-12">Built for early-stage outreach.</h2>
          <div className="flex flex-wrap justify-center gap-4 max-w-4xl mx-auto">
            {['Startups', 'Freelancers', 'Small agencies', 'Early-stage marketers', 'B2B service providers', 'Founders doing sales manually'].map((tag, i) => (
              <span key={i} className="bg-white border border-[#E5E7EB] text-[#111827] px-6 py-3 rounded-full font-medium shadow-sm text-lg">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* 7. Comparison Section */}
      <section className="py-24 bg-white border-y border-[#E5E7EB] overflow-x-auto">
        <div className="max-w-7xl mx-auto px-6 min-w-[800px]">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-[#111827] mb-16">Before you need a heavy outreach platform, start with ReachMira.</h2>
          
          <div className="border border-[#E5E7EB] rounded-2xl overflow-hidden shadow-sm">
            {/* Header */}
            <div className="grid grid-cols-4 bg-[#F8FAFC] border-b border-[#E5E7EB]">
              <div className="p-6 font-semibold text-[#6B7280]"></div>
              <div className="p-6 font-bold text-[#111827] text-center border-l border-[#E5E7EB]">Spreadsheet</div>
              <div className="p-6 font-bold text-[#111827] text-center border-l border-[#E5E7EB]">Heavy Outreach Tools</div>
              <div className="p-6 font-bold text-[#7C3AED] text-center bg-[#7C3AED]/5 border-l border-[#E5E7EB]">ReachMira</div>
            </div>

            {/* Rows */}
            {[
              { label: "Lead organization", s: "Basic", h: "Advanced", r: "Simple and focused" },
              { label: "Personalized email workflow", s: "Manual", h: "Automated", r: "Manual-first with context" },
              { label: "Follow-up tracking", s: "Easy to miss", h: "Powerful", r: "Clear and simple" },
              { label: "Email verification", s: "No", h: "Usually yes", r: "Yes" },
              { label: "Cost", s: "Free", h: "Often expensive", r: "Affordable" },
              { label: "Best for", s: "Raw data", h: "Scaling teams", r: "Getting started" }
            ].map((row, idx) => (
              <div key={idx} className="grid grid-cols-4 border-b border-[#E5E7EB] last:border-0 bg-white">
                <div className="p-6 font-medium text-[#111827]">{row.label}</div>
                <div className="p-6 text-[#6B7280] text-center border-l border-[#E5E7EB]">{row.s}</div>
                <div className="p-6 text-[#6B7280] text-center border-l border-[#E5E7EB]">{row.h}</div>
                <div className="p-6 font-bold text-[#7C3AED] bg-[#7C3AED]/5 text-center border-l border-[#E5E7EB]">{row.r}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 8. Pricing Section */}
      <section id="pricing" className="py-24 bg-[#F8FAFC]">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-[#111827] mb-16">Simple pricing for early-stage users.</h2>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Free Beta */}
            <div className="bg-white border border-[#E5E7EB] rounded-2xl p-8 shadow-sm flex flex-col">
              <h3 className="text-2xl font-bold text-[#111827] mb-2">Free Beta</h3>
              <p className="text-[#6B7280] mb-8">Test ReachMira while we build.</p>
              <div className="mt-auto">
                <Link href="/waitlist" className="block w-full text-center bg-white border border-[#E5E7EB] hover:bg-[#F8FAFC] text-[#111827] font-semibold py-3 rounded-xl transition-colors">
                  Join Early Access
                </Link>
              </div>
            </div>

            {/* Starter */}
            <div className="bg-white border-2 border-[#7C3AED] rounded-2xl p-8 shadow-lg relative flex flex-col transform md:-translate-y-4">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#7C3AED] text-white text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full">Most Popular</div>
              <h3 className="text-2xl font-bold text-[#111827] mb-2">Starter</h3>
              <p className="text-[#6B7280] mb-8">For freelancers and founders.</p>
              <div className="mt-auto">
                <Link href="/waitlist" className="block w-full text-center bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-semibold py-3 rounded-xl transition-colors">
                  Join Early Access
                </Link>
              </div>
            </div>

            {/* Agency */}
            <div className="bg-white border border-[#E5E7EB] rounded-2xl p-8 shadow-sm flex flex-col">
              <h3 className="text-2xl font-bold text-[#111827] mb-2">Agency</h3>
              <p className="text-[#6B7280] mb-8">For small teams managing multiple lead lists.</p>
              <div className="mt-auto">
                <Link href="/waitlist" className="block w-full text-center bg-white border border-[#E5E7EB] hover:bg-[#F8FAFC] text-[#111827] font-semibold py-3 rounded-xl transition-colors">
                  Join Early Access
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 9. Final CTA Section */}
      <section className="py-32 bg-white border-t border-[#E5E7EB] text-center">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-4xl md:text-5xl font-extrabold text-[#111827] mb-6">Start organizing your outreach before it gets messy.</h2>
          <p className="text-xl text-[#6B7280] mb-10">Import your leads, verify emails, write personalized outreach, and track every follow-up from one simple workspace.</p>
          <Link href="/register" className="inline-flex items-center gap-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold text-lg px-8 py-4 rounded-full transition-colors shadow-lg shadow-[#7C3AED]/20">
            Start Free <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#F8FAFC] border-t border-[#E5E7EB] py-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex flex-col items-center md:items-start">
            <Link href="/" className="flex items-center mb-4">
              <Image src="/reachmira-logo.png" alt="ReachMira Logo" width={140} height={32} className="h-8 w-auto object-contain grayscale opacity-60" />
            </Link>
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
