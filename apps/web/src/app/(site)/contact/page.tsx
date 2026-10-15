import type { Metadata } from 'next';
import { Building2, Mail, MessageSquare } from 'lucide-react';
import { PageIntro } from '@/components/site/shared/PageIntro';
import { ContactForm } from '@/components/site/ContactForm';
import { getSettings } from '@/lib/server-api';

export const metadata: Metadata = {
  title: 'Contact',
  description:
    'Talk to the Purple Voice team about Enterprise, custom call flows or anything else.',
  alternates: { canonical: '/contact' },
};

type Props = { searchParams: Promise<{ plan?: string }> };

export default async function ContactPage({ searchParams }: Props) {
  const [{ plan }, settings] = await Promise.all([searchParams, getSettings()]);
  const enterprise = plan === 'ENTERPRISE';
  return (
    <>
      <PageIntro
        eyebrow={enterprise ? 'Enterprise' : 'Contact'}
        title={enterprise ? 'A voice system built around your team' : 'Talk to us'}
        lead={
          enterprise
            ? 'We design, deploy and maintain the whole system for you — agents, call flows, integrations and infrastructure.'
            : 'Questions about plans, setup or a custom build? We usually reply within one business day.'
        }
      />
      <section className="bg-canvas pb-section">
        <div className="container grid max-w-5xl gap-10 lg:grid-cols-[1fr_1.6fr]">
          <aside className="space-y-6 pt-2">
            {[
              {
                icon: Building2,
                title: 'Enterprise builds',
                body: 'Custom agents and flows, dedicated capacity, SLAs and integrations with your stack.',
              },
              {
                icon: MessageSquare,
                title: 'Already a customer?',
                body: 'Open a ticket from your dashboard for the fastest help — Pro tickets jump the queue.',
              },
              { icon: Mail, title: 'Email', body: settings.seo.contactEmail },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                  <Icon size={18} aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-[15px] font-semibold">{title}</h2>
                  <p className="mt-1 text-sm text-muted">{body}</p>
                </div>
              </div>
            ))}
          </aside>
          <ContactForm
            plan={plan}
            captcha={{
              provider: settings.captcha.provider,
              enabled: !!settings.captcha.forms.contact,
            }}
          />
        </div>
      </section>
    </>
  );
}
