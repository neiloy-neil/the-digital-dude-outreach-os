'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { 
  ArrowRight, Sparkles, Clock, Bot, Layers, 
  CheckCircle2, ChevronDown, ShieldCheck, Mail, 
  Zap, Star, User, Building2, Briefcase
} from 'lucide-react';

export default function HomePage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    {
      question: "Do I need to warm up my email?",
      answer: "Since ReachMira connects directly to your existing inboxes (via SMTP or APIs like Mailgun) and sends manually or in small, controlled batches, your deliverability naturally stays extremely high. We recommend standard best practices, but you won't need complex automated warmup tools if you're doing true manual-first outreach."
    },
    {
      question: "What AI models does ReachMira use?",
      answer: "We leverage Google's Gemini models for our Auto-Research feature. It's incredibly fast at reading a website's HTML, stripping away the noise, and extracting exactly the company summaries and pain points you need to personalize your emails."
    },
    {
      question: "Can I still send automated campaigns?",
      answer: "Yes! While our core philosophy is 'manual-first' for high-value targets, we do have a campaign engine for sending follow-ups and broader blasts. However, our safety rules ensure you don't accidentally spam unverified or risky emails."
    },
    {
      question: "How does the pricing work during Beta?",
      answer: "Right now, the Private Beta is free while we iron out the kinks and gather feedback. Once we officially launch, early adopters will get exclusive lifetime discounts on our paid tiers."
    }
  ];

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-zinc-100 selection:bg-violet-500/30 overflow-x-hidden">
      {/* Background gradients */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-violet-600/10 blur-[150px] rounded-full mix-blend-screen opacity-50" />
        <div className="absolute top-0 right-0 w-3/4 h-3/4 bg-teal-600/10 blur-[150px] rounded-full mix-blend-screen opacity-40" />
        <div className="absolute bottom-0 left-1/4 w-1/2 h-1/2 bg-indigo-600/10 blur-[150px] rounded-full mix-blend-screen opacity-30" />
      </div>

      <div className="relative z-10">
        {/* Navigation */}
        <nav className="container mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image 
              src="/reachmira-logo.png" 
              alt="ReachMira Logo" 
              width={32} 
              height={32} 
              className="w-8 h-8 object-contain"
            />
            <span className="text-xl font-bold tracking-tight text-white">ReachMira</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/login" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors hidden sm:block">
              Login
            </Link>
            <Link href="/waitlist" className="text-sm font-semibold bg-white text-black px-4 py-2 rounded-full hover:bg-zinc-200 transition-colors">
              Join Waitlist
            </Link>
          </div>
        </nav>

        {/* Hero Section */}
        <main className="container mx-auto px-6 pt-24 pb-32 flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-4 py-1.5 text-xs font-semibold text-violet-300 mb-8 shadow-[0_0_20px_rgba(139,92,246,0.15)] backdrop-blur-md">
            <Sparkles className="h-3 w-3" />
            <span>Private Beta Currently Full</span>
          </div>

          <h1 className="max-w-5xl text-5xl md:text-7xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-zinc-500 leading-[1.1] mb-8">
            Outreach without the <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-teal-400">automation overwhelm.</span>
          </h1>

          <p className="max-w-2xl text-lg md:text-xl text-zinc-400 mb-12 leading-relaxed">
            A manual-first CRM built for B2B agencies that value deep personalization over volume. Scrape websites, manage pipelines, and track follow-ups—all in one gorgeous workspace.
          </p>

          <div className="w-full max-w-sm relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-violet-500 to-teal-500 rounded-2xl blur opacity-25 transition duration-1000 group-hover:opacity-40 animate-pulse"></div>
            <div className="relative p-2 rounded-2xl bg-zinc-900/80 border border-zinc-800 backdrop-blur-xl shadow-2xl">
              <Link
                href="/waitlist"
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-8 py-4 text-base font-bold text-white transition-all hover:scale-[1.02] active:scale-[0.98] shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]"
              >
                Join the Waitlist
                <ArrowRight className="h-5 w-5" />
              </Link>
            </div>
          </div>
          <p className="mt-4 text-sm text-zinc-500 font-medium">No credit card required. Free during beta.</p>
        </main>

        {/* Why Manual First? */}
        <section className="container mx-auto px-6 py-24 border-t border-zinc-800/50">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">Why "Manual-First"?</h2>
            <p className="text-lg text-zinc-400 leading-relaxed">
              The era of spray-and-pray cold email is dead. Automated blasts burn your domains, annoy prospects, and ruin your sender reputation. ReachMira is built on a different philosophy: quality over quantity.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3 max-w-5xl mx-auto">
            <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-3xl p-8 backdrop-blur-sm">
              <ShieldCheck className="w-10 h-10 text-teal-400 mb-6" />
              <h3 className="text-xl font-bold text-white mb-3">Protect Your Domains</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">By reviewing and sending emails manually, you drastically lower your bounce rates and avoid triggering spam filters, keeping your primary domains perfectly safe.</p>
            </div>
            <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-3xl p-8 backdrop-blur-sm">
              <Zap className="w-10 h-10 text-violet-400 mb-6" />
              <h3 className="text-xl font-bold text-white mb-3">Hyper-Personalization</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">Actually read about your prospect before you hit send. Use our AI to scrape their site, then craft a message that proves you aren't just another bot.</p>
            </div>
            <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-3xl p-8 backdrop-blur-sm">
              <Mail className="w-10 h-10 text-indigo-400 mb-6" />
              <h3 className="text-xl font-bold text-white mb-3">Higher Reply Rates</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">10 highly researched, perfectly timed emails will out-perform 1,000 generic spam blasts every single time. Book more meetings with less effort.</p>
            </div>
          </div>
        </section>

        {/* How it Works */}
        <section className="container mx-auto px-6 py-24 border-t border-zinc-800/50 bg-zinc-900/10">
          <div className="max-w-3xl mx-auto text-center mb-20">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">How it works</h2>
            <p className="text-lg text-zinc-400">A streamlined workflow designed to get you in, get you out, and get you replies.</p>
          </div>

          <div className="max-w-4xl mx-auto space-y-12 relative">
            {/* Connecting line */}
            <div className="absolute left-8 md:left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-violet-500/20 to-transparent hidden md:block" />

            {/* Step 1 */}
            <div className="flex flex-col md:flex-row items-center gap-8 md:gap-16">
              <div className="md:w-1/2 flex justify-end text-left md:text-right">
                <div>
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20 mb-4 font-bold">1</div>
                  <h3 className="text-2xl font-bold text-white mb-3">Import & Clean Leads</h3>
                  <p className="text-zinc-400">Upload your CSV or link a Google Sheet. ReachMira automatically detects risky and role-based emails so you don't waste time on bounces.</p>
                </div>
              </div>
              <div className="md:w-1/2">
                <div className="aspect-video rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl overflow-hidden relative flex items-center justify-center">
                  <Layers className="w-16 h-16 text-zinc-700" />
                  <div className="absolute inset-0 bg-gradient-to-tr from-violet-500/5 to-transparent" />
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col md:flex-row-reverse items-center gap-8 md:gap-16">
              <div className="md:w-1/2 text-left">
                <div>
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20 mb-4 font-bold">2</div>
                  <h3 className="text-2xl font-bold text-white mb-3">Auto-Research with AI</h3>
                  <p className="text-zinc-400">Click a button and ReachMira's AI will scrape the lead's website, digest what they do, and instantly extract their top pain points and suggest an angle.</p>
                </div>
              </div>
              <div className="md:w-1/2 flex justify-end">
                <div className="aspect-video w-full rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl overflow-hidden relative flex items-center justify-center">
                  <Bot className="w-16 h-16 text-zinc-700" />
                  <div className="absolute inset-0 bg-gradient-to-tr from-teal-500/5 to-transparent" />
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col md:flex-row items-center gap-8 md:gap-16">
              <div className="md:w-1/2 flex justify-end text-left md:text-right">
                <div>
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-4 font-bold">3</div>
                  <h3 className="text-2xl font-bold text-white mb-3">Send & Track</h3>
                  <p className="text-zinc-400">Review the AI's research, tweak your template, and send directly from your connected inbox. We'll track opens, clicks, and remind you when to follow up.</p>
                </div>
              </div>
              <div className="md:w-1/2">
                <div className="aspect-video w-full rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl overflow-hidden relative flex items-center justify-center">
                  <Clock className="w-16 h-16 text-zinc-700" />
                  <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/5 to-transparent" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section className="container mx-auto px-6 py-24 border-t border-zinc-800/50">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">Simple, Transparent Pricing</h2>
            <p className="text-lg text-zinc-400">Lock in early adopter pricing when you join the waitlist today. No hidden fees, no per-seat nonsense.</p>
          </div>

          <div className="grid gap-6 md:grid-cols-4 max-w-6xl mx-auto">
            {/* Free Beta */}
            <div className="flex flex-col rounded-3xl border border-zinc-800 bg-zinc-900/30 p-8 backdrop-blur-sm relative overflow-hidden">
              <div className="mb-4">
                <h3 className="text-xl font-bold text-white mb-2">Free Beta</h3>
                <p className="text-sm text-zinc-400 h-10">For our earliest testers.</p>
              </div>
              <div className="mb-6">
                <span className="text-4xl font-extrabold text-white">$0</span>
                <span className="text-zinc-500">/mo</span>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                <li className="flex items-center gap-2 text-sm text-zinc-300"><CheckCircle2 className="w-4 h-4 text-violet-400" /> 100 Leads / month</li>
                <li className="flex items-center gap-2 text-sm text-zinc-300"><CheckCircle2 className="w-4 h-4 text-violet-400" /> 1 Email Account</li>
                <li className="flex items-center gap-2 text-sm text-zinc-300"><CheckCircle2 className="w-4 h-4 text-violet-400" /> Basic AI Research</li>
              </ul>
              <Link href="/waitlist" className="w-full text-center py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-semibold transition-colors">Current Phase</Link>
            </div>

            {/* Starter */}
            <div className="flex flex-col rounded-3xl border border-zinc-800 bg-zinc-900/30 p-8 backdrop-blur-sm relative overflow-hidden">
              <div className="mb-4">
                <h3 className="text-xl font-bold text-white mb-2">Starter</h3>
                <p className="text-sm text-zinc-400 h-10">Perfect for freelancers.</p>
              </div>
              <div className="mb-6">
                <span className="text-4xl font-extrabold text-white">$9</span>
                <span className="text-zinc-500">/mo</span>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                <li className="flex items-center gap-2 text-sm text-zinc-300"><CheckCircle2 className="w-4 h-4 text-violet-400" /> 1,000 Leads / month</li>
                <li className="flex items-center gap-2 text-sm text-zinc-300"><CheckCircle2 className="w-4 h-4 text-violet-400" /> 3 Email Accounts</li>
                <li className="flex items-center gap-2 text-sm text-zinc-300"><CheckCircle2 className="w-4 h-4 text-violet-400" /> Auto-Research API</li>
              </ul>
              <Link href="/waitlist" className="w-full text-center py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-semibold transition-colors">Join Waitlist</Link>
            </div>

            {/* Growth (Highlighted) */}
            <div className="flex flex-col rounded-3xl border border-violet-500/50 bg-violet-900/10 p-8 backdrop-blur-sm relative overflow-hidden transform md:-translate-y-4 shadow-[0_0_40px_rgba(139,92,246,0.1)]">
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-violet-500 to-teal-400" />
              <div className="absolute top-4 right-4 bg-violet-500/20 text-violet-300 text-xs font-bold px-2 py-1 rounded-full border border-violet-500/30">POPULAR</div>
              
              <div className="mb-4">
                <h3 className="text-xl font-bold text-white mb-2">Growth</h3>
                <p className="text-sm text-zinc-400 h-10">For small agencies scaling up.</p>
              </div>
              <div className="mb-6">
                <span className="text-4xl font-extrabold text-white">$19</span>
                <span className="text-zinc-500">/mo</span>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                <li className="flex items-center gap-2 text-sm text-zinc-200"><CheckCircle2 className="w-4 h-4 text-violet-400" /> 5,000 Leads / month</li>
                <li className="flex items-center gap-2 text-sm text-zinc-200"><CheckCircle2 className="w-4 h-4 text-violet-400" /> 10 Email Accounts</li>
                <li className="flex items-center gap-2 text-sm text-zinc-200"><CheckCircle2 className="w-4 h-4 text-violet-400" /> Advanced AI Parsing</li>
                <li className="flex items-center gap-2 text-sm text-zinc-200"><CheckCircle2 className="w-4 h-4 text-violet-400" /> Automated Campaigns</li>
              </ul>
              <Link href="/waitlist" className="w-full text-center py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold transition-colors shadow-[0_0_20px_rgba(139,92,246,0.3)]">Join Waitlist</Link>
            </div>

            {/* Agency */}
            <div className="flex flex-col rounded-3xl border border-zinc-800 bg-zinc-900/30 p-8 backdrop-blur-sm relative overflow-hidden">
              <div className="mb-4">
                <h3 className="text-xl font-bold text-white mb-2">Agency</h3>
                <p className="text-sm text-zinc-400 h-10">Unlimited power for power users.</p>
              </div>
              <div className="mb-6">
                <span className="text-4xl font-extrabold text-white">$39</span>
                <span className="text-zinc-500">/mo</span>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                <li className="flex items-center gap-2 text-sm text-zinc-300"><CheckCircle2 className="w-4 h-4 text-violet-400" /> Unlimited Leads</li>
                <li className="flex items-center gap-2 text-sm text-zinc-300"><CheckCircle2 className="w-4 h-4 text-violet-400" /> Unlimited Senders</li>
                <li className="flex items-center gap-2 text-sm text-zinc-300"><CheckCircle2 className="w-4 h-4 text-violet-400" /> API Access</li>
                <li className="flex items-center gap-2 text-sm text-zinc-300"><CheckCircle2 className="w-4 h-4 text-violet-400" /> Priority Support</li>
              </ul>
              <Link href="/waitlist" className="w-full text-center py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-semibold transition-colors">Join Waitlist</Link>
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="container mx-auto px-6 py-24 border-t border-zinc-800/50 bg-zinc-900/10">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">Loved by early adopters</h2>
            <p className="text-lg text-zinc-400">Here's what our private beta testers are saying about the manual-first approach.</p>
          </div>

          <div className="grid gap-6 md:grid-cols-3 max-w-6xl mx-auto">
            {/* Review 1 */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
              <div className="flex gap-1 text-amber-400 mb-4">
                <Star className="w-4 h-4 fill-current" /><Star className="w-4 h-4 fill-current" /><Star className="w-4 h-4 fill-current" /><Star className="w-4 h-4 fill-current" /><Star className="w-4 h-4 fill-current" />
              </div>
              <p className="text-zinc-300 mb-6 text-sm leading-relaxed">"ReachMira totally changed how I do outreach. The AI Auto-Research tool saves me hours of Googling, but I still feel totally in control of what I send. My open rates went from 15% to over 60%."</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center"><User className="w-5 h-5 text-zinc-500" /></div>
                <div>
                  <h4 className="text-white font-medium text-sm">Sarah Jenkins</h4>
                  <p className="text-zinc-500 text-xs">Freelance Copywriter</p>
                </div>
              </div>
            </div>

            {/* Review 2 */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
              <div className="flex gap-1 text-amber-400 mb-4">
                <Star className="w-4 h-4 fill-current" /><Star className="w-4 h-4 fill-current" /><Star className="w-4 h-4 fill-current" /><Star className="w-4 h-4 fill-current" /><Star className="w-4 h-4 fill-current" />
              </div>
              <p className="text-zinc-300 mb-6 text-sm leading-relaxed">"We used to burn through domains every 3 months using automated blasters. Switching to a manual-first workflow with ReachMira means we actually land in the primary inbox now. Highly recommend."</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center"><Building2 className="w-5 h-5 text-zinc-500" /></div>
                <div>
                  <h4 className="text-white font-medium text-sm">Michael T.</h4>
                  <p className="text-zinc-500 text-xs">B2B Growth Agency</p>
                </div>
              </div>
            </div>

            {/* Review 3 */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
              <div className="flex gap-1 text-amber-400 mb-4">
                <Star className="w-4 h-4 fill-current" /><Star className="w-4 h-4 fill-current" /><Star className="w-4 h-4 fill-current" /><Star className="w-4 h-4 fill-current" /><Star className="w-4 h-4 fill-current" />
              </div>
              <p className="text-zinc-300 mb-6 text-sm leading-relaxed">"The UI is gorgeous and the follow-up tracker is exactly what I needed. It's like having a spreadsheet on steroids without the clunkiness of Salesforce or HubSpot."</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center"><Briefcase className="w-5 h-5 text-zinc-500" /></div>
                <div>
                  <h4 className="text-white font-medium text-sm">David Chen</h4>
                  <p className="text-zinc-500 text-xs">SaaS Founder</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="container mx-auto px-6 py-24 border-t border-zinc-800/50">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-12 text-center">Frequently Asked Questions</h2>
            <div className="space-y-4">
              {faqs.map((faq, idx) => (
                <div key={idx} className="border border-zinc-800 bg-zinc-900/30 rounded-2xl overflow-hidden transition-all duration-200">
                  <button 
                    onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                    className="w-full px-6 py-5 flex items-center justify-between text-left focus:outline-none"
                  >
                    <span className="text-lg font-medium text-white">{faq.question}</span>
                    <ChevronDown className={`w-5 h-5 text-zinc-500 transition-transform duration-200 ${openFaq === idx ? 'rotate-180' : ''}`} />
                  </button>
                  <div className={`px-6 overflow-hidden transition-all duration-300 ease-in-out ${openFaq === idx ? 'max-h-96 pb-5 opacity-100' : 'max-h-0 opacity-0'}`}>
                    <p className="text-zinc-400 leading-relaxed">{faq.answer}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="container mx-auto px-6 py-32 border-t border-zinc-800/50 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-violet-900/20 pointer-events-none" />
          <div className="relative z-10 max-w-3xl mx-auto text-center">
            <h2 className="text-4xl md:text-6xl font-extrabold text-white mb-6">Ready to personalize at scale?</h2>
            <p className="text-xl text-zinc-400 mb-10">Stop spamming. Start connecting. Join the waitlist today to lock in your early adopter pricing.</p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link
                href="/waitlist"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-8 py-4 text-lg font-bold text-black transition-all hover:bg-zinc-200 hover:scale-[1.02] active:scale-[0.98]"
              >
                Join the Waitlist Now
                <ArrowRight className="h-5 w-5" />
              </Link>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="container mx-auto px-6 py-12 border-t border-zinc-800/50 flex flex-col md:flex-row items-center justify-between text-zinc-500 text-sm">
          <div className="flex items-center gap-2 mb-4 md:mb-0">
            <Image src="/reachmira-logo.png" alt="Logo" width={20} height={20} className="w-5 h-5 opacity-50 grayscale" />
            <p>© {new Date().getFullYear()} ReachMira. All rights reserved.</p>
          </div>
          <div className="flex gap-6">
            <Link href="/login" className="hover:text-zinc-300 transition-colors">Login</Link>
            <Link href="/waitlist" className="hover:text-zinc-300 transition-colors">Waitlist</Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
