import Link from 'next/link';
import {
  ArrowLeftRight,
  ArrowUpRight,
  CalendarCheck,
  Check,
  PhoneCall,
  Webhook,
  Workflow,
} from 'lucide-react';
import { Reveal, Spotlight } from '@/components/site/motion';
import { cn } from '@/lib/cn';

const PILLARS = [
  {
    icon: PhoneCall,
    title: 'Answers and dials for you',
    body: 'Run outbound lists and pick up every inbound call on the same agent, inside your calling hours.',
  },
  {
    icon: CalendarCheck,
    title: 'Books into your calendar',
    body: 'It checks Google Calendar mid-call, offers real open slots and sends the invite before hanging up.',
  },
  {
    icon: ArrowLeftRight,
    title: 'Hands hot leads to a human',
    body: 'When a prospect is ready, the call transfers live to your team — with a summary already written.',
  },
];

/** Three big claims in tall black glass columns, like the product in one breath. */
export function Pillars() {
  return (
    <section id="features" className="scroll-mt-24 py-section" aria-labelledby="engine-title">
      <div className="container">
        <Reveal className="mx-auto max-w-3xl text-center">
          <h2
            id="engine-title"
            className="text-[length:clamp(34px,5.4vw,68px)] font-medium leading-[1.02] tracking-[-0.04em] text-white"
          >
            Your all-in-one AI sales calling engine.
          </h2>
          <p className="mt-5 text-lead text-white/65">
            Agents, campaigns, calendars, transcripts and billing in one place — nothing to stitch
            together, nothing to host.
          </p>
        </Reveal>
        <ul className="mt-14 grid gap-4 md:grid-cols-3">
          {PILLARS.map(({ icon: Icon, title, body }, i) => (
            <li key={title}>
              <Reveal delay={i * 110} className="h-full">
                <Spotlight className="glass-dark group h-full min-h-[300px] p-8">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-ink transition duration-500 group-hover:scale-110 group-hover:rotate-[-10deg]">
                    <Icon size={22} aria-hidden="true" />
                  </span>
                  <h3 className="mt-16 text-[26px] font-medium leading-tight tracking-[-0.03em] text-white">
                    {title}
                  </h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-white/60">{body}</p>
                </Spotlight>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** A mock window with a glowing edge, the way the reference shows its UI. */
function Window({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('relative', className)} aria-hidden="true">
      <div className="absolute -inset-6 animate-pulse rounded-[40px] bg-[radial-gradient(closest-side,rgb(var(--pv-violet-500)/0.35),transparent)] blur-xl" />
      <div className="glass-dark relative overflow-hidden p-5 sm:p-6">
        <div className="mb-4 flex gap-1.5">
          <i className="h-2.5 w-2.5 rounded-full bg-white/20" />
          <i className="h-2.5 w-2.5 rounded-full bg-white/20" />
          <i className="h-2.5 w-2.5 rounded-full bg-white/20" />
        </div>
        {children}
      </div>
    </div>
  );
}

function AgentMock() {
  return (
    <Window>
      <div className="relative">
        <div className="absolute -inset-px animate-pulse rounded-2xl bg-gradient-to-r from-violet-500/70 via-sky-400/60 to-violet-500/70 opacity-70 blur-[3px]" />
        <div className="relative rounded-2xl border border-violet-300/40 bg-black/80 p-4">
          <p className="text-[11px] font-semibold text-white/45">Agent prompt</p>
          <p className="mt-2 text-sm leading-relaxed text-white/85">
            You are <b className="text-white">Ava</b>, calling {'{{first_name}}'} about their solar
            quote. Qualify the roof and the bill, then offer a consult.
            <span className="ml-0.5 inline-block h-4 w-[2px] animate-blink bg-white align-middle" />
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {[
          'Goal: book consult',
          'Tone: warm',
          'English (US)',
          'Voice: Ava',
          'Model: GPT Realtime',
        ].map((t) => (
          <span
            key={t}
            className="rounded-pill border border-white/10 bg-white/[0.06] px-3 py-1 text-[11px] text-white/70"
          >
            {t}
          </span>
        ))}
      </div>
      <div className="mt-5 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
        <span className="flex items-center gap-2 text-xs text-white/70">
          <span className="h-2 w-2 animate-tick rounded-full bg-emerald-400" /> Agent live
        </span>
        <span className="rounded-pill bg-white px-3 py-1 text-[11px] font-semibold text-ink">
          Test call
        </span>
      </div>
    </Window>
  );
}

function CampaignMock() {
  const rows = [
    ['James K.', 'Calling…', 'bg-violet-400/15 text-violet-200'],
    ['Alison P.', 'Booked', 'bg-emerald-400/15 text-emerald-300'],
    ['Skylar S.', 'No answer · retry 2pm', 'bg-white/10 text-white/60'],
    ['Noah B.', 'Queued', 'bg-white/10 text-white/60'],
  ];
  return (
    <Window>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-white">October solar leads</p>
        <span className="rounded-pill bg-emerald-400/15 px-2.5 py-1 text-[10px] font-semibold text-emerald-300">
          Running
        </span>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-pill bg-white/10">
        <div className="h-full w-[68%] animate-shimmer rounded-pill bg-[linear-gradient(90deg,rgb(var(--pv-violet-500)),rgb(var(--pv-cyan-300)),rgb(var(--pv-violet-500)))] [background-size:200%_100%]" />
      </div>
      <p className="mt-2 text-[11px] text-white/45">
        340 of 500 contacts · calling 9am–6pm local time
      </p>
      <ul className="mt-4 space-y-2">
        {rows.map(([name, status, tone]) => (
          <li
            key={name}
            className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-brand text-[10px] font-bold text-white">
              {name!.slice(0, 1)}
            </span>
            <span className="font-semibold text-white">{name}</span>
            <span
              className={cn(
                'ml-auto rounded-pill px-2.5 py-0.5 text-[10px] font-semibold',
                tone,
                status === 'Calling…' && 'animate-pulse',
              )}
            >
              {status}
            </span>
          </li>
        ))}
      </ul>
    </Window>
  );
}

function CalendarMock() {
  return (
    <Window>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-white">October</p>
        <span className="flex items-center gap-1.5 text-[11px] text-white/50">
          <CalendarCheck size={12} /> Google Calendar synced
        </span>
      </div>
      <div className="mt-4 grid grid-cols-7 gap-2 text-center text-[11px]">
        {Array.from({ length: 28 }, (_, i) => {
          const picked = i === 12;
          const weekend = i % 7 > 4;
          return (
            <span
              key={i}
              className={cn(
                'rounded-xl py-2.5 transition',
                picked
                  ? 'animate-tick border border-violet-300/70 bg-violet-500/30 font-bold text-white shadow-[0_0_24px_rgb(var(--pv-violet-500)/0.7)]'
                  : weekend
                    ? 'border border-white/5 text-white/25'
                    : 'border border-white/10 bg-white/[0.04] text-white/65 hover:border-violet-300/40',
              )}
            >
              {i + 6}
            </span>
          );
        })}
      </div>
      <div className="mt-5 flex items-center gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-xs text-emerald-200">
        <Check size={14} /> Booked Tue 10:30 · Dana R. · invite sent
      </div>
    </Window>
  );
}

const ROWS = [
  {
    title: 'Your AI sales agent, always ready',
    body: 'Give each agent a persona, a goal and the knowledge it needs. Prompts adapt to every contact automatically, and you can test it on your own phone before it calls anyone.',
    cta: 'Build an agent',
    mock: <AgentMock />,
  },
  {
    title: 'Campaigns that run themselves',
    body: 'Upload a list and press start. Calls run inside your calling hours, retry no-answers and respect do-not-call requests, while you watch outcomes arrive.',
    cta: 'Launch a campaign',
    mock: <CampaignMock />,
  },
  {
    title: 'Meetings land in your calendar',
    body: 'Agents offer real open slots mid-call and send the invite before hanging up. Every call is transcribed, summarised and scored, so you only follow up where it counts.',
    cta: 'See booking in action',
    mock: <CalendarMock />,
  },
];

const EXTRAS = [
  {
    icon: PhoneCall,
    title: 'Inbound and outbound',
    body: 'One agent answers your number and runs your lists.',
  },
  {
    icon: ArrowLeftRight,
    title: 'Live call transfer',
    body: 'Warm hand-offs to your team the moment a human is needed.',
  },
  {
    icon: Webhook,
    title: 'Webhooks and API',
    body: 'Signed events and a REST API to wire calls into anything.',
  },
  {
    icon: Workflow,
    title: 'Automations',
    body: 'Notify Slack, send email or re-queue a lead when a call ends a certain way.',
  },
];

/** Alternating copy and glowing product mock-ups. */
export function FeatureRows() {
  return (
    <section className="py-section" aria-label="What it does">
      <div className="container space-y-24 sm:space-y-32">
        {ROWS.map((row, i) => (
          <div key={row.title} className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
            <Reveal variant={i % 2 ? 'right' : 'left'} className={cn(i % 2 === 1 && 'lg:order-2')}>
              <h3 className="text-[length:clamp(30px,4.2vw,54px)] font-medium leading-[1.04] tracking-[-0.04em] text-white">
                {row.title}
              </h3>
              <p className="mt-5 max-w-lg text-lead text-white/65">{row.body}</p>
              <Link href="/signup?plan=BASIC" className="btn btn-white btn-lg mt-8 gap-2">
                {row.cta}
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-black text-white">
                  <ArrowUpRight size={14} />
                </span>
              </Link>
            </Reveal>
            <Reveal variant="zoom" delay={120}>
              {row.mock}
            </Reveal>
          </div>
        ))}

        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {EXTRAS.map(({ icon: Icon, title, body }, i) => (
            <li key={title}>
              <Reveal delay={i * 80} className="h-full">
                <Spotlight className="glass-dark group h-full p-6">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition duration-300 group-hover:bg-white group-hover:text-ink">
                    <Icon size={18} aria-hidden="true" />
                  </span>
                  <h4 className="mt-4 text-[16px] font-semibold text-white">{title}</h4>
                  <p className="mt-1.5 text-sm leading-relaxed text-white/55">{body}</p>
                </Spotlight>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
