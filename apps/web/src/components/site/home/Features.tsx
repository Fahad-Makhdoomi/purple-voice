import { ArrowLeftRight, Check, PhoneCall, Webhook, Workflow } from 'lucide-react';
import { Reveal, Spotlight } from '@/components/site/motion';

/**
 * Bento feature cards: white cards whose top half is a pastel, gridded
 * "illustration" built from real UI fragments rather than images.
 */
function Art({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`grid-pattern relative h-56 overflow-hidden rounded-[calc(var(--pv-radius-lg)-6px)] bg-gradient-pastel ${className}`}
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-white/30" />
      <div className="relative h-full">{children}</div>
    </div>
  );
}

function Card({
  title,
  body,
  art,
  className = '',
}: {
  title: string;
  body: string;
  art: React.ReactNode;
  className?: string;
}) {
  return (
    <Reveal className={className}>
      <Spotlight className="h-full rounded-lg">
        <article className="h-full rounded-lg border border-line bg-surface p-2 shadow transition-shadow duration-300 hover:shadow-lg">
          {art}
          <div className="px-4 pb-5 pt-5">
            <h3 className="text-h3">{title}</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-muted">{body}</p>
          </div>
        </article>
      </Spotlight>
    </Reveal>
  );
}

const Pill = ({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) => (
  <span
    className={`inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-xs font-semibold shadow ${dark ? 'bg-ink text-white' : 'bg-white text-ink'}`}
  >
    {children}
  </span>
);

export function Features() {
  return (
    <section id="features" className="bg-canvas py-section">
      <div className="container">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">Product</p>
          <h2 className="mt-3 text-h1">Your sales floor, running itself</h2>
          <p className="mt-4 text-lead text-muted">
            Build an agent in minutes, point it at a list, and watch qualified conversations land in
            your calendar.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-5 md:grid-cols-6">
          <Card
            className="md:col-span-2"
            title="Personalised agents"
            body="Give each agent a persona, a goal and the knowledge it needs. Prompts adapt to every contact automatically."
            art={
              <Art>
                <div className="absolute left-1/2 top-8 w-60 -translate-x-1/2 rounded-sm bg-white/90 p-4 shadow">
                  <p className="text-[11px] font-semibold text-muted">Agent prompt</p>
                  <p className="mt-1.5 text-xs leading-relaxed text-ink">
                    You are <b>Ava</b>, calling {'{{first_name}}'} about their solar quote…
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {['Goal: book consult', 'Tone: warm', 'English (US)'].map((t) => (
                      <span
                        key={t}
                        className="rounded-pill bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-700"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
                  <Pill dark>
                    <span className="h-1.5 w-1.5 animate-tick rounded-full bg-success" /> Agent live
                  </Pill>
                </div>
              </Art>
            }
          />
          <Card
            className="md:col-span-2"
            title="Calling campaigns"
            body="Upload a list and launch. Calls run inside your calling hours, retry no-answers and respect do-not-call requests."
            art={
              <Art>
                {[
                  ['JK', 'James K.', 'left-[8%] top-8 -rotate-6'],
                  ['AP', 'Alison P.', 'left-1/2 top-5 -translate-x-1/2'],
                  ['SS', 'Skylar S.', 'right-[8%] top-8 rotate-6'],
                ].map(([initials, name, pos]) => (
                  <div
                    key={name}
                    className={`absolute w-24 rounded-sm bg-white p-2.5 text-center shadow ${pos}`}
                  >
                    <span className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-gradient-brand text-xs font-bold text-white">
                      {initials}
                    </span>
                    <p className="mt-1.5 text-[10px] font-semibold">{name}</p>
                    <p className="animate-pulse text-[9px] text-brand-600">Calling…</p>
                  </div>
                ))}
                <svg
                  className="absolute inset-x-0 top-[118px] h-12 w-full"
                  viewBox="0 0 300 48"
                  preserveAspectRatio="none"
                >
                  <path
                    d="M50 0 V24 H250 V0 M150 0 V40"
                    fill="none"
                    stroke="white"
                    strokeWidth="2"
                  />
                </svg>
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
                  <Pill dark>Campaign running</Pill>
                </div>
              </Art>
            }
          />
          <Card
            className="md:col-span-2"
            title="Appointment booking"
            body="Agents check your Google Calendar mid-call, offer open slots and send the invite before hanging up."
            art={
              <Art>
                <div className="absolute left-1/2 top-7 w-60 -translate-x-1/2 rounded-sm bg-white/95 p-3 shadow">
                  <p className="text-[11px] font-semibold">October</p>
                  <div className="mt-2 grid grid-cols-7 gap-1 text-center text-[9px] text-muted">
                    {Array.from({ length: 21 }, (_, i) => (
                      <span
                        key={i}
                        className={`rounded py-1 ${i === 9 ? 'animate-tick bg-ink font-bold text-white' : i % 7 > 4 ? 'text-subtle' : 'bg-brand-50'}`}
                      >
                        {i + 6}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
                  <Pill dark>
                    <Check size={12} /> Booked Tue 10:30
                  </Pill>
                </div>
              </Art>
            }
          />
          <Card
            className="md:col-span-3"
            title="Integrations"
            body="Bring your own numbers from Twilio, Plivo or SuperPhone. We run your agents on leading AI — OpenAI, Gemini or Claude — and you sync calendars and CRMs."
            art={
              <Art>
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                  <Pill>Purple Voice</Pill>
                </div>
                {[
                  ['Twilio', 'left-[8%] top-6'],
                  ['Plivo', 'right-[8%] top-6'],
                  ['OpenAI', 'left-[4%] top-[45%]'],
                  ['Claude', 'right-[4%] top-[45%]'],
                  ['Gemini', 'left-[16%] bottom-6'],
                  ['Calendar', 'right-[14%] bottom-6'],
                ].map(([name, pos]) => (
                  <span
                    key={name}
                    className={`absolute rounded-sm bg-white px-3 py-2 text-xs font-bold text-ink shadow ${pos}`}
                  >
                    {name}
                  </span>
                ))}
              </Art>
            }
          />
          <Card
            className="md:col-span-3"
            title="Summaries, transfers and insights"
            body="Every call is transcribed, summarised and scored. Hot prospects go straight to a human, and Pro shows what converts by agent, campaign and hour."
            art={
              <Art>
                <div className="absolute left-[6%] top-7 w-[min(330px,60%)] rotate-[-2deg] rounded-sm bg-white p-4 shadow">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold">Call summary</p>
                    <span className="rounded-pill bg-success/10 px-2 py-0.5 text-[10px] font-bold text-success">
                      Interested
                    </span>
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-muted">
                    Owns the home, bill ~$180/mo, south-facing roof. Asked about financing; wants a
                    call with an expert.
                  </p>
                  <div className="mt-3 h-1.5 rounded-pill bg-brand-50">
                    <div className="h-full w-4/5 animate-shimmer rounded-pill bg-[linear-gradient(90deg,rgb(var(--pv-violet-600)),rgb(var(--pv-violet-300)),rgb(var(--pv-violet-600)))] [background-size:200%_100%]" />
                  </div>
                </div>
                <div className="absolute bottom-8 right-[8%] rotate-[3deg]">
                  <Pill dark>
                    <ArrowLeftRight size={12} /> Transferred to Sam
                  </Pill>
                </div>
                <div className="absolute right-[10%] top-8 hidden w-36 rounded-sm bg-white p-3 shadow sm:block">
                  <p className="text-[10px] text-muted">Connect rate</p>
                  <p className="num text-xl font-semibold">73%</p>
                  <div className="mt-1.5 h-1 rounded-pill bg-brand-50">
                    <div className="h-full w-[73%] animate-shimmer rounded-pill bg-[linear-gradient(90deg,rgb(var(--pv-violet-600)),rgb(var(--pv-violet-300)),rgb(var(--pv-violet-600)))] [background-size:200%_100%]" />
                  </div>
                </div>
              </Art>
            }
          />
        </div>

        <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: PhoneCall,
              title: 'Inbound and outbound',
              body: 'Answer every call to your number and run outbound lists from the same agent.',
            },
            {
              icon: ArrowLeftRight,
              title: 'Live call transfer',
              body: 'Hand warm calls to your team the moment a human is needed.',
            },
            {
              icon: Webhook,
              title: 'Webhooks and API',
              body: 'Signed events and a REST API to wire calls into anything.',
            },
            {
              icon: Workflow,
              title: 'Automations',
              body: 'When a call ends a certain way, notify Slack, email or re-queue the lead.',
            },
          ].map(({ icon: Icon, title, body }, i) => (
            <li key={title}>
              <Reveal delay={i * 90} className="group flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700 transition duration-300 group-hover:scale-110 group-hover:bg-ink group-hover:text-white">
                  <Icon size={18} aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-[15px] font-semibold">{title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{body}</p>
                </div>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
