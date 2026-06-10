'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { 
  ArrowRight, Sparkles, Clock, Bot, Layers, 
  CheckCircle2, ChevronDown, ShieldCheck, Mail, 
  Zap, Star, User, Building2, Briefcase
} from 'lucide-react';

// Animation Variants
const fadeInUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15 }
  }
};

const bounceHover = {
  rest: { scale: 1 },
  hover: { scale: 1.05, transition: { type: "spring", stiffness: 400, damping: 10 } }
};

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
    <div className="min-h-screen bg-[#050505] text-zinc-100 selection:bg-fuchsia-500/30 overflow-x-hidden relative">
      
      {/* Animated Mesh Background (Stripe-style) */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <motion.div 
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 90, 0],
            opacity: [0.4, 0.6, 0.4]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute -top-1/4 -left-1/4 w-[150%] h-[150%] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-fuchsia-600/20 via-violet-900/10 to-transparent blur-[120px] rounded-full mix-blend-screen"
        />
        <motion.div 
          animate={{
            scale: [1, 1.5, 1],
            rotate: [0, -90, 0],
            opacity: [0.3, 0.5, 0.3]
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute top-1/4 right-0 w-[100%] h-[100%] bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-cyan-500/10 via-teal-900/10 to-transparent blur-[120px] rounded-full mix-blend-screen"
        />
      </div>

      <div className="relative z-10">
        {/* Navigation */}
        <nav className="container mx-auto px-6 py-6 flex items-center justify-between">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3"
          >
            {/* Logo only, no text */}
            <Image 
              src="/reachmira-logo.png" 
              alt="ReachMira Logo" 
              width={40} 
              height={40} 
              className="w-10 h-10 object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]"
            />
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-6"
          >
            <Link href="/login" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors hidden sm:block">
              Login
            </Link>
            <Link href="/waitlist" className="text-sm font-semibold bg-white/10 backdrop-blur-md border border-white/20 text-white px-5 py-2 rounded-full hover:bg-white hover:text-black hover:shadow-[0_0_30px_rgba(255,255,255,0.5)] transition-all duration-300">
              Join Waitlist
            </Link>
          </motion.div>
        </nav>

        {/* Hero Section */}
        <main className="container mx-auto px-6 pt-24 pb-32 flex flex-col items-center text-center relative">
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, type: "spring" }}
            className="inline-flex items-center gap-2 rounded-full border border-fuchsia-500/30 bg-fuchsia-500/10 px-4 py-1.5 text-xs font-bold text-fuchsia-300 mb-8 shadow-[0_0_30px_rgba(217,70,239,0.2)] backdrop-blur-md"
          >
            <Sparkles className="h-3 w-3" />
            <span>Private Beta Currently Full</span>
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.7 }}
            className="max-w-5xl text-6xl md:text-8xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-zinc-200 to-zinc-500 leading-[1.05] mb-8"
          >
            Outreach without the <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-500 via-violet-400 to-cyan-400 drop-shadow-sm">automation overwhelm.</span>
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="max-w-2xl text-lg md:text-xl text-zinc-400 mb-12 leading-relaxed"
          >
            A manual-first CRM built for B2B agencies that value deep personalization over volume. Scrape websites, manage pipelines, and track follow-ups—all in one gorgeous workspace.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="w-full max-w-sm relative group"
          >
            <div className="absolute -inset-1 bg-gradient-to-r from-fuchsia-600 via-violet-600 to-cyan-600 rounded-2xl blur-lg opacity-40 transition duration-1000 group-hover:opacity-70 animate-pulse"></div>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="relative p-1 rounded-2xl bg-zinc-900 border border-zinc-800 backdrop-blur-2xl shadow-2xl">
              <Link
                href="/waitlist"
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-zinc-100 to-zinc-300 px-8 py-5 text-lg font-black text-black transition-all shadow-[inset_0_-2px_10px_rgba(0,0,0,0.2)]"
              >
                Join the Waitlist
                <ArrowRight className="h-5 w-5" />
              </Link>
            </motion.div>
          </motion.div>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-6 text-sm text-zinc-500 font-semibold uppercase tracking-widest"
          >
            No credit card required
          </motion.p>
        </main>

        {/* Why Manual First? */}
        <motion.section 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="container mx-auto px-6 py-32"
        >
          <motion.div variants={fadeInUp} className="max-w-3xl mx-auto text-center mb-20">
            <h2 className="text-4xl md:text-6xl font-bold text-white mb-6 tracking-tight">Why "Manual-First"?</h2>
            <p className="text-xl text-zinc-400 leading-relaxed">
              The era of spray-and-pray cold email is dead. Automated blasts burn your domains, annoy prospects, and ruin your sender reputation. Quality beats quantity.
            </p>
          </motion.div>

          <div className="grid gap-8 md:grid-cols-3 max-w-6xl mx-auto">
            <motion.div variants={fadeInUp} whileHover="hover" initial="rest" className="bg-zinc-900/40 border border-zinc-800/80 rounded-[2rem] p-10 backdrop-blur-md relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <motion.div variants={bounceHover}>
                <ShieldCheck className="w-12 h-12 text-cyan-400 mb-8" />
                <h3 className="text-2xl font-bold text-white mb-4">Protect Domains</h3>
                <p className="text-zinc-400 text-base leading-relaxed">By reviewing and sending emails manually, you drastically lower bounce rates and avoid triggering spam filters, keeping your primary domains perfectly safe.</p>
              </motion.div>
            </motion.div>
            <motion.div variants={fadeInUp} whileHover="hover" initial="rest" className="bg-zinc-900/40 border border-zinc-800/80 rounded-[2rem] p-10 backdrop-blur-md relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <motion.div variants={bounceHover}>
                <Zap className="w-12 h-12 text-fuchsia-400 mb-8" />
                <h3 className="text-2xl font-bold text-white mb-4">Hyper-Personalization</h3>
                <p className="text-zinc-400 text-base leading-relaxed">Actually read about your prospect before you hit send. Use our AI to scrape their site, then craft a message that proves you aren't just another bot.</p>
              </motion.div>
            </motion.div>
            <motion.div variants={fadeInUp} whileHover="hover" initial="rest" className="bg-zinc-900/40 border border-zinc-800/80 rounded-[2rem] p-10 backdrop-blur-md relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <motion.div variants={bounceHover}>
                <Mail className="w-12 h-12 text-violet-400 mb-8" />
                <h3 className="text-2xl font-bold text-white mb-4">Higher Reply Rates</h3>
                <p className="text-zinc-400 text-base leading-relaxed">10 highly researched, perfectly timed emails will out-perform 1,000 generic spam blasts every single time. Book more meetings with less effort.</p>
              </motion.div>
            </motion.div>
          </div>
        </motion.section>

        {/* How it Works */}
        <motion.section 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="relative py-32"
        >
          {/* Subtle separator */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-px bg-gradient-to-r from-transparent via-zinc-800 to-transparent" />
          
          <div className="container mx-auto px-6">
            <motion.div variants={fadeInUp} className="max-w-3xl mx-auto text-center mb-24">
              <h2 className="text-4xl md:text-6xl font-bold text-white mb-6 tracking-tight">How it works</h2>
              <p className="text-xl text-zinc-400">A streamlined workflow designed to get you in, get you out, and get you replies.</p>
            </motion.div>

            <div className="max-w-5xl mx-auto space-y-20 relative">
              {/* Connecting line */}
              <div className="absolute left-8 md:left-1/2 top-10 bottom-10 w-0.5 bg-gradient-to-b from-fuchsia-500/20 via-violet-500/20 to-transparent hidden md:block" />

              {/* Step 1 */}
              <motion.div variants={fadeInUp} className="flex flex-col md:flex-row items-center gap-12 md:gap-24 relative z-10">
                <div className="md:w-1/2 flex justify-end text-left md:text-right">
                  <div>
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/30 mb-6 font-black text-xl shadow-[0_0_20px_rgba(139,92,246,0.3)]">1</div>
                    <h3 className="text-3xl font-bold text-white mb-4 tracking-tight">Import & Clean</h3>
                    <p className="text-zinc-400 text-lg">Upload your CSV or link a Google Sheet. ReachMira automatically detects risky and role-based emails so you don't waste time on bounces.</p>
                  </div>
                </div>
                <div className="md:w-1/2 w-full">
                  <motion.div whileHover={{ scale: 1.05, rotate: 2 }} className="aspect-video rounded-[2rem] bg-gradient-to-br from-zinc-800 to-zinc-900 border border-zinc-700 shadow-2xl overflow-hidden relative flex items-center justify-center group cursor-default">
                    <Layers className="w-20 h-20 text-zinc-600 transition-transform group-hover:scale-110" />
                    <div className="absolute inset-0 bg-gradient-to-tr from-violet-600/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  </motion.div>
                </div>
              </motion.div>

              {/* Step 2 */}
              <motion.div variants={fadeInUp} className="flex flex-col md:flex-row-reverse items-center gap-12 md:gap-24 relative z-10">
                <div className="md:w-1/2 text-left">
                  <div>
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/30 mb-6 font-black text-xl shadow-[0_0_20px_rgba(217,70,239,0.3)]">2</div>
                    <h3 className="text-3xl font-bold text-white mb-4 tracking-tight">Auto-Research AI</h3>
                    <p className="text-zinc-400 text-lg">Click a button and ReachMira's AI will scrape the lead's website, digest what they do, and instantly extract their top pain points and suggest an angle.</p>
                  </div>
                </div>
                <div className="md:w-1/2 w-full flex justify-end">
                  <motion.div whileHover={{ scale: 1.05, rotate: -2 }} className="aspect-video w-full rounded-[2rem] bg-gradient-to-bl from-zinc-800 to-zinc-900 border border-zinc-700 shadow-2xl overflow-hidden relative flex items-center justify-center group cursor-default">
                    <Bot className="w-20 h-20 text-zinc-600 transition-transform group-hover:scale-110" />
                    <div className="absolute inset-0 bg-gradient-to-bl from-fuchsia-600/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  </motion.div>
                </div>
              </motion.div>

              {/* Step 3 */}
              <motion.div variants={fadeInUp} className="flex flex-col md:flex-row items-center gap-12 md:gap-24 relative z-10">
                <div className="md:w-1/2 flex justify-end text-left md:text-right">
                  <div>
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 mb-6 font-black text-xl shadow-[0_0_20px_rgba(6,182,212,0.3)]">3</div>
                    <h3 className="text-3xl font-bold text-white mb-4 tracking-tight">Send & Track</h3>
                    <p className="text-zinc-400 text-lg">Review the AI's research, tweak your template, and send directly from your connected inbox. We'll track opens, clicks, and remind you when to follow up.</p>
                  </div>
                </div>
                <div className="md:w-1/2 w-full">
                  <motion.div whileHover={{ scale: 1.05, rotate: 2 }} className="aspect-video w-full rounded-[2rem] bg-gradient-to-tr from-zinc-800 to-zinc-900 border border-zinc-700 shadow-2xl overflow-hidden relative flex items-center justify-center group cursor-default">
                    <Clock className="w-20 h-20 text-zinc-600 transition-transform group-hover:scale-110" />
                    <div className="absolute inset-0 bg-gradient-to-t from-cyan-600/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  </motion.div>
                </div>
              </motion.div>
            </div>
          </div>
        </motion.section>

        {/* Pricing */}
        <motion.section 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="container mx-auto px-6 py-32"
        >
          <motion.div variants={fadeInUp} className="max-w-3xl mx-auto text-center mb-20">
            <h2 className="text-4xl md:text-6xl font-bold text-white mb-6 tracking-tight">Simple, Transparent Pricing</h2>
            <p className="text-xl text-zinc-400">Lock in early adopter pricing when you join the waitlist today. No hidden fees, no per-seat nonsense.</p>
          </motion.div>

          <div className="grid gap-6 md:grid-cols-4 max-w-7xl mx-auto">
            {/* Free Beta */}
            <motion.div variants={fadeInUp} whileHover={{ y: -10 }} className="flex flex-col rounded-[2rem] border border-zinc-800 bg-zinc-900/50 p-8 backdrop-blur-xl relative overflow-hidden transition-colors hover:border-zinc-700">
              <div className="mb-4">
                <h3 className="text-2xl font-bold text-white mb-2">Free Beta</h3>
                <p className="text-sm text-zinc-400 h-10">For our earliest testers.</p>
              </div>
              <div className="mb-8">
                <span className="text-5xl font-black text-white">$0</span>
                <span className="text-zinc-500 font-medium">/mo</span>
              </div>
              <ul className="space-y-4 mb-10 flex-1">
                <li className="flex items-start gap-3 text-sm text-zinc-300"><CheckCircle2 className="w-5 h-5 text-zinc-500 shrink-0" /> <span>100 Leads / month</span></li>
                <li className="flex items-start gap-3 text-sm text-zinc-300"><CheckCircle2 className="w-5 h-5 text-zinc-500 shrink-0" /> <span>1 Email Account</span></li>
                <li className="flex items-start gap-3 text-sm text-zinc-300"><CheckCircle2 className="w-5 h-5 text-zinc-500 shrink-0" /> <span>Basic AI Research</span></li>
              </ul>
              <Link href="/waitlist" className="w-full text-center py-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold transition-colors">Current Phase</Link>
            </motion.div>

            {/* Starter */}
            <motion.div variants={fadeInUp} whileHover={{ y: -10 }} className="flex flex-col rounded-[2rem] border border-zinc-800 bg-zinc-900/50 p-8 backdrop-blur-xl relative overflow-hidden transition-colors hover:border-zinc-700">
              <div className="mb-4">
                <h3 className="text-2xl font-bold text-white mb-2">Starter</h3>
                <p className="text-sm text-zinc-400 h-10">Perfect for freelancers.</p>
              </div>
              <div className="mb-8">
                <span className="text-5xl font-black text-white">$9</span>
                <span className="text-zinc-500 font-medium">/mo</span>
              </div>
              <ul className="space-y-4 mb-10 flex-1">
                <li className="flex items-start gap-3 text-sm text-zinc-300"><CheckCircle2 className="w-5 h-5 text-violet-400 shrink-0" /> <span>1,000 Leads / month</span></li>
                <li className="flex items-start gap-3 text-sm text-zinc-300"><CheckCircle2 className="w-5 h-5 text-violet-400 shrink-0" /> <span>3 Email Accounts</span></li>
                <li className="flex items-start gap-3 text-sm text-zinc-300"><CheckCircle2 className="w-5 h-5 text-violet-400 shrink-0" /> <span>Auto-Research API</span></li>
              </ul>
              <Link href="/waitlist" className="w-full text-center py-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold transition-colors">Join Waitlist</Link>
            </motion.div>

            {/* Growth (Highlighted) */}
            <motion.div variants={fadeInUp} whileHover={{ y: -10 }} className="flex flex-col rounded-[2rem] border border-fuchsia-500/50 bg-fuchsia-900/10 p-8 backdrop-blur-xl relative overflow-hidden transform md:-translate-y-4 shadow-[0_0_50px_rgba(217,70,239,0.15)]">
              <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-fuchsia-500 via-violet-500 to-cyan-400" />
              <div className="absolute top-6 right-6 bg-fuchsia-500/20 text-fuchsia-300 text-[10px] font-black px-3 py-1.5 rounded-full border border-fuchsia-500/30 uppercase tracking-widest">POPULAR</div>
              
              <div className="mb-4">
                <h3 className="text-2xl font-bold text-white mb-2">Growth</h3>
                <p className="text-sm text-zinc-400 h-10">For small agencies scaling up.</p>
              </div>
              <div className="mb-8">
                <span className="text-5xl font-black text-white">$19</span>
                <span className="text-zinc-500 font-medium">/mo</span>
              </div>
              <ul className="space-y-4 mb-10 flex-1">
                <li className="flex items-start gap-3 text-sm text-zinc-100"><CheckCircle2 className="w-5 h-5 text-fuchsia-400 shrink-0" /> <span className="font-medium">5,000 Leads / month</span></li>
                <li className="flex items-start gap-3 text-sm text-zinc-100"><CheckCircle2 className="w-5 h-5 text-fuchsia-400 shrink-0" /> <span className="font-medium">10 Email Accounts</span></li>
                <li className="flex items-start gap-3 text-sm text-zinc-100"><CheckCircle2 className="w-5 h-5 text-fuchsia-400 shrink-0" /> <span className="font-medium">Advanced AI Parsing</span></li>
                <li className="flex items-start gap-3 text-sm text-zinc-100"><CheckCircle2 className="w-5 h-5 text-fuchsia-400 shrink-0" /> <span className="font-medium">Automated Campaigns</span></li>
              </ul>
              <Link href="/waitlist" className="w-full text-center py-4 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 hover:from-fuchsia-500 hover:to-violet-500 text-white font-black transition-colors shadow-[0_0_20px_rgba(217,70,239,0.4)]">Join Waitlist</Link>
            </motion.div>

            {/* Agency */}
            <motion.div variants={fadeInUp} whileHover={{ y: -10 }} className="flex flex-col rounded-[2rem] border border-zinc-800 bg-zinc-900/50 p-8 backdrop-blur-xl relative overflow-hidden transition-colors hover:border-zinc-700">
              <div className="mb-4">
                <h3 className="text-2xl font-bold text-white mb-2">Agency</h3>
                <p className="text-sm text-zinc-400 h-10">Unlimited power for power users.</p>
              </div>
              <div className="mb-8">
                <span className="text-5xl font-black text-white">$39</span>
                <span className="text-zinc-500 font-medium">/mo</span>
              </div>
              <ul className="space-y-4 mb-10 flex-1">
                <li className="flex items-start gap-3 text-sm text-zinc-300"><CheckCircle2 className="w-5 h-5 text-cyan-400 shrink-0" /> <span>Unlimited Leads</span></li>
                <li className="flex items-start gap-3 text-sm text-zinc-300"><CheckCircle2 className="w-5 h-5 text-cyan-400 shrink-0" /> <span>Unlimited Senders</span></li>
                <li className="flex items-start gap-3 text-sm text-zinc-300"><CheckCircle2 className="w-5 h-5 text-cyan-400 shrink-0" /> <span>API Access</span></li>
                <li className="flex items-start gap-3 text-sm text-zinc-300"><CheckCircle2 className="w-5 h-5 text-cyan-400 shrink-0" /> <span>Priority Support</span></li>
              </ul>
              <Link href="/waitlist" className="w-full text-center py-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold transition-colors">Join Waitlist</Link>
            </motion.div>
          </div>
        </motion.section>

        {/* Testimonials */}
        <motion.section 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="relative py-32"
        >
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-px bg-gradient-to-r from-transparent via-zinc-800 to-transparent" />
          <div className="container mx-auto px-6">
            <motion.div variants={fadeInUp} className="max-w-3xl mx-auto text-center mb-20">
              <h2 className="text-4xl md:text-6xl font-bold text-white mb-6 tracking-tight">Loved by early adopters</h2>
              <p className="text-xl text-zinc-400">Here's what our private beta testers are saying about the manual-first approach.</p>
            </motion.div>

            <div className="grid gap-8 md:grid-cols-3 max-w-6xl mx-auto">
              {/* Review 1 */}
              <motion.div variants={fadeInUp} whileHover={{ y: -5, scale: 1.02 }} className="bg-gradient-to-b from-zinc-800/50 to-zinc-900/50 border border-zinc-700/50 rounded-[2rem] p-8 shadow-xl backdrop-blur-md">
                <div className="flex gap-1 text-fuchsia-400 mb-6">
                  <Star className="w-4 h-4 fill-current" /><Star className="w-4 h-4 fill-current" /><Star className="w-4 h-4 fill-current" /><Star className="w-4 h-4 fill-current" /><Star className="w-4 h-4 fill-current" />
                </div>
                <p className="text-zinc-300 mb-8 text-base leading-relaxed font-medium">"ReachMira totally changed how I do outreach. The AI Auto-Research tool saves me hours of Googling, but I still feel totally in control of what I send. My open rates went from 15% to over 60%."</p>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700"><User className="w-6 h-6 text-zinc-400" /></div>
                  <div>
                    <h4 className="text-white font-bold text-base">Sarah Jenkins</h4>
                    <p className="text-zinc-500 text-sm font-medium">Freelance Copywriter</p>
                  </div>
                </div>
              </motion.div>

              {/* Review 2 */}
              <motion.div variants={fadeInUp} whileHover={{ y: -5, scale: 1.02 }} className="bg-gradient-to-b from-zinc-800/50 to-zinc-900/50 border border-zinc-700/50 rounded-[2rem] p-8 shadow-xl backdrop-blur-md">
                <div className="flex gap-1 text-fuchsia-400 mb-6">
                  <Star className="w-4 h-4 fill-current" /><Star className="w-4 h-4 fill-current" /><Star className="w-4 h-4 fill-current" /><Star className="w-4 h-4 fill-current" /><Star className="w-4 h-4 fill-current" />
                </div>
                <p className="text-zinc-300 mb-8 text-base leading-relaxed font-medium">"We used to burn through domains every 3 months using automated blasters. Switching to a manual-first workflow with ReachMira means we actually land in the primary inbox now. Highly recommend."</p>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700"><Building2 className="w-6 h-6 text-zinc-400" /></div>
                  <div>
                    <h4 className="text-white font-bold text-base">Michael T.</h4>
                    <p className="text-zinc-500 text-sm font-medium">B2B Growth Agency</p>
                  </div>
                </div>
              </motion.div>

              {/* Review 3 */}
              <motion.div variants={fadeInUp} whileHover={{ y: -5, scale: 1.02 }} className="bg-gradient-to-b from-zinc-800/50 to-zinc-900/50 border border-zinc-700/50 rounded-[2rem] p-8 shadow-xl backdrop-blur-md">
                <div className="flex gap-1 text-fuchsia-400 mb-6">
                  <Star className="w-4 h-4 fill-current" /><Star className="w-4 h-4 fill-current" /><Star className="w-4 h-4 fill-current" /><Star className="w-4 h-4 fill-current" /><Star className="w-4 h-4 fill-current" />
                </div>
                <p className="text-zinc-300 mb-8 text-base leading-relaxed font-medium">"The UI is gorgeous and the follow-up tracker is exactly what I needed. It's like having a spreadsheet on steroids without the clunkiness of Salesforce or HubSpot."</p>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700"><Briefcase className="w-6 h-6 text-zinc-400" /></div>
                  <div>
                    <h4 className="text-white font-bold text-base">David Chen</h4>
                    <p className="text-zinc-500 text-sm font-medium">SaaS Founder</p>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </motion.section>

        {/* FAQ Section */}
        <motion.section 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="relative py-32"
        >
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-px bg-gradient-to-r from-transparent via-zinc-800 to-transparent" />
          <div className="container mx-auto px-6 max-w-3xl">
            <motion.h2 variants={fadeInUp} className="text-4xl md:text-6xl font-bold text-white mb-16 text-center tracking-tight">Frequently Asked Questions</motion.h2>
            <motion.div variants={fadeInUp} className="space-y-4">
              {faqs.map((faq, idx) => (
                <div key={idx} className="border border-zinc-800 bg-zinc-900/50 backdrop-blur-md rounded-2xl overflow-hidden transition-all duration-300 hover:border-zinc-700 hover:bg-zinc-800/50">
                  <button 
                    onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                    className="w-full px-8 py-6 flex items-center justify-between text-left focus:outline-none"
                  >
                    <span className="text-xl font-bold text-white">{faq.question}</span>
                    <ChevronDown className={`w-6 h-6 text-zinc-400 transition-transform duration-300 ${openFaq === idx ? 'rotate-180 text-white' : ''}`} />
                  </button>
                  <div className={`px-8 overflow-hidden transition-all duration-500 ease-in-out ${openFaq === idx ? 'max-h-96 pb-6 opacity-100' : 'max-h-0 opacity-0'}`}>
                    <p className="text-zinc-400 text-lg leading-relaxed">{faq.answer}</p>
                  </div>
                </div>
              ))}
            </motion.div>
          </div>
        </motion.section>

        {/* Final CTA */}
        <motion.section 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerContainer}
          className="relative py-40 overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-fuchsia-900/10 to-violet-900/20 pointer-events-none" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-zinc-800 to-transparent" />
          <div className="relative z-10 max-w-4xl mx-auto text-center px-6">
            <motion.h2 variants={fadeInUp} className="text-5xl md:text-7xl font-black text-white mb-8 tracking-tighter">Ready to personalize at scale?</motion.h2>
            <motion.p variants={fadeInUp} className="text-2xl text-zinc-400 mb-12 font-medium">Stop spamming. Start connecting. Join the waitlist today to lock in your early adopter pricing.</motion.p>
            <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row justify-center gap-6">
              <Link
                href="/waitlist"
                className="inline-flex items-center justify-center gap-3 rounded-2xl bg-white px-10 py-5 text-xl font-black text-black transition-all hover:bg-zinc-200 hover:scale-[1.03] active:scale-[0.97] shadow-[0_0_40px_rgba(255,255,255,0.2)]"
              >
                Join the Waitlist Now
                <ArrowRight className="h-6 w-6" />
              </Link>
            </motion.div>
          </div>
        </motion.section>

        {/* Footer */}
        <footer className="container mx-auto px-6 py-12 border-t border-zinc-900 flex flex-col md:flex-row items-center justify-between text-zinc-500 text-sm relative z-10">
          <div className="flex items-center gap-3 mb-4 md:mb-0">
            <Image src="/reachmira-logo.png" alt="Logo" width={24} height={24} className="w-6 h-6 opacity-40 grayscale" />
            <p className="font-medium">© {new Date().getFullYear()} ReachMira. All rights reserved.</p>
          </div>
          <div className="flex gap-8 font-medium">
            <Link href="/login" className="hover:text-zinc-300 transition-colors">Login</Link>
            <Link href="/waitlist" className="hover:text-zinc-300 transition-colors">Waitlist</Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
