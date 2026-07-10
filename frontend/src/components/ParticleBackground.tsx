// ============================================
// Particle Background Component
// ============================================

import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
  color: string;
}

const COLORS = ['#00d4ff', '#a855f7', '#ff2d95', '#00ff88'];

export default function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Respect reduced motion preference (keep appearance as close as possible)
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      'matchMedia' in window &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let animationId: number | null = null;
    let particles: Particle[] = [];

    // Cap FPS for performance stability
    const FPS_CAP = 30;
    const frameMs = 1000 / FPS_CAP;
    let lastFrameAt = 0;

    const getParticleCount = () => {
      const w = window.innerWidth;
      const base = Math.min(80, Math.floor(w / 20));
      // Reduce particles on small screens
      if (w < 640) return Math.max(18, Math.floor(base * 0.6));
      if (w < 1024) return Math.max(26, Math.floor(base * 0.75));
      return Math.max(30, base);
    };

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const createParticles = () => {
      const count = getParticleCount();
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        radius: Math.random() * 2 + 0.5,
        opacity: Math.random() * 0.5 + 0.1,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
      }));
    };

    const shouldAnimate = () => {
      if (prefersReducedMotion) return false;
      return document.visibilityState === 'visible';
    };

    const drawParticles = (t?: number) => {
      if (!shouldAnimate()) {
        if (animationId != null) cancelAnimationFrame(animationId);
        animationId = null;
        return;
      }

      const now = t ?? performance.now();
      if (now - lastFrameAt < frameMs) {
        animationId = requestAnimationFrame(drawParticles);
        return;
      }
      lastFrameAt = now;

      ctx.clearRect(0, 0, canvas.width, canvas.height);


      particles.forEach((p, i) => {
        // Update position
        p.x += p.vx;
        p.y += p.vy;

        // Wrap around edges
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        // Draw particle
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.opacity;
        ctx.fill();

        // Draw connections
        for (let j = i + 1; j < particles.length; j++) {
          const dx = p.x - particles[j].x;
          const dy = p.y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = p.color;
            ctx.globalAlpha = (1 - dist / 120) * 0.15;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      });

      ctx.globalAlpha = 1;
      animationId = requestAnimationFrame(drawParticles);
    };

    const onVisibility = () => {
      if (animationId == null && shouldAnimate()) {
        animationId = requestAnimationFrame(drawParticles);
      }
    };

    resize();
    createParticles();
    if (shouldAnimate()) animationId = requestAnimationFrame(drawParticles);

    window.addEventListener('resize', () => {
      resize();
      createParticles();
    });

    document.addEventListener('visibilitychange', onVisibility);

    return () => {


      if (animationId != null) cancelAnimationFrame(animationId);

      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="particles-canvas"
      style={{ opacity: 0.6 }}
    />
  );
}
