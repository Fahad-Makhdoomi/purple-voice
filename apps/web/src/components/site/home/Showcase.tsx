import {
  ArrowLeftRight,
  CalendarCheck,
  Check,
  Lock,
  PhoneCall,
  Webhook,
  Workflow,
} from 'lucide-react';
import { Reveal, Spotlight } from '@/components/site/motion';
import { cn } from '@/lib/cn';

/** A small product window inside a bento tile; it lifts when the tile is hovered. */
function Window({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('relative', className)} aria-hidden="true">
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition duration-500 group-hover:-translate-y-1 sm:p-5">
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
        {['Goal: book consult', 'Tone: warm', 'English (US)', 'Voice: Ava'].map((t) => (
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
              {i + 4}
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

const SMALL = [
  {
    icon: PhoneCall,
    title: 'Inbound and outbound',
    body: 'One agent answers your number and works your lists.',
  },
  {
    icon: ArrowLeftRight,
    title: 'Live transfer',
    body: 'Hot leads go straight to your team, summary already written.',
  },
  {
    icon: Workflow,
    title: 'Automations',
    body: 'Notify Slack, send an email or re-queue a lead when a call ends.',
  },
  {
    icon: Webhook,
    title: 'Webhooks and API',
    body: 'Signed events and a REST API to wire calls into anything.',
  },
];

const TRUST = [
  'Encrypted keys and tokens',
  'Signed webhooks and callbacks',
  'Do-not-call lists respected',
  'Card details never stored',
];

function Tile({
  title,
  body,
  children,
  className,
  delay = 0,
}: {
  title: string;
  body: string;
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <Reveal delay={delay} className={cn('h-full', className)}>
      <Spotlight className="glass-dark bento-tile group flex h-full flex-col p-6 sm:p-8">
        <h3 className="text-[length:clamp(22px,2.4vw,28px)] font-medium leading-tight tracking-[-0.03em] text-white">
          {title}
        </h3>
        <p className="mt-2 max-w-md text-[15px] leading-relaxed text-white/60">{body}</p>
        <div className="mt-6 flex-1">{children}</div>
      </Spotlight>
    </Reveal>
  );
}

/**
 * Everything the product does in one bento grid: three live mock-ups, four
 * smaller features and the safeguards, in place of long alternating rows.
 */
export function Features() {
  return (
    <section id="features" className="scroll-mt-24 py-section" aria-labelledby="features-title">
      <div className="container">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="eyebrow text-brand-300">Features</p>
          <h2
            id="features-title"
            className="mt-3 text-[length:clamp(34px,5vw,60px)] font-medium leading-[1.03] tracking-[-0.04em] text-white"
          >
            Everything a calling team does. None of the hiring.
          </h2>
        </Reveal>

        <div className="mt-12 grid gap-4 lg:grid-cols-6">
          <Tile
            className="lg:col-span-3"
            title="Agents you build in minutes"
            body="A persona, a goal and your knowledge. Pick a voice, then test it on your own phone."
          >
            <AgentMock />
          </Tile>
          <Tile
            className="lg:col-span-3"
            delay={100}
            title="Campaigns that run themselves"
            body="Upload a list and press start. It calls within your hours and retries no-answers."
          >
            <CampaignMock />
          </Tile>
          <Tile
            className="lg:col-span-4"
            title="Booked straight into your calendar"
            body="It offers real open slots mid-call and sends the invite before hanging up."
          >
            <CalendarMock />
          </Tile>
          <Reveal delay={100} className="h-full lg:col-span-2">
            <ul className="grid h-full gap-4">
              {SMALL.map(({ icon: Icon, title, body }) => (
                <li key={title}>
                  <Spotlight className="glass-dark bento-tile group flex h-full items-start gap-4 p-5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-ink transition duration-300 group-hover:-rotate-6 group-hover:scale-110">
                      <Icon size={18} aria-hidden="true" />
                    </span>
                    <span>
                      <span className="block text-[15px] font-semibold text-white">{title}</span>
                      <span className="mt-1 block text-sm leading-relaxed text-white/55">
                        {body}
                      </span>
                    </span>
                  </Spotlight>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>

        <Reveal className="mt-8">
          <ul
            className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-[13px] text-white/55"
            aria-label="Safeguards"
          >
            <li className="flex items-center gap-1.5 font-semibold text-white/80">
              <Lock size={14} aria-hidden="true" /> Built to be trusted
            </li>
            {TRUST.map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <Check size={14} className="text-emerald-400" aria-hidden="true" /> {t}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
