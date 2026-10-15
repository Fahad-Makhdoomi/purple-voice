import type { Metadata } from 'next';
import { PageIntro } from '@/components/site/shared/PageIntro';
import { FaqList, faqJsonLd } from '@/components/site/shared/FaqList';
import { CtaBand } from '@/components/site/shared/CtaBand';
import { JsonLd } from '@/components/site/JsonLd';
import { getFaqs } from '@/lib/server-api';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'FAQ',
  description:
    'How Purple Voice works: numbers, AI models, minutes, billing, appointment booking, call transfer and compliance.',
  alternates: { canonical: '/faq' },
};

export default async function FaqPage() {
  const faqs = await getFaqs();
  const groups = Object.entries(
    faqs.reduce<Record<string, typeof faqs>>((acc, f) => {
      (acc[f.category] ??= []).push(f);
      return acc;
    }, {}),
  );

  return (
    <>
      {faqs.length > 0 && <JsonLd data={faqJsonLd(faqs)} />}
      <PageIntro
        eyebrow="FAQ"
        title="Questions, answered"
        lead="Can't find what you need? Write to us from the contact page."
      />
      <section className="bg-canvas pb-section">
        <div className="container max-w-3xl space-y-12">
          {groups.map(([category, items]) => (
            <div key={category}>
              <h2 className="mb-4 text-h3">{category}</h2>
              <FaqList faqs={items} />
            </div>
          ))}
          {!groups.length && <FaqList faqs={[]} />}
        </div>
      </section>
      <CtaBand />
    </>
  );
}
