'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import {
  Menu,
  X,
  ArrowRight,
  Play,
  ChevronDown,
  FileText,
  Database,
  Users,
  ShieldCheck,
  Sparkles,
  Search,
  Bell,
  Settings,
  LayoutDashboard,
  FolderOpen,
  TriangleAlert,
  FileBarChart,
  ClipboardList,
  Activity,
  CheckCircle2,
  XCircle,
  Lock,
  Star,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

const TESTIMONIALS = [
  {
    id: 1,
    quote: "AuditOS reduced our reporting time by 60% while improving evidence quality and team collaboration. It's transformed how we work.",
    name: "Sarah Johnson",
    role: "Audit Director, Deloitte",
    avatar: "/avatar-sarah.png"
  },
  {
    id: 2,
    quote: "The AI Intelligence layer caught anomalies our team would have spent weeks trying to find manually. Unbelievably accurate.",
    name: "Michael Chen",
    role: "Partner, KPMG",
    avatar: "/avatar-michael.png"
  },
  {
    id: 3,
    quote: "We've fully modernized our assurance practice. The integration with our ERP systems was completely seamless.",
    name: "Elena Rodriguez",
    role: "Managing Director, PwC",
    avatar: "/avatar-elena.png"
  }
];

function TestimonialCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % TESTIMONIALS.length);
    }, 8000);
    return () => clearInterval(timer);
  }, []);

  const next = () => setCurrentIndex((prev) => (prev + 1) % TESTIMONIALS.length);
  const prev = () => setCurrentIndex((prev) => (prev - 1 + TESTIMONIALS.length) % TESTIMONIALS.length);

  const current = TESTIMONIALS[currentIndex];

  return (
    <div className="rounded-[40px] border border-slate-200 bg-white p-8 md:p-16 shadow-[0_10px_30px_rgba(37,99,235,0.06)] flex flex-col items-center text-center">
      <p className="mb-6 text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">
        Trusted By Audit Leaders
      </p>

      <div className="mb-10 text-blue-600">
        <Star className="h-10 w-10 fill-current" />
      </div>

      <div className="relative w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center"
          >
            <blockquote className="mb-12 text-2xl md:text-3xl leading-relaxed md:leading-relaxed text-slate-700 max-w-2xl min-h-[120px] flex items-center">
              <span>"{current.quote}"</span>
            </blockquote>

            <div className="flex flex-col items-center gap-4">
              <div className="relative h-20 w-20 rounded-full overflow-hidden border-2 border-slate-100 shadow-sm">
                <Image src={current.avatar} alt={current.name} fill className="object-cover" />
              </div>

              <div>
                <p className="font-bold text-lg">{current.name}</p>
                <p className="text-slate-500">{current.role}</p>
              </div>
            </div>

            <div className="flex gap-4 mt-10">
              <button onClick={prev} className="rounded-full border border-slate-200 p-4 hover:bg-slate-50 hover:border-blue-200 hover:text-blue-600 transition">
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button onClick={next} className="rounded-full border border-slate-200 p-4 hover:bg-slate-50 hover:border-blue-200 hover:text-blue-600 transition">
                <ChevronRight className="h-6 w-6" />
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function Home() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const fadeUp = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
      },
    },
  }

  return (
    <main className="min-h-screen bg-white text-slate-900">
      {/* NAVBAR */}
      <header className="sticky top-0 z-50 border-b border-slate-200/60 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-[1440px] items-center justify-between px-4 lg:px-8">
          <div className="flex items-center">
            <div className="flex h-14 w-14 items-center justify-center">
              <Image src="/logo.png" alt="AuditOS Logo" width={56} height={56} className="w-full h-full object-contain scale-[1.7]" />
            </div>

            <span className="text-3xl font-bold -ml-1">
              Audit<span className="text-blue-600">OS</span>
            </span>
          </div>

          <nav className="hidden items-center gap-10 lg:flex">
            {[
              'Platform',
              'Solutions',
              'AI Engine',
              'Resources',
              'Pricing',
            ].map((item) => (
              <button
                key={item}
                className="group flex items-center gap-1 text-sm font-medium text-slate-700"
              >
                {item}

                {item !== 'Pricing' && (
                  <ChevronDown className="h-4 w-4" />
                )}

                <span className="absolute mt-8 h-0.5 w-0 bg-blue-600 transition-all duration-300 group-hover:w-12" />
              </button>
            ))}
          </nav>

          <div className="hidden lg:flex items-center gap-4">
            <Link href="/login" className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-medium hover:bg-slate-50 transition">
              Log in
            </Link>

            <Link href="/register" className="rounded-2xl bg-blue-600 px-6 py-3 text-sm font-medium text-white transition hover:bg-blue-700">
              Book a Demo
            </Link>
          </div>
          
          <button 
            className="lg:hidden p-2 text-slate-600"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Menu Dropdown */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="lg:hidden border-t border-slate-200 bg-white px-4 py-4 overflow-hidden"
            >
              <div className="flex flex-col space-y-4">
                {['Platform', 'Solutions', 'AI Engine', 'Resources', 'Pricing'].map((item) => (
                  <Link key={item} href="#" className="text-slate-700 font-medium py-2">
                    {item}
                  </Link>
                ))}
                <div className="h-px bg-slate-100 my-2" />
                <Link href="/login" className="text-center w-full rounded-2xl border border-slate-200 px-5 py-3 text-sm font-medium hover:bg-slate-50 transition">
                  Log in
                </Link>
                <Link href="/register" className="text-center w-full rounded-2xl bg-blue-600 px-6 py-3 text-sm font-medium text-white transition hover:bg-blue-700">
                  Book a Demo
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* HERO */}
      <section className="overflow-hidden">
        <div className="mx-auto grid max-w-[1440px] gap-12 lg:gap-20 px-4 lg:px-8 py-12 lg:py-20 lg:grid-cols-2">
          {/* LEFT */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="flex flex-col justify-center"
          >
            <div className="mb-8 inline-flex w-fit items-center rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-600">
              ✦ AI-Powered Auditing Platform
            </div>

            <h1 className="mb-8 text-4xl md:text-5xl font-bold leading-tight xl:text-7xl">
              Audit Smarter.
              <br />
              Deliver Faster.
              <br />
              <span className="bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">
                Powered by AI.
              </span>
            </h1>

            <p className="mb-10 max-w-xl text-lg md:text-xl leading-9 text-slate-600">
              AuditOS transforms fragmented audit workflows into one
              intelligent platform that automates evidence collection,
              detects risks, and empowers auditors with AI-driven insights.
            </p>

            <div className="mb-10 flex flex-wrap gap-4 lg:gap-5">
              <Link href="/register" className="flex items-center gap-2 rounded-2xl bg-blue-600 px-8 py-5 font-semibold text-white shadow-lg transition hover:-translate-y-1">
                Start Free Trial
                <ArrowRight className="h-5 w-5" />
              </Link>

              <Link href="/register" className="rounded-2xl border border-slate-200 px-8 py-5 font-semibold hover:bg-slate-50 transition">
                Book a Demo
              </Link>
            </div>

            <button className="flex items-center gap-3 text-blue-600">
              <Play className="h-5 w-5 fill-current" />
              Watch Product Tour
            </button>
          </motion.div>

          {/* RIGHT - CREATIVE ANIMATED UI */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="relative min-h-[650px] flex items-center justify-center lg:justify-end perspective-1000"
          >
            <div className="relative w-full max-w-lg aspect-square transform-gpu preserve-3d">
              {/* Background Pulsing Grid */}
              <div className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.05)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_10%,transparent_100%)] animate-[pulse_4s_ease-in-out_infinite]" />
              
              {/* Radar Sweep Effect */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,transparent_0%,transparent_70%,rgba(59,130,246,0.4)_100%)] blur-md z-0"
              />

              {/* Data Particles Firing Outward */}
              {[...Array(8)].map((_, i) => {
                const angle = (i * 45 * Math.PI) / 180;
                return (
                  <motion.div
                    key={`particle-${i}`}
                    initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
                    animate={{ 
                      opacity: [0, 1, 0], 
                      scale: [0.5, 1.2, 0],
                      x: Math.cos(angle) * 220,
                      y: Math.sin(angle) * 220
                    }}
                    transition={{ 
                      duration: 2.5, 
                      repeat: Infinity, 
                      delay: i * 0.3,
                      ease: "easeOut" 
                    }}
                    className="absolute top-1/2 left-1/2 w-2 h-2 -ml-1 -mt-1 bg-cyan-400 rounded-full shadow-[0_0_15px_rgba(34,211,238,1)] z-10"
                  />
                )
              })}
              
              {/* Central Glowing Orb */}
              <motion.div
                animate={{ 
                  y: [0, -15, 0],
                  rotateZ: [0, 5, -5, 0],
                  boxShadow: [
                    "0 0 60px rgba(37,99,235,0.3)",
                    "0 0 100px rgba(37,99,235,0.6)",
                    "0 0 60px rgba(37,99,235,0.3)"
                  ]
                }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 rounded-[2rem] bg-gradient-to-br from-blue-600 to-indigo-800"
              >
                <div className="relative flex h-36 w-36 flex-col items-center justify-center rounded-[2rem] text-white border border-white/30 backdrop-blur-2xl overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-t from-blue-400/20 to-transparent mix-blend-overlay" />
                  <motion.div 
                    animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute inset-0 rounded-[2rem] border-2 border-white/50" 
                  />
                  <Sparkles className="h-12 w-12 mb-3 text-cyan-200" />
                  <span className="text-xs font-bold tracking-[0.2em] text-cyan-50">CORE AI</span>
                </div>
              </motion.div>

              {/* Connecting Orbit Rings */}
              <div className="absolute inset-0 rounded-full border-2 border-slate-200/40 border-dashed animate-[spin_40s_linear_infinite] z-0" />
              <div className="absolute inset-[15%] rounded-full border border-blue-200/60 border-dashed animate-[spin_25s_linear_infinite_reverse] z-0" />
              <div className="absolute inset-[30%] rounded-full border border-indigo-200/40 border-dotted animate-[spin_15s_linear_infinite] z-0" />
              
              {/* Floating Glassmorphism Cards */}
              {[
                { top: '5%', left: '-10%', icon: FileText, title: 'Parsing Invoices', color: 'text-indigo-600', delay: 0, floatDelay: 0 },
                { top: '0%', right: '-5%', icon: Database, title: 'Syncing ERP', color: 'text-blue-600', delay: 0.2, floatDelay: 1 },
                { bottom: '25%', left: '-15%', icon: TriangleAlert, title: 'Risk Detected', color: 'text-rose-600', delay: 0.4, floatDelay: 0.5 },
                { bottom: '15%', right: '0%', icon: CheckCircle2, title: 'Evidence Valid', color: 'text-emerald-600', delay: 0.6, floatDelay: 1.5 },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0, rotate: -15, y: 40 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0, y: 0 }}
                  transition={{ 
                    type: "spring",
                    stiffness: 100,
                    damping: 12,
                    delay: 0.8 + item.delay 
                  }}
                  style={{ top: item.top, left: item.left, right: item.right, bottom: item.bottom, position: 'absolute' }}
                  className="z-30"
                >
                  <motion.div
                    animate={{ y: [0, -12, 0], rotate: [0, 2, -2, 0] }}
                    transition={{ duration: 4 + i, repeat: Infinity, ease: "easeInOut", delay: item.floatDelay }}
                    whileHover={{ scale: 1.05, zIndex: 50 }}
                    className="flex items-center gap-4 rounded-2xl border border-white/90 bg-white/80 p-4 backdrop-blur-xl shadow-[0_15px_35px_rgba(0,0,0,0.08)] cursor-pointer"
                  >
                    <div className={`rounded-xl bg-slate-50 p-3 shadow-inner border border-slate-100 ${item.color}`}>
                      <item.icon className="h-5 w-5" />
                    </div>
                    <div className="font-bold text-slate-800 pr-3">{item.title}</div>
                  </motion.div>
                </motion.div>
              ))}

              {/* Live Data Stream Tracker */}
              <motion.div
                initial={{ opacity: 0, y: 50, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 1.8, type: "spring", stiffness: 100 }}
                className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-full max-w-sm z-40"
              >
                <div className="rounded-[24px] border border-white/90 bg-white/90 p-6 backdrop-blur-3xl shadow-[0_30px_60px_rgba(37,99,235,0.15)] overflow-hidden">
                  {/* Subtle moving shine effect */}
                  <motion.div 
                    animate={{ x: ["-100%", "200%"] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-white/50 to-transparent skew-x-12 z-0"
                  />
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-5">
                      <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Live AI Stream</span>
                      <span className="flex h-3 w-3 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_15px_rgba(34,211,238,1)]" />
                    </div>
                    <div className="space-y-4">
                      <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden shadow-inner">
                        <div className="h-full w-[85%] bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-400 rounded-full relative">
                          <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.2)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0.2)_75%,transparent_75%,transparent)] bg-[length:20px_20px] animate-[progress_1s_linear_infinite]" />
                        </div>
                      </div>
                      <div className="flex justify-between text-sm font-bold">
                        <span className="text-slate-600 flex items-center gap-2">
                          <motion.span animate={{ opacity: [1, 0.5, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>
                            Analyzing Ledgers
                          </motion.span>
                        </span>
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-500">85%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>
      {/* TRUSTED BY */}
      <section className="border-y border-slate-100 py-14 overflow-hidden relative">
        <div className="mx-auto max-w-[1440px] px-4 lg:px-8 mb-10">
          <p className="text-center text-sm font-medium text-slate-500">
            Trusted by teams modernizing assurance operations
          </p>
        </div>

        <div className="relative flex overflow-hidden w-full group">
          <motion.div 
            animate={{ x: ["0%", "-50%"] }}
            transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
            className="flex flex-nowrap items-center w-max gap-24 pr-24 opacity-60 group-hover:opacity-100 transition-opacity"
          >
            {[
              'Deloitte',
              'PwC',
              'EY',
              'KPMG',
              'BDO',
              'Grant Thornton',
              'Protiviti',
              'Deloitte',
              'PwC',
              'EY',
              'KPMG',
              'BDO',
              'Grant Thornton',
              'Protiviti',
              'Deloitte',
              'PwC',
              'EY',
              'KPMG',
              'BDO',
              'Grant Thornton',
              'Protiviti',
              'Deloitte',
              'PwC',
              'EY',
              'KPMG',
              'BDO',
              'Grant Thornton',
              'Protiviti',
            ].map((company, i) => (
              <div
                key={i}
                className="text-3xl font-bold text-slate-500 whitespace-nowrap"
              >
                {company}
              </div>
            ))}
          </motion.div>
          
          <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-[#f8fafc] to-transparent z-10 pointer-events-none" />
          <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-[#f8fafc] to-transparent z-10 pointer-events-none" />
        </div>
      </section>

      {/* BEFORE VS AFTER */}
      <section className="py-24 overflow-hidden">
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={fadeUp}
          className="mx-auto max-w-[1440px] px-4 lg:px-8"
        >
          <div className="grid rounded-[40px] border border-slate-200 bg-white p-6 md:p-12 shadow-[0_10px_30px_rgba(37,99,235,0.06)] grid-cols-1 gap-12 lg:gap-0 lg:grid-cols-[1fr_auto_1fr_350px]">
            {/* BEFORE */}
            <div>
              <h3 className="mb-10 text-4xl font-bold">
                Before AuditOS
              </h3>

              <div className="space-y-6">
                {[
                  'Manual evidence gathering',
                  'Disconnected spreadsheets',
                  'Repetitive documentation',
                  'Delayed reporting',
                  'Missed anomalies',
                ].map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-4"
                  >
                    <XCircle className="h-6 w-6 text-red-500" />

                    <span className="text-lg text-slate-600">
                      {item}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* ARROW */}
            <div className="hidden items-center px-10 lg:flex">
              <div className="flex h-20 w-20 items-center justify-center rounded-full border border-slate-200">
                <ArrowRight className="h-8 w-8 text-blue-600" />
              </div>
            </div>

            {/* AFTER */}
            <div>
              <h3 className="mb-10 text-4xl font-bold text-blue-600">
                With AuditOS
              </h3>

              <div className="space-y-6">
                {[
                  'AI-assisted planning',
                  'Centralized workflows',
                  'Automated documentation',
                  'Real-time collaboration',
                  'Predictive risk insights',
                ].map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-4"
                  >
                    <CheckCircle2 className="h-6 w-6 text-blue-600" />

                    <span className="text-lg text-slate-600">
                      {item}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* FLOATING CARDS */}
            <div className="mt-12 space-y-6 lg:mt-0">
              <div className="rounded-[32px] border border-slate-100 bg-white p-8 shadow-[0_10px_30px_rgba(37,99,235,0.08)]">
                <div className="mb-6 flex items-center justify-between">
                  <span className="text-xl font-bold">
                    AI Recommendation
                  </span>

                  <Sparkles className="h-6 w-6 text-blue-600" />
                </div>

                <p className="mb-6 text-slate-600">
                  We found 3 high-risk areas that need your attention.
                </p>

                <button className="font-semibold text-blue-600">
                  View Insights →
                </button>
              </div>

              <div className="rounded-[32px] border border-slate-100 bg-white p-8 shadow-[0_10px_30px_rgba(37,99,235,0.08)]">
                <div className="mb-4 text-lg font-bold">
                  Risk Heat Map
                </div>

                <div className="grid grid-cols-6 gap-2">
                  {[
                    'bg-slate-100',
                    'bg-slate-100',
                    'bg-red-100',
                    'bg-red-200',
                    'bg-red-300',
                    'bg-red-400',
                    'bg-slate-100',
                    'bg-red-100',
                    'bg-red-200',
                    'bg-red-300',
                    'bg-red-400',
                    'bg-red-500',
                    'bg-red-100',
                    'bg-red-200',
                    'bg-red-300',
                    'bg-red-400',
                    'bg-red-500',
                    'bg-red-500',
                    'bg-slate-100',
                    'bg-red-100',
                    'bg-red-200',
                    'bg-red-300',
                    'bg-red-400',
                    'bg-red-500',
                  ].map((color, index) => (
                    <div
                      key={index}
                      className={`aspect-square rounded-lg ${color}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* AI FEATURES */}
      <section className="pb-24 overflow-hidden">
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={fadeUp}
          className="mx-auto max-w-[1440px] px-4 lg:px-8"
        >
          <div className="mb-16 text-center">
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">
              AI That Works For Auditors
            </p>

            <h2 className="text-4xl md:text-5xl font-bold">
              Meet AuditOS{' '}
              <span className="text-blue-600">
                Intelligence™
              </span>
            </h2>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: TriangleAlert,
                title: 'AI Risk Detection',
                desc:
                  'Detect unusual patterns before they become findings.',
              },
              {
                icon: ClipboardList,
                title: 'Evidence Assistant',
                desc:
                  'Collect, categorize, and validate supporting evidence automatically.',
              },
              {
                icon: FileBarChart,
                title: 'Report Generator',
                desc:
                  'Transform audit observations into professional reports instantly.',
              },
              {
                icon: Sparkles,
                title: 'Smart Recommendations',
                desc:
                  'Receive contextual suggestions based on industry standards.',
              },
              {
                icon: ShieldCheck,
                title: 'Compliance Copilot',
                desc:
                  'Navigate frameworks confidently with AI guidance.',
              },
              {
                icon: Activity,
                title: 'Continuous Monitoring',
                desc:
                  'Stay ahead with always-on audit intelligence.',
              },
            ].map((feature) => (
              <motion.div
                whileHover={{
                  y: -8,
                }}
                key={feature.title}
                className="rounded-[32px] border border-slate-100 bg-white p-8 shadow-[0_10px_30px_rgba(37,99,235,0.06)] transition"
              >
                <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-50 text-blue-600">
                  <feature.icon className="h-8 w-8" />
                </div>

                <h3 className="mb-4 text-2xl font-bold">
                  {feature.title}
                </h3>

                <p className="leading-8 text-slate-600">
                  {feature.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>
           {/* DASHBOARD SHOWCASE */}
      <section className="pb-24 overflow-hidden">
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={fadeUp}
          className="mx-auto max-w-[1440px] px-4 lg:px-8"
        >
          <div className="grid gap-12 rounded-[40px] border border-slate-200 bg-slate-50 p-6 md:p-12 grid-cols-1 lg:grid-cols-[400px_1fr]">
            {/* LEFT */}
            <div>
              <p className="mb-4 text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">
                All-In-One Audit Platform
              </p>

              <h2 className="mb-8 text-4xl md:text-5xl font-bold leading-tight">
                Everything you need.
                <br />
                One intelligent platform.
              </h2>

              <p className="mb-10 text-lg leading-8 text-slate-600">
                Plan, execute, and report audits with complete
                visibility and AI-powered assistance.
              </p>

              <div className="mb-10 space-y-5">
                {[
                  'Real-time audit health tracking',
                  'AI-powered risk heat maps',
                  'Smart evidence management',
                  'Collaborative team workspace',
                ].map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-4"
                  >
                    <CheckCircle2 className="h-6 w-6 text-blue-600" />

                    <span className="text-slate-700">
                      {item}
                    </span>
                  </div>
                ))}
              </div>

              <button className="flex items-center gap-3 rounded-2xl border border-blue-200 px-6 py-4 font-semibold text-blue-600">
                Explore Platform
                <ArrowRight className="h-5 w-5" />
              </button>
            </div>

            {/* DASHBOARD */}
            <div className="overflow-x-auto rounded-[40px] border border-slate-200 bg-white shadow-[0_10px_30px_rgba(37,99,235,0.06)]">
              <div className="min-w-[800px]">
              {/* HEADER */}
              <div className="flex items-center justify-between border-b border-slate-100 px-8 py-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 flex items-center justify-center">
                    <Image src="/logo.png" alt="AuditOS Logo" width={48} height={48} className="w-full h-full object-contain scale-[1.7]" />
                  </div>

                  <span className="text-2xl font-bold -ml-1">
                    Audit<span className="text-blue-600">OS</span>
                  </span>
                </div>

                <div className="hidden items-center gap-4 rounded-2xl border border-slate-200 px-5 py-3 md:flex">
                  <Search className="h-5 w-5 text-slate-400" />

                  <span className="text-slate-400">
                    Search anything...
                  </span>
                </div>

                <div className="flex items-center gap-5">
                  <Bell className="h-5 w-5 text-slate-500" />

                  <Settings className="h-5 w-5 text-slate-500" />

                  <div className="h-10 w-10 rounded-full bg-slate-300" />
                </div>
              </div>

              <div className="grid lg:grid-cols-[220px_1fr]">
                {/* SIDEBAR */}
                <div className="border-r border-slate-100 p-8">
                  <div className="space-y-2">
                    {[
                      {
                        icon: LayoutDashboard,
                        label: 'Dashboard',
                      },
                      {
                        icon: FolderOpen,
                        label: 'Engagements',
                      },
                      {
                        icon: ClipboardList,
                        label: 'Workpapers',
                      },
                      {
                        icon: FileText,
                        label: 'Evidence',
                      },
                      {
                        icon: TriangleAlert,
                        label: 'Risks',
                      },
                      {
                        icon: FileBarChart,
                        label: 'Reports',
                      },
                      {
                        icon: Activity,
                        label: 'Analytics',
                      },
                      {
                        icon: Settings,
                        label: 'Settings',
                      },
                    ].map((item, index) => (
                      <button
                        key={item.label}
                        className={`flex w-full items-center gap-4 rounded-2xl px-4 py-4 text-left ${
                          index === 0
                            ? 'bg-blue-50 text-blue-600'
                            : 'text-slate-600'
                        }`}
                      >
                        <item.icon className="h-5 w-5" />

                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* CONTENT */}
                <div className="p-8">
                  <h3 className="mb-8 text-3xl font-bold">
                    Dashboard
                  </h3>

                  {/* METRICS */}
                  <div className="mb-8 grid gap-6 xl:grid-cols-4">
                    {[
                      {
                        title: 'Audit Health Score',
                        value: '87',
                        sub: '+12% vs last month',
                      },
                      {
                        title: 'Active Engagements',
                        value: '24',
                        sub: '+3 this week',
                      },
                      {
                        title: 'High Risks',
                        value: '7',
                        sub: '-2 vs last week',
                      },
                      {
                        title: 'Evidence Status',
                        value: '92%',
                        sub: '+8% verified',
                      },
                    ].map((card) => (
                      <div
                        key={card.title}
                        className="rounded-[32px] border border-slate-100 p-6"
                      >
                        <p className="mb-3 text-sm text-slate-500">
                          {card.title}
                        </p>

                        <h4 className="mb-2 text-5xl font-bold">
                          {card.value}
                        </h4>

                        <p className="text-sm text-green-600">
                          {card.sub}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* LOWER GRID */}
                  <div className="grid gap-6 xl:grid-cols-[1fr_350px]">
                    {/* HEAT MAP */}
                    <div className="rounded-[32px] border border-slate-100 p-8">
                      <h4 className="mb-8 text-xl font-bold">
                        Risk Heat Map
                      </h4>

                      <div className="grid grid-cols-6 gap-3">
                        {Array.from({ length: 30 }).map((_, i) => (
                          <div
                            key={i}
                            className={`aspect-square rounded-xl ${
                              i < 10
                                ? 'bg-orange-100'
                                : i < 20
                                ? 'bg-orange-300'
                                : 'bg-red-400'
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    {/* AI RECOMMENDATIONS */}
                    <div className="rounded-[32px] border border-slate-100 p-8">
                      <h4 className="mb-8 text-xl font-bold">
                        AI Recommendations
                      </h4>

                      <div className="space-y-6">
                        {[
                          'Review 3 high-risk areas',
                          'Validate vendor contracts',
                          'Follow up 5 open issues',
                        ].map((item) => (
                          <div
                            key={item}
                            className="flex items-center justify-between"
                          >
                            <span>{item}</span>

                            <ArrowRight className="h-5 w-5 text-slate-400" />
                          </div>
                        ))}
                      </div>

                      <button className="mt-8 font-semibold text-blue-600">
                        View all recommendations →
                      </button>
                    </div>
                  </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>
      {/* TESTIMONIALS SECTION */}
      <section className="pb-24 overflow-hidden">
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={fadeUp}
          className="mx-auto max-w-4xl px-4 lg:px-8"
        >
          <TestimonialCarousel />
        </motion.div>
      </section>

      {/* CTA */}
      <section className="pb-24 overflow-hidden">
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={fadeUp}
          className="mx-auto max-w-[1440px] px-8"
        >
          <div className="rounded-[48px] bg-gradient-to-br from-blue-600 via-blue-500 to-blue-700 px-12 py-24 text-center text-white">
            <h2 className="mb-8 text-6xl font-bold">
              Ready to Transform Auditing?
            </h2>

            <p className="mx-auto mb-12 max-w-3xl text-xl leading-9 text-blue-100">
              Join the next generation of assurance teams
              using AI to audit smarter.
            </p>

            <div className="flex flex-wrap justify-center gap-6">
              <Link href="/register" className="rounded-2xl bg-white px-8 py-5 font-semibold text-blue-600 hover:bg-slate-50 transition">
                Book a Demo
              </Link>

              <Link href="/register" className="rounded-2xl border border-white/30 px-8 py-5 font-semibold text-white hover:bg-white/10 transition">
                Get Started
              </Link>
            </div>
          </div>
        </motion.div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-slate-200">
        <div className="mx-auto max-w-[1440px] px-8 py-20">
          <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4">
            {/* BRAND */}
            <div>
              <div className="mb-6 flex items-center">
                <div className="w-12 h-12 flex items-center justify-center">
                  <Image src="/logo.png" alt="AuditOS Logo" width={48} height={48} className="w-full h-full object-contain scale-[1.7]" />
                </div>

                <span className="text-3xl font-bold -ml-1">
                  Audit
                  <span className="text-blue-600">
                    OS
                  </span>
                </span>
              </div>

              <p className="leading-8 text-slate-600">
                The autonomous intelligence layer for
                modern auditing.
              </p>
            </div>

            {/* PRODUCT */}
            <div>
              <h4 className="mb-6 text-lg font-bold">
                Product
              </h4>

              <div className="space-y-4 text-slate-600">
                <p>Platform</p>
                <p>Pricing</p>
                <p>AI Engine</p>
              </div>
            </div>

            {/* RESOURCES */}
            <div>
              <h4 className="mb-6 text-lg font-bold">
                Resources
              </h4>

              <div className="space-y-4 text-slate-600">
                <p>Blog</p>
                <p>Documentation</p>
                <p>Support</p>
              </div>
            </div>

            {/* COMPANY */}
            <div>
              <h4 className="mb-6 text-lg font-bold">
                Company
              </h4>

              <div className="space-y-4 text-slate-600">
                <p>About</p>
                <p>Careers</p>
                <p>Contact</p>
              </div>
            </div>
          </div>

          <div className="mt-20 border-t border-slate-200 pt-10 text-center text-slate-500">
            © 2026 AuditOS. All rights reserved.
          </div>
        </div>
      </footer>
    </main>
  )
}
