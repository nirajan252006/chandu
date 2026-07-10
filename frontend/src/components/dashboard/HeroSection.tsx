// ============================================
// Hero Section - Landing Page
// ============================================

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Upload, Zap, Shield, BarChart3, Clock, Database, Car } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';

const features = [
  {
    icon: <Zap className="w-5 h-5" />,
    title: 'Lightning Fast',
    desc: 'Parallel processing with smart queue management and concurrent Looker Studio tabs.',
    color: '#38bdf8',
  },
  {
    icon: <Shield className="w-5 h-5" />,
    title: 'Secure & Local',
    desc: 'All queries are made locally from your IP. No business data or credentials leak out.',
    color: '#34d399',
  },
  {
    icon: <BarChart3 className="w-5 h-5" />,
    title: 'Smart Filtering',
    desc: 'Filter Looker Studio records automatically by date, age, tag status, and custom rules.',
    color: '#c084fc',
  },
  {
    icon: <Clock className="w-5 h-5" />,
    title: 'Auto Recovery',
    desc: 'Automatic session refreshing, worker self-healing, and retry on browser crashes.',
    color: '#f472b6',
  },
  {
    icon: <Database className="w-5 h-5" />,
    title: 'Pro Excel Reports',
    desc: 'Generates beautifully styled Excel files complete with column colors, filters, and logs.',
    color: '#fbbf24',
  },
  {
    icon: <Car className="w-5 h-5" />,
    title: '50K+ Capacity',
    desc: 'Engineered for scalability. Load lists with tens of thousands of vehicles easily.',
    color: '#fb923c',
  },
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
} as const;

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
} as const;

// Custom component to count up to a number smoothly
function AnimatedCounter({ value, duration = 1.2 }: { value: string; duration?: number }) {
  const numericStr = value.replace(/[^0-9]/g, '');
  const numericValue = numericStr ? parseInt(numericStr, 10) : 0;
  const suffix = value.replace(/[0-9]/g, '');
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = numericValue;
    if (end === 0) {
      setCount(0);
      return;
    }
    const totalMiliseconds = duration * 1000;
    const incrementTime = Math.max(Math.floor(totalMiliseconds / end), 20);
    const step = Math.ceil(end / (totalMiliseconds / incrementTime));

    const timer = setInterval(() => {
      start += step;
      if (start >= end) {
        clearInterval(timer);
        setCount(end);
      } else {
        setCount(start);
      }
    }, incrementTime);

    return () => clearInterval(timer);
  }, [numericValue, duration]);

  if (isNaN(numericValue) || numericValue === 0) {
    return <span>{value}</span>;
  }

  return <span>{count.toLocaleString()}{suffix}</span>;
}

export default function HeroSection() {
  const { setActiveTab } = useAppStore();
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  // Track mouse coordinates for subtle parallax movements
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({
        x: (e.clientX - window.innerWidth / 2) / 50,
        y: (e.clientY - window.innerHeight / 2) / 50,
      });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div className="relative z-10 flex flex-col items-center justify-start py-8 md:py-12 w-full overflow-hidden select-none">
      
      {/* Decorative Interactive Floating Orbs */}
      <div 
        className="absolute top-10 left-10 w-72 h-72 rounded-full bg-sky-500/5 blur-[100px] pointer-events-none animate-pulse-neon" 
        style={{ transform: `translate3d(${mousePosition.x * -0.5}px, ${mousePosition.y * -0.5}px, 0)` }}
      />
      <div 
        className="absolute bottom-10 right-10 w-96 h-96 rounded-full bg-purple-500/5 blur-[120px] pointer-events-none animate-pulse-neon"
        style={{ transform: `translate3d(${mousePosition.x * 0.7}px, ${mousePosition.y * 0.7}px, 0)` }}
      />

      {/* Hero Badge */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full glass border border-indigo-500/10 mb-6 text-xs font-semibold tracking-wider text-slate-300 uppercase shadow-lg shadow-black/40"
      >
        <span className="flex h-2 w-2 rounded-full bg-cyan-400 animate-pulse"></span>
        Enterprise Automation v1.0
      </motion.div>

      {/* Logo & Main Headline */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="text-center max-w-4xl mx-auto space-y-4 mb-10"
      >
        <motion.div
          animate={{ 
            y: [0, -6, 0], 
            rotate: [0, 2, -2, 0] 
          }}
          transition={{ 
            duration: 5, 
            repeat: Infinity, 
            ease: 'easeInOut' 
          }}
          className="inline-flex items-center justify-center w-24 h-24 rounded-3xl mb-4"
          style={{
            background: 'linear-gradient(135deg, #38bdf8 0%, #c084fc 50%, #f472b6 100%)',
            boxShadow: '0 0 35px rgba(56, 189, 248, 0.25), 0 0 70px rgba(192, 132, 252, 0.15)',
          }}
        >
          <Car className="w-11 h-11 text-white filter drop-shadow-[0_2px_10px_rgba(3,3,12,0.3)]" />
        </motion.div>

        <h1
          className="text-4xl sm:text-5xl md:text-6xl lg:text-[56px] font-black tracking-tight font-hero"
          style={{ fontFamily: 'Orbitron, sans-serif' }}
        >
          <span className="text-gradient">VEHICLE DATA</span>
        </h1>
        <h2
          className="text-2xl sm:text-3xl md:text-4xl lg:text-[40px] font-black tracking-widest mt-1 font-page-title"
          style={{ fontFamily: 'Orbitron, sans-serif' }}
        >
          <span className="text-gradient">RETRIEVER PRO</span>
        </h2>
        <p className="text-sm sm:text-base md:text-[16px] max-w-2xl mx-auto leading-relaxed text-slate-400 font-medium pt-2 font-body">
          Automate bulk vehicle number searches directly from Looker Studio.
          Process lists containing thousands of items safely and compile results in premium reports.
        </p>
      </motion.div>

      {/* Call To Action Buttons */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.25 }}
        className="mb-14 relative z-10"
      >
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setActiveTab('process')}
          className="cyber-button text-sm md:text-[14px] px-10 py-4 flex items-center gap-3 font-bold cursor-pointer rounded-2xl group border border-slate-700"
        >
          <Upload className="w-5 h-5 text-white transition-transform group-hover:-translate-y-0.5 group-hover:scale-105" />
          START RETRIEVAL PROCESS
        </motion.button>
      </motion.div>

      {/* Stats Row */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.45 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl w-full mb-16 px-4"
      >
        {[
          { label: 'Max Capacity', value: '50000+', color: '#38bdf8' },
          { label: 'Parallel Tabs', value: '5+', color: '#c084fc' },
          { label: 'Auto Retry Limit', value: '3x', color: '#f472b6' },
          { label: 'Local Security', value: '100%', color: '#34d399' },
        ].map((stat, i) => (
          <motion.div
            key={i}
            whileHover={{ scale: 1.05, y: -4 }}
            transition={{ duration: 0.3 }}
            className="text-center glass p-6 rounded-2xl border-indigo-500/10 shadow-lg flex flex-col items-center justify-center min-h-[120px]"
          >
            <div
              className="text-2xl sm:text-3xl font-extrabold mb-1"
              style={{ fontFamily: 'Orbitron, sans-serif', color: stat.color }}
            >
              <AnimatedCounter value={stat.value} />
            </div>
            <div className="text-[13px] font-bold uppercase tracking-wider text-slate-500 font-caption">{stat.label}</div>
          </motion.div>
        ))}
      </motion.div>

      {/* Feature Cards Grid */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl w-full px-4 animate-gpu"
      >
        {features.map((feat, i) => (
          <motion.div
            key={i}
            variants={item}
            whileHover={{ 
              y: -8, 
              boxShadow: `0 15px 35px -10px ${feat.color}25, 0 0 1px ${feat.color}40`,
              borderColor: `${feat.color}44`
            }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="glass p-6 cursor-default relative border flex flex-col justify-between rounded-2xl"
            style={{
              borderColor: 'rgba(99, 102, 241, 0.1)',
            }}
          >
            <div>
              {/* Floating icon */}
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center mb-5 transition-transform duration-300 hover:rotate-6"
                style={{
                  background: `${feat.color}15`,
                  color: feat.color,
                  boxShadow: `0 0 20px ${feat.color}25`,
                }}
              >
                {feat.icon}
              </div>
              <h3 className="text-[18px] font-bold mb-2 tracking-wide text-slate-100 font-card-title">
                {feat.title}
              </h3>
              <p className="text-[13px] leading-relaxed text-slate-400 font-medium font-caption">{feat.desc}</p>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
