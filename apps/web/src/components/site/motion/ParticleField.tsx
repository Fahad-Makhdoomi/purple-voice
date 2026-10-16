'use client';

import { useEffect, useRef } from 'react';

/**
 * A cloud of glowing dots on a fixed canvas behind the whole page that
 * reshapes itself as you scroll: a humanoid robot, sound waves, a hummingbird,
 * a phone, a globe, the voice orb and the Purple Voice spark.
 *
 * Each silhouette is drawn in layers on a hidden canvas and sampled into
 * points. Every dot glides to its place in the current shape at its own pace;
 * once the shape has formed, the dots follow it tightly, so each one can move:
 * the robot turns its head and blinks, the hummingbird flies and beats its
 * wings, the phone rings, the globe turns and the spark pulses.
 */

type Draw = (c: CanvasRenderingContext2D) => void;
type Pt = { x: number; y: number; z: number; a: number };

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

const norm = (p: number) => (p - SIZE / 2) / (SIZE / 2);

// ─── Humanoid robot: a sleek android bust ───────────────────────────────────

/** Egg-shaped head, jaw, ear discs; the visor band, cheek lines and mouth are cut out. */
const robotHead: Draw = (c) => {
  c.fillStyle = '#fff';
  c.strokeStyle = '#fff';
  // Cranium and tapering jaw
  c.beginPath();
  c.moveTo(256, 76);
  c.bezierCurveTo(334, 76, 352, 138, 350, 196);
  c.bezierCurveTo(348, 250, 318, 296, 256, 306);
  c.bezierCurveTo(194, 296, 164, 250, 162, 196);
  c.bezierCurveTo(160, 138, 178, 76, 256, 76);
  c.closePath();
  c.fill();
  // Ear discs
  c.beginPath();
  c.ellipse(154, 200, 14, 34, 0, 0, Math.PI * 2);
  c.fill();
  c.beginPath();
  c.ellipse(358, 200, 14, 34, 0, 0, Math.PI * 2);
  c.fill();
  c.globalCompositeOperation = 'destination-out';
  // Visor band across the eyes
  roundRect(c, 178, 168, 156, 48, 24);
  c.fill();
  // Forehead seam and mouth slit
  c.lineWidth = 4;
  c.beginPath();
  c.moveTo(214, 112);
  c.quadraticCurveTo(256, 98, 298, 112);
  c.stroke();
  roundRect(c, 232, 262, 48, 6, 3);
  c.fill();
  // Cheek panel lines
  c.beginPath();
  c.moveTo(186, 232);
  c.quadraticCurveTo(200, 262, 226, 282);
  c.moveTo(326, 232);
  c.quadraticCurveTo(312, 262, 286, 282);
  c.stroke();
  c.globalCompositeOperation = 'source-over';
};

/** The two eyes inside the visor: bright and small, so they can look around. */
const robotEyes: Draw = (c) => {
  c.fillStyle = '#fff';
  c.beginPath();
  c.ellipse(222, 192, 14, 11, 0, 0, Math.PI * 2);
  c.fill();
  c.beginPath();
  c.ellipse(290, 192, 14, 11, 0, 0, Math.PI * 2);
  c.fill();
};

const robotNeck: Draw = (c) => {
  c.fillStyle = '#fff';
  roundRect(c, 226, 296, 60, 66, 14);
  c.fill();
  c.globalCompositeOperation = 'destination-out';
  roundRect(c, 242, 304, 6, 54, 3);
  c.fill();
  roundRect(c, 264, 304, 6, 54, 3);
  c.fill();
  c.globalCompositeOperation = 'source-over';
};

/** Sloping shoulders and a chest plate with a glowing core. */
const robotBody: Draw = (c) => {
  c.fillStyle = '#fff';
  c.strokeStyle = '#fff';
  c.beginPath();
  c.moveTo(60, 506);
  c.bezierCurveTo(70, 420, 150, 372, 226, 360);
  c.lineTo(286, 360);
  c.bezierCurveTo(362, 372, 442, 420, 452, 506);
  c.closePath();
  c.fill();
  c.globalCompositeOperation = 'destination-out';
  // Collarbone seams
  c.lineWidth = 4;
  c.beginPath();
  c.moveTo(226, 366);
  c.quadraticCurveTo(170, 390, 132, 440);
  c.moveTo(286, 366);
  c.quadraticCurveTo(342, 390, 380, 440);
  c.stroke();
  // Core socket
  c.beginPath();
  c.arc(256, 438, 26, 0, Math.PI * 2);
  c.fill();
  c.globalCompositeOperation = 'source-over';
  c.lineWidth = 6;
  c.beginPath();
  c.arc(256, 438, 36, 0, Math.PI * 2);
  c.stroke();
  c.beginPath();
  c.arc(256, 438, 10, 0, Math.PI * 2);
  c.fill();
};

// ─── Hummingbird ────────────────────────────────────────────────────────────

const birdBody: Draw = (c) => {
  c.fillStyle = '#fff';
  c.save();
  c.translate(280, 285);
  c.rotate(-0.55);
  c.beginPath();
  c.ellipse(0, 0, 92, 42, 0, 0, Math.PI * 2);
  c.fill();
  c.restore();
  c.beginPath();
  c.arc(204, 226, 34, 0, Math.PI * 2);
  c.fill();
  c.beginPath();
  c.moveTo(176, 214);
  c.lineTo(36, 150);
  c.lineTo(180, 234);
  c.closePath();
  c.fill();
  c.globalCompositeOperation = 'destination-out';
  c.beginPath();
  c.arc(196, 220, 7, 0, Math.PI * 2);
  c.fill();
  c.globalCompositeOperation = 'source-over';
};

const birdWingNear: Draw = (c) => {
  c.fillStyle = '#fff';
  c.beginPath();
  c.moveTo(268, 252);
  c.bezierCurveTo(300, 150, 390, 84, 478, 44);
  c.bezierCurveTo(466, 128, 400, 214, 308, 282);
  c.closePath();
  c.fill();
};

const birdWingFar: Draw = (c) => {
  c.fillStyle = '#fff';
  c.beginPath();
  c.moveTo(250, 256);
  c.bezierCurveTo(230, 160, 262, 80, 316, 22);
  c.bezierCurveTo(342, 100, 330, 196, 292, 282);
  c.closePath();
  c.fill();
};

const birdTail: Draw = (c) => {
  c.fillStyle = '#fff';
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
};

// ─── The rest ───────────────────────────────────────────────────────────────

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

const phoneHandset: Draw = (c) => {
  c.fillStyle = '#fff';
  c.strokeStyle = '#fff';
  c.save();
  c.translate(236, 330);
  c.rotate(-0.45);
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
};

const phoneArcs: Draw = (c) => {
  c.strokeStyle = '#fff';
  c.lineWidth = 14;
  c.lineCap = 'round';
  for (const r of [60, 104, 148]) {
    c.beginPath();
    c.arc(318, 188, r, -Math.PI * 0.62, -Math.PI * 0.05);
    c.stroke();
  }
};

const sparkMain: Draw = (c) => {
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
};

const sparkSatellite: Draw = (c) => {
  c.fillStyle = '#fff';
  c.beginPath();
  c.arc(400, 112, 22, 0, Math.PI * 2);
  c.fill();
};

// ─── Sampling ───────────────────────────────────────────────────────────────

interface Layer {
  draw: Draw;
  /** Share of all dots (layers' shares add up to 1). */
  share: number;
  part: number;
  /** Depth for a point at (x, y), each in -1…1. */
  z: (x: number, y: number, r: () => number) => number;
}

const flat = (depth: number) => (_x: number, _y: number, r: () => number) => (r() - 0.5) * depth;

/** Egg-shaped bulge: the face's front surface comes forward, with a back shell behind it. */
const headBulge = (_x: number, y: number, r: () => number) => {
  const dx = _x / 0.4;
  const dy = (y + 0.26) / 0.5;
  const b = 0.36 * Math.sqrt(Math.max(0, 1 - dx * dx - dy * dy));
  return r() < 0.7 ? -b : b * 0.9;
};

/** Dots sampled from layered silhouettes: about half on their outlines so forms read clearly. */
function sampleLayers(
  layers: Layer[],
  n: number,
  seed: number,
): { points: Float32Array; parts: Uint8Array } {
  const r = rng(seed);
  const points = new Float32Array(n * 3);
  const parts = new Uint8Array(n);
  let at = 0;
  layers.forEach((layer, li) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE;
    const c = canvas.getContext('2d', { willReadFrequently: true })!;
    layer.draw(c);
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
    const count = li === layers.length - 1 ? n - at : Math.round(layer.share * n);
    for (let k = 0; k < count && at < n; k++, at++) {
      const pool = (r() < 0.55 && edge.length ? edge : inside.length ? inside : edge) as number[];
      const j = Math.floor(r() * (pool.length / 2)) * 2;
      const x = norm(pool[j]!) + (r() - 0.5) * 0.012;
      const y = norm(pool[j + 1]!) + (r() - 0.5) * 0.012;
      points[at * 3] = x;
      points[at * 3 + 1] = y;
      points[at * 3 + 2] = layer.z(x, y, r);
      parts[at] = layer.part;
    }
  });
  return { points, parts };
}

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

// ─── Per-shape motion ───────────────────────────────────────────────────────

interface Shape {
  points: Float32Array;
  parts: Uint8Array;
  /** Spins all the way round (the globe) instead of swaying. */
  spin?: boolean;
  /** Parts drawn as bright cyan "light" (the robot's eyes). */
  glow?: number[];
  /** Moves one target point for this frame; `o.a` scales its brightness. */
  animate?: (o: Pt, part: number, t: number) => void;
}

const smooth = (v: number) => v * v * (3 - 2 * v);

/** Rotates (x, z) about the vertical axis. */
function yaw(o: Pt, a: number) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const x = o.x * c + o.z * s;
  o.z = -o.x * s + o.z * c;
  o.x = x;
}

/** The robot looks left, right and up at things, nods, and blinks now and then. */
function animateRobot(o: Pt, part: number, t: number) {
  if (part === 3) return; // shoulders stay put
  // Gaze: slow sweeps with a pause at each side.
  const look = Math.sin(t * 0.55) * 0.62 + Math.sin(t * 0.23 + 1) * 0.2;
  const nod = Math.sin(t * 0.8 + 0.5) * 0.07;
  const k = part === 2 ? 0.5 : 1; // the neck follows the head half as far
  const pivotY = 0.3;
  yaw(o, look * k);
  // Nod about the neck.
  const dy = o.y - pivotY;
  const c = Math.cos(nod * k);
  const s = Math.sin(nod * k);
  o.y = pivotY + dy * c - o.z * s;
  o.z = dy * s + o.z * c;
  if (part === 1) {
    // Eyes lead the head a little, and blink.
    o.x += Math.sin(look) * 0.03;
    const phase = t % 4.4;
    const blink = phase > 4.2 ? 1 - Math.abs(phase - 4.3) / 0.1 : 0;
    o.y = -0.25 + (o.y + 0.25) * (1 - 0.92 * Math.max(0, blink));
    o.a = 0.85 + 0.15 * Math.sin(t * 3);
  }
}

/** The hummingbird glides along a loop, bobs, beats its wings and swishes its tail. */
function animateBird(o: Pt, part: number, t: number) {
  const flap = Math.sin(t * 7.5);
  if (part === 1 || part === 2) {
    // Wings pivot at the shoulder; the far wing beats a little behind.
    const px = part === 1 ? 0.047 : -0.02;
    const py = part === 1 ? -0.016 : 0;
    const a = (part === 1 ? flap : Math.sin(t * 7.5 - 0.6)) * 0.55;
    const dx = o.x - px;
    const dy = o.y - py;
    const c = Math.cos(a);
    const s = Math.sin(a);
    o.x = px + dx * c - dy * s;
    o.y = py + dx * s + dy * c;
  } else if (part === 3) {
    const a = Math.sin(t * 3.2) * 0.14;
    const dx = o.x - 0.3;
    const dy = o.y - 0.25;
    o.x = 0.3 + dx * Math.cos(a) - dy * Math.sin(a);
    o.y = 0.25 + dx * Math.sin(a) + dy * Math.cos(a);
  }
  // Whole bird: a lazy figure-of-eight with a roll into each turn.
  const roll = Math.cos(t * 0.6) * 0.14;
  const c = Math.cos(roll);
  const s = Math.sin(roll);
  const x = o.x * c - o.y * s;
  const y = o.x * s + o.y * c;
  o.x = x + Math.sin(t * 0.6) * 0.3;
  o.y = y + Math.sin(t * 1.2) * 0.09 + Math.sin(t * 7.5) * 0.012;
}

function animateWave(o: Pt, _part: number, t: number) {
  o.y *= 0.5 + 0.5 * Math.abs(Math.sin(t * 2.6 + o.x * 5.5));
}

/** The phone rings in bursts; signal arcs pulse outwards. */
function animatePhone(o: Pt, part: number, t: number) {
  if (part === 0) {
    const burst = Math.max(0, Math.sin(t * 1.7));
    const a = Math.sin(t * 34) * 0.05 * burst * burst;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const x = o.x * c - o.y * s;
    o.y = o.x * s + o.y * c;
    o.x = x;
  } else {
    const d = Math.hypot(o.x - 0.242, o.y + 0.266);
    o.a = 0.25 + 0.75 * smooth(0.5 + 0.5 * Math.sin(t * 4.5 - d * 9));
  }
}

function animateGlobe(o: Pt, _part: number, t: number) {
  o.a = 0.55 + 0.45 * Math.sin(o.y * 5 - t * 2.4);
}

/** The voice orb breathes: rings swell like a sound travelling up it. */
function animateVase(o: Pt, _part: number, t: number) {
  const k = 1 + 0.12 * Math.sin(o.y * 7 - t * 2.6);
  o.x *= k;
  o.z *= k;
}

/** The spark pulses and its satellite orbits. */
function animateSpark(o: Pt, part: number, t: number) {
  if (part === 1) {
    const a = t * 0.9;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const x = o.x * c - o.y * s;
    o.y = o.x * s + o.y * c;
    o.x = x;
  } else {
    const k = 1 + 0.045 * Math.sin(t * 2.2);
    o.x *= k;
    o.y *= k;
  }
}

export function ParticleField({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const small = window.innerWidth < 720;
    const N = small ? 2100 : 3600;

    const robotLayers = sampleLayers(
      [
        { draw: robotHead, share: 0.4, part: 0, z: headBulge },
        { draw: robotEyes, share: 0.05, part: 1, z: (x, y) => headBulge(x, y, () => 0) - 0.05 },
        { draw: robotNeck, share: 0.07, part: 2, z: flat(0.14) },
        { draw: robotBody, share: 0.48, part: 3, z: flat(0.16) },
      ],
      N,
      11,
    );
    const birdLayers = sampleLayers(
      [
        { draw: birdBody, share: 0.42, part: 0, z: flat(0.1) },
        { draw: birdWingNear, share: 0.24, part: 1, z: () => -0.06 },
        { draw: birdWingFar, share: 0.2, part: 2, z: () => 0.06 },
        { draw: birdTail, share: 0.14, part: 3, z: flat(0.08) },
      ],
      N,
      37,
    );
    const waveLayers = sampleLayers([{ draw: soundwave, share: 1, part: 0, z: flat(0.2) }], N, 23);
    const phoneLayers = sampleLayers(
      [
        { draw: phoneHandset, share: 0.7, part: 0, z: flat(0.16) },
        { draw: phoneArcs, share: 0.3, part: 1, z: flat(0.1) },
      ],
      N,
      41,
    );
    const sparkLayers = sampleLayers(
      [
        { draw: sparkMain, share: 0.96, part: 0, z: flat(0.16) },
        { draw: sparkSatellite, share: 0.04, part: 1, z: flat(0.05) },
      ],
      N,
      79,
    );
    const zeros = new Uint8Array(N);

    const shapes: Shape[] = [
      { ...robotLayers, glow: [1], animate: animateRobot },
      { ...waveLayers, animate: animateWave },
      { ...birdLayers, animate: animateBird },
      { ...phoneLayers, animate: animatePhone },
      { points: globe(N, 53), parts: zeros, spin: true, animate: animateGlobe },
      { points: vase(N, 67), parts: zeros, animate: animateVase },
      { ...sparkLayers, animate: animateSpark },
    ];

    // Current positions start scattered, then pour into the first shape.
    const cur = new Float32Array(N * 3);
    const pace = new Float32Array(N);
    const bright = new Float32Array(N).fill(1);
    const rand = rng(5);
    for (let i = 0; i < N; i++) {
      cur[i * 3] = (rand() - 0.5) * 3;
      cur[i * 3 + 1] = (rand() - 0.5) * 3;
      cur[i * 3 + 2] = (rand() - 0.5) * 3;
      pace[i] = 0.025 + rand() * 0.07;
    }

    const o: Pt = { x: 0, y: 0, z: 0, a: 1 };
    let shapeIndex = -1;
    let changedAt = 0;
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
      last = 0;
      if (running && !reduce) raf = requestAnimationFrame(frame);
    };

    function frame(now: number) {
      if (!running || !ctx || !canvas) return;
      const t = reduce ? 3 : now / 1000;
      // Ease by elapsed time, not per frame, so slow devices behave too.
      const dt = last ? Math.min((now - last) / 1000, 0.5) : 1 / 60;
      last = now;
      const k = dt * 60;
      smoothP += (scrollP - smoothP) * (1 - Math.pow(0.94, k));
      smoothPointer += (pointer - smoothPointer) * (1 - Math.pow(0.96, k));

      // At the very top the cloud tours the first three shapes by itself;
      // once the page scrolls, the scroll position picks the shape.
      const atTop = window.scrollY < 60 && !reduce;
      const index = atTop
        ? Math.floor(t / 7) % 3
        : Math.min(shapes.length - 1, Math.floor(scrollP * shapes.length));
      if (index !== shapeIndex) {
        shapeIndex = index;
        changedAt = t;
      }
      const shape = shapes[index]!;
      const target = shape.points;
      const parts = shape.parts;
      // Staggered pouring while a shape forms; tight following once it has,
      // so the shape's own motion shows.
      const settle = smooth(Math.min(1, Math.max(0, (t - changedAt - 1.2) / 1.5)));
      const follow = 0.34;

      for (let i = 0; i < N; i++) {
        const i3 = i * 3;
        o.x = target[i3]!;
        o.y = target[i3 + 1]!;
        o.z = target[i3 + 2]!;
        o.a = 1;
        if (shape.animate && !reduce) shape.animate(o, parts[i]!, t);
        const base = pace[i]!;
        const e = reduce ? 1 : 1 - Math.pow(1 - (base + (follow - base) * settle), k);
        cur[i3] += (o.x - cur[i3]!) * e;
        cur[i3 + 1] += (o.y - cur[i3 + 1]!) * e;
        cur[i3 + 2] += (o.z - cur[i3 + 2]!) * e;
        bright[i] += (o.a - bright[i]!) * Math.min(1, 0.2 * k);
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';

      const sway = Math.sin(smoothP * Math.PI * 3.2);
      const cx = w * (0.5 + (small ? 0.05 : 0.27) * sway) + smoothPointer * 22;
      const cy = h * (0.44 + 0.07 * Math.cos(smoothP * Math.PI * 2));
      const R = Math.min(w, h) * (small ? 0.4 : 0.44) * (1 + 0.16 * Math.sin(smoothP * Math.PI));
      const fade = (atTop ? 0.95 : 0.85 - Math.min(0.3, smoothP * 0.5)) * (small ? 0.7 : 1);
      // Shapes with their own 3D motion get only a light sway of the camera.
      const ry = shape.spin ? t * 0.45 : Math.sin(t * 0.45) * 0.14 + smoothPointer * 0.22;
      const rx = 0.1 + Math.sin(t * 0.3) * 0.04;
      const cyaw = Math.cos(ry);
      const syaw = Math.sin(ry);
      const cp = Math.cos(rx);
      const sp = Math.sin(rx);
      const focal = 3.4;
      const glow = shape.glow;

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
        const isGlow = glow !== undefined && glow.includes(shape.parts[i]!);
        const alpha = (0.35 + 0.65 * (1 - depth)) * fade * bright[i]! * (isGlow ? 1.4 : 1);
        const px = cx + x1 * R * s;
        const py = cy + y1 * R * s;
        if (px < -6 || px > w + 6 || py < -6 || py > h + 6) continue;
        const d = (1.5 + 1.9 * s * (1 - depth * 0.5)) * (small ? 0.85 : 1) * (isGlow ? 1.5 : 1);
        const hue = isGlow ? 188 : 262 - ((y + 1) / 2) * 78;
        const light = isGlow ? 82 : 64 + 12 * (1 - depth);
        ctx.fillStyle = `hsla(${hue}, 95%, ${light}%, ${Math.min(1, alpha)})`;
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
