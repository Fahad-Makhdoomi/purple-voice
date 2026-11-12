import { ArrowLeftRight, Check, Lock, PhoneCall, Webhook, Workflow } from 'lucide-react';
import { Reveal } from '@/components/site/motion';
import { cn } from '@/lib/cn';

/** A flat product panel inside a feature tile: the dashboard's own surfaces, no fake window chrome. */
function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn('rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5', className)}
      aria-hidden="true"
    >
      {children}
    </div>
  );
}

function AgentMock() {
  return (
    <Panel>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
        {[
          ['Name', 'Ava'],
          ['Voice', 'Warm · US English'],
          ['Goal', 'Book a consult'],
          ['Hands off to', 'Sales team, 9–6'],
        ].map(([k, v]) => (
          <div key={k}>
            <dt className="text-white/45">{k}</dt>
            <dd className="mt-0.5 font-semibold text-white">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 rounded-xl border border-white/10 bg-black/40 p-3.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/45">
          Instructions
        </p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-white/80">
          Call{' '}
          <span className="rounded bg-white/10 px-1 font-mono text-[12px]">{'{{first_name}}'}</span>{' '}
          about their solar quote. Confirm roof type and monthly bill, give the price range, then
          offer a 20-minute consult.
        </p>
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-white/55">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Knowledge: pricing.pdf, faq.md
      </div>
    </Panel>
  );
}

function CampaignMock() {
  const rows: Array<[string, string, string, string]> = [
    ['James K.', '2:41', 'Booked', 'text-emerald-300'],
    ['Alison P.', '1:12', 'Call back Fri', 'text-white/70'],
    ['Skylar S.', '—', 'No answer · retry 2 pm', 'text-white/45'],
    ['Noah B.', '3:05', 'Transferred', 'text-sky-300'],
  ];
  return (
    <Panel>
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-semibold text-white">October solar leads</p>
        <p className="num text-xs text-white/50">340 / 500 called</p>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full w-[68%] rounded-full bg-brand-500" />
      </div>
      <table className="mt-4 w-full text-left text-xs">
        <thead className="text-white/40">
          <tr>
            <th className="pb-2 font-medium">Contact</th>
            <th className="pb-2 font-medium">Length</th>
            <th className="pb-2 text-right font-medium">Result</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {rows.map(([name, len, result, tone]) => (
            <tr key={name}>
              <td className="py-2.5 font-semibold text-white">{name}</td>
              <td className="num py-2.5 text-white/55">{len}</td>
              <td className={cn('py-2.5 text-right font-medium', tone)}>{result}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

const DAYS = ['Mon 10', 'Tue 11', 'Wed 12', 'Thu 13'];
const SLOTS = ['9:00', '10:30', '12:00', '15:30'];
/** [day, slot] pairs already taken in the calendar. */
const BUSY = new Set(['0-0', '0-2', '1-2', '2-1', '2-3', '3-0', '3-2']);

function CalendarMock() {
  return (
    <Panel>
      <div className="flex items-center justify-between text-xs">
        <p className="text-sm font-semibold text-white">Free slots offered on the call</p>
        <p className="text-white/50">Google Calendar</p>
      </div>
      <div className="mt-4 grid grid-cols-[44px_repeat(4,1fr)] gap-1.5 text-center text-[11px]">
        <span />
        {DAYS.map((d) => (
          <span key={d} className="pb-1 font-semibold text-white/60">
            {d}
          </span>
        ))}
        {SLOTS.map((s, si) => (
          <div key={s} className="contents">
            <span className="py-2 text-right font-mono text-white/40">{s}</span>
            {DAYS.map((d, di) => {
              const picked = di === 1 && si === 1;
              const busy = BUSY.has(`${di}-${si}`);
              return (
                <span
                  key={d}
                  className={cn(
                    'rounded-lg py-2',
                    picked
                      ? 'bg-brand-600 font-semibold text-white'
                      : busy
                        ? 'bg-white/[0.04] text-white/25 line-through'
                        : 'border border-white/10 text-white/70',
                  )}
                >
                  {picked ? 'Dana R.' : busy ? 'Busy' : 'Free'}
                </span>
              );
            })}
          </div>
        ))}
      </div>
      <p className="mt-4 flex items-center gap-2 text-xs text-emerald-300">
        <Check size={14} aria-hidden="true" /> Tue 10:30 booked · invite sent to dana@…
      </p>
    </Panel>
  );
}

const MORE = [
  {
    icon: PhoneCall,
    title: 'Inbound and outbound',
    body: 'The same agent answers your number and works your lists.',
  },
  {
    icon: ArrowLeftRight,
    title: 'Live transfer',
    body: 'Hot leads go straight to a person, with the summary already written.',
  },
  {
    icon: Workflow,
    title: 'Automations',
    body: 'Post to Slack, send an email or re-queue a lead when a call ends.',
  },
  {
    icon: Webhook,
    title: 'Webhooks and API',
    body: 'Signed events and a REST API to wire calls into anything.',
  },
];

const TRUST = [
  'Keys and tokens encrypted at rest',
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
      <div className="glass-dark flex h-full flex-col p-6 sm:p-8">
        <h3 className="text-[length:clamp(21px,2.2vw,26px)] font-medium leading-tight tracking-[-0.025em] text-white">
          {title}
        </h3>
        <p className="mt-2 max-w-md text-[15px] leading-relaxed text-white/60">{body}</p>
        <div className="mt-6 flex-1">{children}</div>
      </div>
    </Reveal>
  );
}

/**
 * What the product does: three tiles that show the actual screens (agent,
 * campaign, booking), then the rest as a plain list.
 */
export function Features() {
  return (
    <section id="features" className="scroll-mt-24 py-section" aria-labelledby="features-title">
      <div className="container">
        <Reveal className="max-w-2xl">
          <p className="eyebrow text-brand-300">Features</p>
          <h2
            id="features-title"
            className="mt-3 text-[length:clamp(34px,5vw,60px)] font-medium leading-[1.03] tracking-[-0.04em] text-white"
          >
            Everything a calling team does. None of the hiring.
          </h2>
        </Reveal>

        <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Tile
            title="Set up an agent in minutes"
            body="Give it a name, a goal and your documents, pick a voice, then test it on your own phone."
          >
            <AgentMock />
          </Tile>
          <Tile
            delay={80}
            title="Campaigns that run themselves"
            body="Upload a list and press start. It calls within your hours and retries the ones who didn't pick up."
          >
            <CampaignMock />
          </Tile>
          <Tile
            delay={160}
            className="md:col-span-2 xl:col-span-1"
            title="Booked into your calendar"
            body="It only offers times you're actually free and sends the invite before it hangs up."
          >
            <CalendarMock />
          </Tile>
        </div>

        <Reveal className="mt-4">
          <ul className="glass-dark grid divide-y divide-white/10 p-2 sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4">
            {MORE.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex items-start gap-3 p-5">
                <Icon size={18} className="mt-0.5 shrink-0 text-brand-300" aria-hidden="true" />
                <span>
                  <span className="block text-[15px] font-semibold text-white">{title}</span>
                  <span className="mt-1 block text-sm leading-relaxed text-white/55">{body}</span>
                </span>
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal className="mt-8">
          <ul
            className="flex flex-wrap items-center gap-x-6 gap-y-3 text-[13px] text-white/55"
            aria-label="Safeguards"
          >
            <li className="flex items-center gap-1.5 font-semibold text-white/80">
              <Lock size={14} aria-hidden="true" /> Security
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
