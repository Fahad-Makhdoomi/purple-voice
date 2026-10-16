import type { Config } from 'tailwindcss';

/**
 * Every value here points at a CSS variable in src/styles/tokens.css.
 * Edit the token, not this file, to restyle the product.
 */
const rgb = (name: string) => `rgb(var(--pv-${name}) / <alpha-value>)`;
const scale = (name: string, steps: number[]) =>
  Object.fromEntries(steps.map((s) => [s, rgb(`${name}-${s}`)]));

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  // `.container` is defined in globals.css from the layout tokens; Tailwind's version
  // can't read CSS variables (its max-widths live inside media queries).
  corePlugins: { container: false },
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: rgb('violet-600'),
          ...scale('violet', [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]),
        },
        pink: scale('pink', [100, 300]),
        periwinkle: scale('periwinkle', [200, 300]),
        cyan: scale('cyan', [300]),
        ink: { DEFAULT: rgb('ink'), soft: rgb('ink-soft') },
        muted: rgb('muted'),
        subtle: rgb('subtle'),
        line: rgb('line'),
        surface: rgb('surface'),
        canvas: rgb('canvas'),
        night: { DEFAULT: rgb('night'), 2: rgb('night-2'), 3: rgb('night-3') },
        app: { bg: rgb('app-bg'), panel: rgb('app-panel'), card: rgb('app-card') },
        success: rgb('success'),
        warning: rgb('warning'),
        danger: rgb('danger'),
        info: rgb('info'),
      },
      fontFamily: {
        sans: ['var(--pv-font-sans)'],
        mono: ['var(--pv-font-mono)'],
      },
      fontSize: {
        display: [
          'var(--pv-text-display)',
          { lineHeight: 'var(--pv-leading-tight)', letterSpacing: 'var(--pv-tracking-tight)' },
        ],
        h1: ['var(--pv-text-h1)', { lineHeight: '1.1', letterSpacing: 'var(--pv-tracking-tight)' }],
        h2: ['var(--pv-text-h2)', { lineHeight: '1.15', letterSpacing: '-0.03em' }],
        h3: ['var(--pv-text-h3)', { lineHeight: '1.3', letterSpacing: '-0.015em' }],
        lead: ['var(--pv-text-lead)', { lineHeight: '1.6' }],
      },
      spacing: {
        section: 'var(--pv-section)',
        gutter: 'var(--pv-gutter)',
        header: 'var(--pv-header-h)',
      },
      maxWidth: {
        container: 'var(--pv-container)',
        narrow: 'var(--pv-container-narrow)',
      },
      borderRadius: {
        sm: 'var(--pv-radius-sm)',
        DEFAULT: 'var(--pv-radius)',
        card: 'var(--pv-radius)',
        lg: 'var(--pv-radius-lg)',
        xl: 'var(--pv-radius-xl)',
        pill: 'var(--pv-radius-pill)',
      },
      boxShadow: {
        sm: 'var(--pv-shadow-sm)',
        DEFAULT: 'var(--pv-shadow)',
        lg: 'var(--pv-shadow-lg)',
        glow: 'var(--pv-glow)',
      },
      backgroundImage: {
        'gradient-brand': 'var(--pv-gradient-brand)',
        'gradient-pastel': 'var(--pv-gradient-pastel)',
        'gradient-wash': 'var(--pv-gradient-wash)',
        'gradient-stat': 'var(--pv-gradient-stat)',
      },
      transitionTimingFunction: { brand: 'var(--pv-ease)' },
      transitionDuration: { DEFAULT: 'var(--pv-duration)' },
      keyframes: {
        rise: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'none' },
        },
        orbit: { to: { transform: 'rotate(360deg)' } },
        'orbit-reverse': { to: { transform: 'rotate(-360deg)' } },
        pulse: {
          '0%, 100%': { opacity: '0.55', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.06)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        spin: { to: { transform: 'rotate(360deg)' } },
        wave: {
          '0%, 100%': { transform: 'scaleY(0.22)' },
          '50%': { transform: 'scaleY(1)' },
        },
        marquee: { to: { transform: 'translateX(-50%)' } },
        shimmer: { to: { backgroundPosition: '-200% 0' } },
        'gradient-pan': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        ring: {
          '0%': { opacity: '0.55', transform: 'scale(0.7)' },
          '100%': { opacity: '0', transform: 'scale(1.7)' },
        },
        aurora: {
          '0%, 100%': { transform: 'translate3d(0,0,0) scale(1)' },
          '33%': { transform: 'translate3d(6%,-5%,0) scale(1.12)' },
          '66%': { transform: 'translate3d(-5%,6%,0) scale(0.94)' },
        },
        blink: { '0%, 49%': { opacity: '1' }, '50%, 100%': { opacity: '0' } },
        pop: {
          '0%': { opacity: '0', transform: 'translateY(10px) scale(0.94)' },
          '100%': { opacity: '1', transform: 'none' },
        },
        dash: { to: { strokeDashoffset: '0' } },
        flow: {
          '0%': { offsetDistance: '0%', opacity: '0' },
          '10%, 90%': { opacity: '1' },
          '100%': { offsetDistance: '100%', opacity: '0' },
        },
        grow: { from: { transform: 'scaleY(0)' }, to: { transform: 'scaleY(1)' } },
        tick: {
          '0%, 100%': { transform: 'scale(1)', boxShadow: '0 0 0 0 rgb(98 54 240 / 0.45)' },
          '50%': { transform: 'scale(1.06)', boxShadow: '0 0 0 8px rgb(98 54 240 / 0)' },
        },
      },
      animation: {
        rise: 'rise 500ms var(--pv-ease) both',
        orbit: 'orbit 40s linear infinite',
        'orbit-reverse': 'orbit-reverse 40s linear infinite',
        pulse: 'pulse 4s ease-in-out infinite',
        float: 'float 6s ease-in-out infinite',
        'spin-slow': 'spin 6s linear infinite',
        wave: 'wave 1.1s ease-in-out infinite',
        marquee: 'marquee 38s linear infinite',
        shimmer: 'shimmer 3.2s linear infinite',
        'gradient-pan': 'gradient-pan 7s ease-in-out infinite',
        ring: 'ring 3.2s ease-out infinite',
        aurora: 'aurora 18s ease-in-out infinite',
        blink: 'blink 1s steps(1) infinite',
        pop: 'pop 420ms var(--pv-ease) both',
        dash: 'dash 1.6s var(--pv-ease) forwards',
        flow: 'flow 3.4s linear infinite',
        grow: 'grow 900ms var(--pv-ease) both',
        tick: 'tick 2.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
