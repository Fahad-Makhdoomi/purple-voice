import { Plus } from 'lucide-react';
import type { Faq } from '@/lib/server-api';

/** Accordion built on <details>: works without JavaScript and is fully keyboard accessible. */
export function FaqList({ faqs, tone = 'light' }: { faqs: Faq[]; tone?: 'light' | 'dark' }) {
  const dark = tone === 'dark';
  if (!faqs.length)
    return (
      <p className={dark ? 'text-center text-white/55' : 'text-center text-muted'}>
        Questions are on their way.
      </p>
    );
  return (
    <div
      className={
        dark
          ? 'glass-dark divide-y divide-white/10'
          : 'divide-y divide-line rounded-lg border border-line bg-surface'
      }
    >
      {faqs.map((faq) => (
        <details
          key={faq.id}
          className="group px-6 py-1 [&_summary::-webkit-details-marker]:hidden"
        >
          <summary
            className={`flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-left text-[15px] font-semibold ${dark ? 'text-white' : 'text-ink'}`}
          >
            {faq.question}
            <Plus
              size={18}
              className={`shrink-0 transition group-open:rotate-45 ${dark ? 'text-brand-300' : 'text-brand-600'}`}
              aria-hidden="true"
            />
          </summary>
          <p
            className={`pb-6 pr-10 text-[15px] leading-relaxed ${dark ? 'text-white/60' : 'text-muted'}`}
          >
            {faq.answer}
          </p>
        </details>
      ))}
    </div>
  );
}

export function faqJsonLd(faqs: Faq[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };
}
