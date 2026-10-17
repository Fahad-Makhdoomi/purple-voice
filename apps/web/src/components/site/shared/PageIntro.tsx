/** Title block for light inner pages (pricing, FAQ, blog, contact, legal). */
export function PageIntro({
  eyebrow,
  title,
  lead,
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
}) {
  return (
    <section className="page-intro relative isolate overflow-hidden bg-gradient-wash pb-16 pt-[calc(var(--pv-header-h)+72px)]">
      <div className="container max-w-3xl text-center">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="mt-3 text-h1">{title}</h1>
        {lead && <p className="mt-5 text-lead text-ink-soft">{lead}</p>}
      </div>
    </section>
  );
}
