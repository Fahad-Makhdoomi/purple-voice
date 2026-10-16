'use client';

import { useEffect, useRef } from 'react';

const RINGS = 30;
const DOTS = 76;

/**
 * A glowing "voice" sculpture made of dot rings, drawn on a fixed canvas
 * behind the whole page. The rings swell like a sound wave, the object turns
 * slowly, and scrolling moves it from the centre of the hero out to the
 * sides and back so it follows the reader down the page.
 */
export function ParticleField({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let w = 0;
    let h = 0;
    let dpr = 1;
    let raf = 0;
    let running = true;
    let scrollP = 0;
    let smoothP = 0;
    let pointer = 0;
    let smoothPointer = 0;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    };
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      scrollP = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    };
    const onPointer = (e: PointerEvent) => {
      pointer = (e.clientX / window.innerWidth) * 2 - 1;
    };
    const onVisibility = () => {
      running = !document.hidden;
      if (running && !reduce) raf = requestAnimationFrame(frame);
    };

    function frame(now: number) {
      if (!running || !ctx || !canvas) return;
      const t = reduce ? 2 : now / 1000;
      smoothP += (scrollP - smoothP) * 0.06;
      smoothPointer += (pointer - smoothPointer) * 0.04;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';

      const small = w < 720;
      // Position: centre in the hero, then drifts side to side as the page scrolls.
      const sway = Math.sin(smoothP * Math.PI * 3.2);
      const cx = w * (0.5 + (small ? 0.06 : 0.3) * sway) + smoothPointer * 24;
      const cy = h * (0.42 + 0.1 * Math.cos(smoothP * Math.PI * 2));
      const size =
        Math.min(w, h) * (small ? 0.62 : 0.52) * (1 + 0.28 * Math.sin(smoothP * Math.PI));
      const fade = (0.95 - Math.min(0.5, smoothP * 1.6)) * (small ? 0.65 : 1);
      const tilt = 0.5 + smoothP * 0.7;
      const spin = t * 0.18 + smoothP * 5;
      const cosT = Math.cos(tilt);
      const sinT = Math.sin(tilt);
      const focal = size * 3.2;

      for (let i = 0; i < RINGS; i++) {
        const k = i / (RINGS - 1);
        // Vase-like silhouette modulated by travelling sound waves.
        const shape = 0.5 + 0.5 * Math.sin(k * Math.PI);
        const wave = 0.72 + 0.28 * Math.sin(k * 9 - t * 2.1) * Math.cos(t * 0.7 + k * 3);
        const r = size * (0.28 + 0.62 * shape) * wave;
        const y = (k - 0.5) * size * 2.15;
        // Violet at the top, through periwinkle, to cyan at the bottom.
        const hue = 262 - k * 70;
        for (let j = 0; j < DOTS; j++) {
          const a = (j / DOTS) * Math.PI * 2 + spin + i * 0.06;
          const x3 = r * Math.cos(a);
          const z3 = r * Math.sin(a);
          const y2 = y * cosT - z3 * sinT;
          const z2 = y * sinT + z3 * cosT;
          const s = focal / (focal + z2);
          const depth = Math.min(1, Math.max(0.12, (z2 / size + 1.2) / 2.4));
          const alpha = (0.28 + 0.9 * (1 - depth)) * fade;
          if (alpha < 0.03) continue;
          const px = cx + x3 * s;
          const py = cy + y2 * s;
          if (px < -8 || px > w + 8 || py < -8 || py > h + 8) continue;
          const d = (1.5 + 2.1 * s * (1 - depth * 0.6)) * (small ? 0.85 : 1);
          ctx.fillStyle = `hsla(${hue}, 95%, ${62 + 14 * (1 - depth)}%, ${alpha})`;
          ctx.fillRect(px - d / 2, py - d / 2, d, d * 0.62);
        }
      }

      // Soft bloom under the sculpture.
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 1.3);
      g.addColorStop(0, `rgba(98, 54, 240, ${0.2 * fade})`);
      g.addColorStop(1, 'rgba(98, 54, 240, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      if (!reduce) raf = requestAnimationFrame(frame);
    }

    resize();
    onScroll();
    window.addEventListener('resize', resize);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pointermove', onPointer, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    raf = requestAnimationFrame(frame);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pointermove', onPointer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className={className ?? 'pointer-events-none fixed inset-0 -z-10'}
    />
  );
}
