'use client';

import { useEffect, useRef } from 'react';

/**
 * A cloud of glowing dots on a fixed canvas behind the whole page that
 * reshapes itself as you scroll: an AI robot, sound waves, a hummingbird, a
 * phone, a globe, the voice orb and the Purple Voice spark. Each silhouette is
 * drawn once on a hidden canvas and sampled into points; every dot then glides
 * to its place in the current shape at its own pace, so the change looks like
 * the cloud pouring from one form into the next.
 */

type Draw = (c: CanvasRenderingContext2D) => void;

const SIZE = 512;

/** Deterministic random numbers so the shapes look the same on every load. */
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function roundRect(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

const robot: Draw = (c) => {
  c.fillStyle = '#fff';
  c.strokeStyle = '#fff';
  // Antenna
  c.lineWidth = 10;
  c.beginPath();
  c.moveTo(256, 50);
  c.lineTo(256, 96);
  c.stroke();
  c.beginPath();
  c.arc(256, 40, 15, 0, Math.PI * 2);
  c.fill();
  // Head and ears
  roundRect(c, 112, 96, 288, 232, 60);
  c.fill();
  roundRect(c, 72, 176, 34, 96, 14);
  c.fill();
  roundRect(c, 406, 176, 34, 96, 14);
  c.fill();
  // Neck and shoulders
  c.fillRect(224, 326, 64, 30);
  roundRect(c, 138, 356, 236, 84, 36);
  c.fill();
  // Eyes, mouth and chest light are cut out
  c.globalCompositeOperation = 'destination-out';
  roundRect(c, 164, 160, 84, 78, 28);
  c.fill();
  roundRect(c, 264, 160, 84, 78, 28);
  c.fill();
  roundRect(c, 184, 262, 144, 34, 17);
  c.fill();
  c.beginPath();
  c.arc(256, 398, 14, 0, Math.PI * 2);
  c.fill();
  c.globalCompositeOperation = 'source-over';
  // Pupils and mouth grille
  c.beginPath();
  c.arc(206, 200, 16, 0, Math.PI * 2);
  c.fill();
  c.beginPath();
  c.arc(306, 200, 16, 0, Math.PI * 2);
  c.fill();
  for (let i = 0; i < 6; i++) c.fillRect(200 + i * 22, 268, 8, 22);
};

const hummingbird: Draw = (c) => {
  c.fillStyle = '#fff';
  c.strokeStyle = '#fff';
  // Body, tilted nose-up
  c.save();
  c.translate(280, 285);
  c.rotate(-0.55);
  c.beginPath();
  c.ellipse(0, 0, 92, 42, 0, 0, Math.PI * 2);
  c.fill();
  c.restore();
  // Head
  c.beginPath();
  c.arc(204, 226, 34, 0, Math.PI * 2);
  c.fill();
  // Long beak
  c.beginPath();
  c.moveTo(176, 214);
  c.lineTo(36, 150);
  c.lineTo(180, 234);
  c.closePath();
  c.fill();
  // Near wing, raised
  c.beginPath();
  c.moveTo(268, 252);
  c.bezierCurveTo(300, 150, 390, 84, 478, 44);
  c.bezierCurveTo(466, 128, 400, 214, 308, 282);
  c.closePath();
  c.fill();
  // Far wing
  c.beginPath();
  c.moveTo(250, 256);
  c.bezierCurveTo(230, 160, 262, 80, 316, 22);
  c.bezierCurveTo(342, 100, 330, 196, 292, 282);
  c.closePath();
  c.fill();
  // Tail feathers
  for (const [x, y] of [
    [452, 392],
    [470, 360],
    [430, 418],
  ] as const) {
    c.beginPath();
    c.moveTo(332, 318);
    c.lineTo(x, y);
    c.lineTo(x - 26, y + 14);
    c.lineTo(322, 340);
    c.closePath();
    c.fill();
  }
  // Eye
  c.globalCompositeOperation = 'destination-out';
  c.beginPath();
  c.arc(196, 220, 7, 0, Math.PI * 2);
  c.fill();
  c.globalCompositeOperation = 'source-over';
};

const soundwave: Draw = (c) => {
  c.fillStyle = '#fff';
  const bars = 29;
  for (let i = 0; i < bars; i++) {
    const k = i / (bars - 1);
    const env = Math.sin(k * Math.PI);
    const h = 36 + 400 * env * (0.35 + 0.65 * Math.abs(Math.sin(i * 0.9) * Math.cos(i * 0.31)));
    roundRect(c, 20 + i * 16.5, 256 - h / 2, 9, h, 4.5);
    c.fill();
  }
};

const phone: Draw = (c) => {
  c.fillStyle = '#fff';
  c.strokeStyle = '#fff';
  c.save();
  c.translate(236, 330);
  c.rotate(-0.45);
  // Handset: a thick arc with a rounded cup at each end
  c.lineWidth = 58;
  c.lineCap = 'round';
  c.beginPath();
  c.arc(0, 0, 150, Math.PI * 1.13, Math.PI * 1.87);
  c.stroke();
  for (const a of [Math.PI * 1.11, Math.PI * 1.89]) {
    c.beginPath();
    c.arc(Math.cos(a) * 150, Math.sin(a) * 150 + 30, 54, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
  // Signal arcs
  c.lineWidth = 14;
  for (const r of [60, 104, 148]) {
    c.beginPath();
    c.arc(318, 188, r, -Math.PI * 0.62, -Math.PI * 0.05);
    c.stroke();
  }
};

const spark: Draw = (c) => {
  c.fillStyle = '#fff';
  c.strokeStyle = '#fff';
  c.lineWidth = 10;
  c.beginPath();
  c.arc(256, 256, 218, 0, Math.PI * 2);
  c.stroke();
  c.beginPath();
  c.moveTo(256, 62);
  c.quadraticCurveTo(264, 248, 450, 256);
  c.quadraticCurveTo(264, 264, 256, 450);
  c.quadraticCurveTo(248, 264, 62, 256);
  c.quadraticCurveTo(248, 248, 256, 62);
  c.fill();
  c.beginPath();
  c.arc(400, 112, 20, 0, Math.PI * 2);
  c.fill();
};

/** Dots sampled from a silhouette: about half on its outline so the form reads clearly. */
function sampleBitmap(draw: Draw, n: number, seed: number): Float32Array {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const c = canvas.getContext('2d', { willReadFrequently: true })!;
  draw(c);
  const data = c.getImageData(0, 0, SIZE, SIZE).data;
  const filled = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < SIZE && y < SIZE && data[(y * SIZE + x) * 4 + 3]! > 128;
  const edge: number[] = [];
  const inside: number[] = [];
  for (let y = 0; y < SIZE; y += 2) {
    for (let x = 0; x < SIZE; x += 2) {
      if (!filled(x, y)) continue;
      const isEdge =
        !filled(x - 4, y) || !filled(x + 4, y) || !filled(x, y - 4) || !filled(x, y + 4);
      (isEdge ? edge : inside).push(x, y);
    }
  }
  const r = rng(seed);
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const pool = (r() < 0.55 && edge.length ? edge : inside.length ? inside : edge) as number[];
    const k = Math.floor(r() * (pool.length / 2)) * 2;
    out[i * 3] = ((pool[k]! - SIZE / 2) / (SIZE / 2)) * 1.0 + (r() - 0.5) * 0.012;
    out[i * 3 + 1] = ((pool[k + 1]! - SIZE / 2) / (SIZE / 2)) * 1.0 + (r() - 0.5) * 0.012;
    out[i * 3 + 2] = (r() - 0.5) * 0.2;
  }
  return out;
}

/** A globe of latitude and longitude lines. */
function globe(n: number, seed: number): Float32Array {
  const r = rng(seed);
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const useLat = r() < 0.5;
    const a = r() * Math.PI * 2;
    let x: number, y: number, z: number;
    if (useLat) {
      const lat = (Math.floor(r() * 9) / 8 - 0.5) * Math.PI * 0.94;
      x = Math.cos(lat) * Math.cos(a);
      y = Math.sin(lat);
      z = Math.cos(lat) * Math.sin(a);
    } else {
      const lon = Math.floor(r() * 12) * (Math.PI / 6);
      const lat = (r() - 0.5) * Math.PI;
      x = Math.cos(lat) * Math.cos(lon);
      y = Math.sin(lat);
      z = Math.cos(lat) * Math.sin(lon);
    }
    out[i * 3] = x * 0.95;
    out[i * 3 + 1] = y * 0.95;
    out[i * 3 + 2] = z * 0.95;
  }
  return out;
}

/** The original vase of swelling rings: the "voice" sculpture. */
function vase(n: number, seed: number): Float32Array {
  const r = rng(seed);
  const rings = 30;
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const ring = Math.floor(r() * rings);
    const k = ring / (rings - 1);
    const shape = 0.5 + 0.5 * Math.sin(k * Math.PI);
    const wave = 0.78 + 0.22 * Math.sin(k * 9) * Math.cos(k * 3);
    const rad = (0.28 + 0.62 * shape) * wave;
    const a = r() * Math.PI * 2;
    out[i * 3] = rad * Math.cos(a) * 0.9;
    out[i * 3 + 1] = (k - 0.5) * 1.9;
    out[i * 3 + 2] = rad * Math.sin(a) * 0.9;
  }
  return out;
}

interface Shape {
  name: string;
  points: Float32Array;
  /** Spins all the way round (the globe) instead of swaying. */
  spin?: boolean;
  /** Per-frame motion applied to a point's target. */
  animate?: (x: number, y: number, t: number) => [number, number];
}

export function ParticleField({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const small = window.innerWidth < 720;
    const N = small ? 1900 : 3400;

    const shapes: Shape[] = [
      { name: 'robot', points: sampleBitmap(robot, N, 11) },
      {
        name: 'soundwave',
        points: sampleBitmap(soundwave, N, 23),
        animate: (x, y, t) => [x, y * (0.5 + 0.5 * Math.abs(Math.sin(t * 2.6 + x * 5.5)))],
      },
      { name: 'hummingbird', points: sampleBitmap(hummingbird, N, 37) },
      { name: 'phone', points: sampleBitmap(phone, N, 41) },
      { name: 'globe', points: globe(N, 53), spin: true },
      { name: 'voice', points: vase(N, 67) },
      { name: 'spark', points: sampleBitmap(spark, N, 79) },
    ];

    // Current positions start scattered, then pour into the first shape.
    const cur = new Float32Array(N * 3);
    const pace = new Float32Array(N);
    const rand = rng(5);
    for (let i = 0; i < N; i++) {
      cur[i * 3] = (rand() - 0.5) * 3;
      cur[i * 3 + 1] = (rand() - 0.5) * 3;
      cur[i * 3 + 2] = (rand() - 0.5) * 3;
      pace[i] = 0.025 + rand() * 0.07;
    }

    let w = 0;
    let h = 0;
    let dpr = 1;
    let raf = 0;
    let running = true;
    let scrollP = 0;
    let smoothP = 0;
    let pointer = 0;
    let smoothPointer = 0;
    let last = 0;

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
      const t = reduce ? 0 : now / 1000;
      // Ease by elapsed time, not per frame, so slow devices settle into each shape too.
      const dt = last ? Math.min((now - last) / 1000, 0.5) : 1 / 60;
      last = now;
      const k = dt * 60;
      smoothP += (scrollP - smoothP) * (1 - Math.pow(0.94, k));
      smoothPointer += (pointer - smoothPointer) * (1 - Math.pow(0.96, k));

      // At the very top the cloud tours the first three shapes by itself;
      // once the page scrolls, the scroll position picks the shape.
      const atTop = window.scrollY < 60 && !reduce;
      const index = atTop
        ? Math.floor(t / 5.5) % 3
        : Math.min(shapes.length - 1, Math.floor(scrollP * shapes.length));
      const shape = shapes[index]!;
      const target = shape.points;

      for (let i = 0; i < N; i++) {
        const i3 = i * 3;
        let tx = target[i3]!;
        let ty = target[i3 + 1]!;
        if (shape.animate) [tx, ty] = shape.animate(tx, ty, t);
        const e = reduce ? 1 : 1 - Math.pow(1 - pace[i]!, k);
        cur[i3] += (tx - cur[i3]!) * e;
        cur[i3 + 1] += (ty - cur[i3 + 1]!) * e;
        cur[i3 + 2] += (target[i3 + 2]! - cur[i3 + 2]!) * e;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';

      const sway = Math.sin(smoothP * Math.PI * 3.2);
      const cx = w * (0.5 + (small ? 0.05 : 0.27) * sway) + smoothPointer * 22;
      const cy = h * (0.44 + 0.07 * Math.cos(smoothP * Math.PI * 2));
      const R = Math.min(w, h) * (small ? 0.4 : 0.44) * (1 + 0.16 * Math.sin(smoothP * Math.PI));
      const fade = (atTop ? 0.95 : 0.85 - Math.min(0.3, smoothP * 0.5)) * (small ? 0.7 : 1);
      const ry = shape.spin ? t * 0.45 : Math.sin(t * 0.45) * 0.42 + smoothPointer * 0.25;
      const rx = 0.12 + Math.sin(t * 0.3) * 0.06;
      const cyaw = Math.cos(ry);
      const syaw = Math.sin(ry);
      const cp = Math.cos(rx);
      const sp = Math.sin(rx);
      const focal = 3.4;

      for (let i = 0; i < N; i++) {
        const i3 = i * 3;
        const x = cur[i3]!;
        const y = cur[i3 + 1]!;
        const z = cur[i3 + 2]!;
        const x1 = x * cyaw + z * syaw;
        const z1 = -x * syaw + z * cyaw;
        const y1 = y * cp - z1 * sp;
        const z2 = y * sp + z1 * cp;
        const s = focal / (focal + z2);
        const depth = Math.min(1, Math.max(0, (z2 + 1.1) / 2.2));
        const alpha = (0.35 + 0.65 * (1 - depth)) * fade;
        const px = cx + x1 * R * s;
        const py = cy + y1 * R * s;
        if (px < -6 || px > w + 6 || py < -6 || py > h + 6) continue;
        const d = (1.5 + 1.9 * s * (1 - depth * 0.5)) * (small ? 0.85 : 1);
        const hue = 262 - ((y + 1) / 2) * 78;
        ctx.fillStyle = `hsla(${hue}, 95%, ${64 + 12 * (1 - depth)}%, ${alpha})`;
        ctx.fillRect(px - d / 2, py - d / 2, d, d);
      }

      // Soft bloom under the cloud.
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.35);
      g.addColorStop(0, `rgba(98, 54, 240, ${0.16 * fade})`);
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
