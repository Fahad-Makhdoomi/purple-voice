import Image from 'next/image';
import Link from 'next/link';
import {
  Bot,
  CalendarDays,
  ChartNoAxesCombined,
  Check,
  Clock,
  Globe,
  Headphones,
  Heart,
  Lock,
  Mail,
  MessageSquare,
  Phone,
  PhoneIncoming,
  Quote,
  Rocket,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { parseVideoUrl, type BlockIcon, type PageBlock, type PageBlockOf } from '@pv/shared';
import { Markdown } from '@/components/site/Markdown';
import { Reveal } from '@/components/site/motion';
import { PricingCards } from '@/components/site/pricing/PricingCards';
import { FaqList } from '@/components/site/shared/FaqList';
import { ContactForm } from '@/components/site/ContactForm';
import type { CaptchaProvider } from '@/components/forms/useCaptcha';
import type { Faq, PublicPlan } from '@/lib/server-api';
import { cn } from '@/lib/cn';

/**
 * Renders page-builder blocks (Admin → Pages → Builder). Shared by the public
 * page and the builder's live preview, so what staff see is what visitors
 * get. Every block is data rendered by these components: no HTML from the
 * CMS ever reaches the page. Colours come from the theme's tokens.
 */

const ICONS: Record<BlockIcon, LucideIcon> = {
  phone: Phone,
  'phone-incoming': PhoneIncoming,
  calendar: CalendarDays,
  bot: Bot,
  chart: ChartNoAxesCombined,
  shield: ShieldCheck,
  zap: Zap,
  clock: Clock,
  globe: Globe,
  users: Users,
  message: MessageSquare,
  mail: Mail,
  star: Star,
  check: Check,
  sparkles: Sparkles,
  headphones: Headphones,
  rocket: Rocket,
  lock: Lock,
  heart: Heart,
  target: Target,
};

export interface BlockData {
  plans: PublicPlan[];
  faqs: Faq[];
  captcha: { provider: CaptchaProvider; enabled: boolean };
  /** In the builder: forms are inert and every block is visible at once. */
  preview?: boolean;
}

const BACKGROUNDS: Record<PageBlock['style']['background'], string> = {
  none: '',
  muted: 'bg-canvas',
  brand: 'bg-brand-50',
  dark: 'bg-night text-white',
  gradient: 'bg-gradient-brand text-white',
};
const PADDING: Record<PageBlock['style']['padding'], string> = {
  none: 'py-0',
  sm: 'py-10',
  md: 'py-16 sm:py-20',
  lg: 'py-24 sm:py-32',
};
const WIDTH = { narrow: 'max-w-narrow', normal: '', wide: 'max-w-7xl' } as const;
const ANIMATION = { rise: 'up', zoom: 'zoom', blur: 'blur', fade: 'fade' } as const;

const onColor = (b: PageBlock) =>
  b.style.background === 'dark' || b.style.background === 'gradient';

function Animated({
  block,
  delay = 0,
  as: Tag = 'div',
  className,
  children,
}: {
  block: PageBlock;
  delay?: number;
  as?: 'div' | 'li';
  className?: string;
  children: React.ReactNode;
}) {
  if (block.style.animation === 'none') return <Tag className={className}>{children}</Tag>;
  return (
    <Reveal as={Tag} variant={ANIMATION[block.style.animation]} delay={delay} className={className}>
      {children}
    </Reveal>
  );
}

function Heading({
  block,
  title,
  subtitle,
  as = 'h2',
}: {
  block: PageBlock;
  title: string;
  subtitle?: string;
  as?: 'h1' | 'h2';
}) {
  if (!title && !subtitle) return null;
  const Tag = as;
  const center = block.style.align === 'center';
  return (
    <Animated block={block} className={cn('mb-10 max-w-3xl', center && 'mx-auto text-center')}>
      {title && <Tag className={as === 'h1' ? 'text-h1' : 'text-h2'}>{title}</Tag>}
      {subtitle && (
        <p className={cn('mt-4 text-lead', onColor(block) ? 'text-white/75' : 'text-ink-soft')}>
          {subtitle}
        </p>
      )}
    </Animated>
  );
}

function Button({
  b,
  variant,
  dark,
}: {
  b: { label: string; href: string };
  variant: 'primary' | 'secondary';
  dark: boolean;
}) {
  if (!b.label || !b.href) return null;
  const cls =
    variant === 'primary'
      ? dark
        ? 'btn btn-white btn-lg'
        : 'btn btn-primary btn-lg'
      : dark
        ? 'btn btn-dark btn-lg'
        : 'btn btn-secondary btn-lg';
  return /^https:\/\//.test(b.href) ? (
    <a href={b.href} className={cls} target="_blank" rel="noopener noreferrer">
      {b.label}
    </a>
  ) : (
    <Link href={b.href} className={cls}>
      {b.label}
    </Link>
  );
}

function Picture({
  src,
  alt,
  className,
  sizes,
}: {
  src: string;
  alt: string;
  className?: string;
  sizes: string;
}) {
  if (!src) return null;
  return (
    <div className={cn('relative overflow-hidden rounded-xl', className)}>
      <Image src={src} alt={alt} fill sizes={sizes} className="object-cover" />
    </div>
  );
}

function Hero({ block }: { block: PageBlockOf<'hero'> }) {
  const dark = onColor(block);
  const split = block.layout === 'split' && !!block.imageUrl;
  const center = block.style.align === 'center' && !split;
  return (
    <div className={cn(split && 'grid items-center gap-12 lg:grid-cols-2')}>
      <Animated block={block} className={cn(center && 'mx-auto max-w-4xl text-center')}>
        {block.eyebrow && <p className="eyebrow">{block.eyebrow}</p>}
        {block.title && <h1 className="mt-3 text-h1">{block.title}</h1>}
        {block.subtitle && (
          <p className={cn('mt-6 text-lead', dark ? 'text-white/75' : 'text-ink-soft')}>
            {block.subtitle}
          </p>
        )}
        <div className={cn('mt-9 flex flex-wrap gap-3', center && 'justify-center')}>
          <Button b={block.primary} variant="primary" dark={dark} />
          <Button b={block.secondary} variant="secondary" dark={dark} />
        </div>
      </Animated>
      {block.imageUrl && (
        <Animated block={block} delay={120} className={cn(!split && 'mx-auto mt-14 max-w-5xl')}>
          <Picture
            src={block.imageUrl}
            alt={block.imageAlt}
            className="aspect-[16/10] shadow-lg"
            sizes="(min-width: 1024px) 50vw, 100vw"
          />
        </Animated>
      )}
    </div>
  );
}

const GRID = {
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-2 lg:grid-cols-3',
  4: 'md:grid-cols-2 lg:grid-cols-4',
};

function Features({ block }: { block: PageBlockOf<'features'> }) {
  const dark = onColor(block);
  return (
    <>
      <Heading block={block} title={block.title} subtitle={block.subtitle} />
      <ul className={cn('grid gap-5', GRID[block.columns])}>
        {block.items.map((item, i) => {
          const Icon = ICONS[item.icon] ?? Sparkles;
          return (
            <Animated
              key={i}
              as="li"
              block={block}
              delay={i * 90}
              className={cn(
                'h-full rounded-xl p-6',
                dark ? 'bg-white/10' : 'border border-line bg-surface shadow-sm',
              )}
            >
              <span
                className={cn(
                  'flex h-11 w-11 items-center justify-center rounded-lg',
                  dark ? 'bg-white/15 text-white' : 'bg-brand-50 text-brand-700',
                )}
              >
                <Icon size={20} aria-hidden="true" />
              </span>
              <h3 className="mt-5 text-lg font-semibold">{item.title}</h3>
              <p className={cn('mt-2 leading-relaxed', dark ? 'text-white/75' : 'text-ink-soft')}>
                {item.text}
              </p>
            </Animated>
          );
        })}
      </ul>
    </>
  );
}

function ImageText({ block }: { block: PageBlockOf<'imageText'> }) {
  const dark = onColor(block);
  return (
    <div className="grid items-center gap-12 lg:grid-cols-2">
      <Animated block={block} className={cn(block.imageSide === 'left' && 'lg:order-2')}>
        {block.title && <h2 className="text-h2">{block.title}</h2>}
        {block.markdown && (
          <div className={cn('mt-5', dark && '[&_.prose-pv]:text-white/80')}>
            <Markdown>{block.markdown}</Markdown>
          </div>
        )}
        <div className="mt-8">
          <Button b={block.button} variant="primary" dark={dark} />
        </div>
      </Animated>
      <Animated
        block={block}
        delay={120}
        className={cn(block.imageSide === 'left' && 'lg:order-1')}
      >
        {block.imageUrl ? (
          <Picture
            src={block.imageUrl}
            alt={block.imageAlt}
            className="aspect-[4/3] shadow-lg"
            sizes="(min-width: 1024px) 50vw, 100vw"
          />
        ) : (
          <div className="aspect-[4/3] rounded-xl bg-gradient-pastel" />
        )}
      </Animated>
    </div>
  );
}

function Stats({ block }: { block: PageBlockOf<'stats'> }) {
  const dark = onColor(block);
  return (
    <>
      <Heading block={block} title={block.title} />
      <dl
        className={cn(
          'grid gap-6',
          block.items.length > 3 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-3',
        )}
      >
        {block.items.map((s, i) => (
          <Animated
            key={i}
            block={block}
            delay={i * 90}
            className={cn(
              'flex flex-col',
              block.style.align === 'center' && 'items-center text-center',
            )}
          >
            <dt className={cn('order-2 mt-2 text-sm', dark ? 'text-white/70' : 'text-muted')}>
              {s.label}
            </dt>
            <dd className="num text-[length:clamp(36px,5vw,56px)] font-medium leading-none tracking-tight">
              {s.value}
            </dd>
          </Animated>
        ))}
      </dl>
    </>
  );
}

function Steps({ block }: { block: PageBlockOf<'steps'> }) {
  const dark = onColor(block);
  return (
    <>
      <Heading block={block} title={block.title} subtitle={block.subtitle} />
      <ol className="grid gap-5 md:grid-cols-3">
        {block.items.map((s, i) => (
          <Animated
            key={i}
            as="li"
            block={block}
            delay={i * 110}
            className={cn(
              'h-full rounded-xl p-6',
              dark ? 'bg-white/10' : 'border border-line bg-surface',
            )}
          >
            <span
              className={cn(
                'num flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold',
                dark ? 'bg-white text-ink' : 'bg-gradient-brand text-white',
              )}
            >
              {i + 1}
            </span>
            <h3 className="mt-5 text-lg font-semibold">{s.title}</h3>
            <p className={cn('mt-2 leading-relaxed', dark ? 'text-white/75' : 'text-ink-soft')}>
              {s.text}
            </p>
          </Animated>
        ))}
      </ol>
    </>
  );
}

function Testimonials({ block }: { block: PageBlockOf<'testimonials'> }) {
  const dark = onColor(block);
  return (
    <>
      <Heading block={block} title={block.title} />
      <ul
        className={cn(
          'grid gap-5',
          block.items.length > 1 && 'md:grid-cols-2',
          block.items.length > 2 && 'lg:grid-cols-3',
        )}
      >
        {block.items.map((t, i) => (
          <Animated
            key={i}
            as="li"
            block={block}
            delay={i * 90}
            className={cn(
              'flex h-full flex-col rounded-xl p-6',
              dark ? 'bg-white/10' : 'border border-line bg-surface shadow-sm',
            )}
          >
            <Quote
              size={22}
              className={dark ? 'text-white/50' : 'text-brand-400'}
              aria-hidden="true"
            />
            <figure className="contents">
              <blockquote className="mt-4 flex-1 text-lg leading-relaxed">“{t.quote}”</blockquote>
              <figcaption className="mt-6 flex items-center gap-3">
                {t.avatarUrl ? (
                  <span className="relative h-10 w-10 overflow-hidden rounded-full">
                    <Image src={t.avatarUrl} alt="" fill sizes="40px" className="object-cover" />
                  </span>
                ) : (
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-brand text-sm font-bold text-white">
                    {t.name.slice(0, 1)}
                  </span>
                )}
                <span>
                  <span className="block font-semibold">{t.name}</span>
                  <span className={cn('text-sm', dark ? 'text-white/65' : 'text-muted')}>
                    {t.role}
                  </span>
                </span>
              </figcaption>
            </figure>
          </Animated>
        ))}
      </ul>
    </>
  );
}

function Logos({ block }: { block: PageBlockOf<'logos'> }) {
  return (
    <>
      {block.title && (
        <p className="mb-8 text-center text-xs font-semibold uppercase tracking-[0.16em] text-muted">
          {block.title}
        </p>
      )}
      <Animated block={block}>
        <ul className="flex flex-wrap items-center justify-center gap-x-12 gap-y-8">
          {block.items.map((l, i) => {
            if (!l.imageUrl) return null;
            const img = (
              <span className="relative block h-9 w-32 opacity-70 grayscale transition hover:opacity-100 hover:grayscale-0">
                <Image src={l.imageUrl} alt={l.alt} fill sizes="128px" className="object-contain" />
              </span>
            );
            return (
              <li key={i}>
                {l.href ? (
                  <a href={l.href} target="_blank" rel="noopener noreferrer">
                    {img}
                  </a>
                ) : (
                  img
                )}
              </li>
            );
          })}
        </ul>
      </Animated>
    </>
  );
}

function Gallery({ block }: { block: PageBlockOf<'gallery'> }) {
  return (
    <>
      <Heading block={block} title={block.title} />
      <ul className={cn('grid gap-4', GRID[block.columns])}>
        {block.items.map((g, i) =>
          g.imageUrl ? (
            <Animated key={i} as="li" block={block} delay={i * 70}>
              <figure>
                <Picture
                  src={g.imageUrl}
                  alt={g.alt}
                  className="aspect-[4/3]"
                  sizes="(min-width: 1024px) 33vw, 100vw"
                />
                {g.caption && (
                  <figcaption className="mt-2 text-sm text-muted">{g.caption}</figcaption>
                )}
              </figure>
            </Animated>
          ) : null,
        )}
      </ul>
    </>
  );
}

function Video({ block }: { block: PageBlockOf<'video'> }) {
  const video = block.url ? parseVideoUrl(block.url) : null;
  return (
    <>
      <Heading block={block} title={block.title} />
      <Animated block={block}>
        {video ? (
          <div className="relative mx-auto aspect-video max-w-5xl overflow-hidden rounded-xl bg-black shadow-lg">
            <iframe
              src={video.embedUrl}
              title={block.title || 'Video'}
              loading="lazy"
              allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              referrerPolicy="strict-origin-when-cross-origin"
              className="absolute inset-0 h-full w-full"
            />
          </div>
        ) : (
          <div className="mx-auto flex aspect-video max-w-5xl items-center justify-center rounded-xl bg-canvas text-sm text-muted">
            Add a YouTube or Vimeo link
          </div>
        )}
        {block.caption && <p className="mt-3 text-center text-sm text-muted">{block.caption}</p>}
      </Animated>
    </>
  );
}

function FaqBlock({ block, faqs }: { block: PageBlockOf<'faq'>; faqs: Faq[] }) {
  const items =
    block.source === 'site'
      ? faqs.filter((f) => !block.category || f.category === block.category)
      : block.items
          .filter((f) => f.question && f.answer)
          .map((f, i) => ({ id: String(i), question: f.question, answer: f.answer, category: '' }));
  return (
    <div className="mx-auto max-w-3xl">
      <Heading block={block} title={block.title} />
      <Animated block={block}>
        <FaqList faqs={items} tone={onColor(block) ? 'dark' : 'light'} />
      </Animated>
    </div>
  );
}

function Cta({ block }: { block: PageBlockOf<'cta'> }) {
  const dark = onColor(block);
  return (
    <Animated
      block={block}
      className={cn('mx-auto max-w-3xl', block.style.align === 'center' && 'text-center')}
    >
      {block.title && <h2 className="text-h2">{block.title}</h2>}
      {block.text && (
        <p className={cn('mt-4 text-lead', dark ? 'text-white/80' : 'text-ink-soft')}>
          {block.text}
        </p>
      )}
      <div
        className={cn(
          'mt-8 flex flex-wrap gap-3',
          block.style.align === 'center' && 'justify-center',
        )}
      >
        <Button b={block.primary} variant="primary" dark={dark} />
        <Button b={block.secondary} variant="secondary" dark={dark} />
      </div>
    </Animated>
  );
}

function Contact({ block, data }: { block: PageBlockOf<'contact'>; data: BlockData }) {
  return (
    <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-[1fr_1.4fr]">
      <Animated block={block}>
        {block.title && <h2 className="text-h2">{block.title}</h2>}
        {block.text && <p className="mt-4 text-lead text-ink-soft">{block.text}</p>}
      </Animated>
      <Animated block={block} delay={100}>
        {data.preview ? (
          <div className="card card-pad text-sm text-muted">The contact form appears here.</div>
        ) : (
          <ContactForm captcha={data.captcha} />
        )}
      </Animated>
    </div>
  );
}

function Block({ block, data }: { block: PageBlock; data: BlockData }) {
  switch (block.type) {
    case 'hero':
      return <Hero block={block} />;
    case 'richText':
      return (
        <Animated block={block} className={cn(block.style.align === 'center' && 'text-center')}>
          <Markdown>{block.markdown}</Markdown>
        </Animated>
      );
    case 'features':
      return <Features block={block} />;
    case 'imageText':
      return <ImageText block={block} />;
    case 'stats':
      return <Stats block={block} />;
    case 'steps':
      return <Steps block={block} />;
    case 'testimonials':
      return <Testimonials block={block} />;
    case 'logos':
      return <Logos block={block} />;
    case 'gallery':
      return <Gallery block={block} />;
    case 'video':
      return <Video block={block} />;
    case 'faq':
      return <FaqBlock block={block} faqs={data.faqs} />;
    case 'pricing':
      return (
        <>
          <Heading block={block} title={block.title} subtitle={block.subtitle} />
          <PricingCards plans={data.plans} headingLevel="h3" />
        </>
      );
    case 'cta':
      return <Cta block={block} />;
    case 'contact':
      return <Contact block={block} data={data} />;
    case 'spacer':
      return (
        <div className={block.size === 'sm' ? 'h-6' : block.size === 'lg' ? 'h-24' : 'h-12'}>
          {block.divider && <hr className="relative top-1/2 border-line" />}
        </div>
      );
  }
}

export function PageBlocks({
  blocks,
  data,
  selectedId,
}: {
  blocks: PageBlock[];
  data: BlockData;
  /** Builder preview: outline this block. */
  selectedId?: string | null;
}) {
  return (
    <>
      {blocks
        .filter((b) => !b.hidden || data.preview)
        .map((block, i) => (
          <section
            key={block.id}
            id={block.style.anchor || undefined}
            data-block={block.id}
            className={cn(
              'relative scroll-mt-24',
              BACKGROUNDS[block.style.background],
              PADDING[block.style.padding],
              // The first block sits under the fixed header.
              i === 0 && !data.preview && 'pt-[calc(var(--pv-header-h)+56px)]',
              block.hidden && 'opacity-40',
              selectedId === block.id && 'outline outline-2 -outline-offset-2 outline-brand-500',
            )}
          >
            <div className={cn('container', WIDTH[block.style.width])}>
              <Block block={block} data={data} />
            </div>
          </section>
        ))}
    </>
  );
}
