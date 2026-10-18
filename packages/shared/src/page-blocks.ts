import { z } from 'zod';

/**
 * The website page builder (Admin → Content → Pages → Builder). A page is a
 * list of blocks, each a section of the page: a hero, a feature grid, a
 * call to action, a FAQ… Blocks are plain data (no HTML), validated here and
 * rendered by the website's own components, so builder pages follow the
 * active theme and can never inject markup or scripts.
 */

export const PAGE_BLOCK_TYPES = [
  'hero',
  'richText',
  'features',
  'imageText',
  'stats',
  'steps',
  'testimonials',
  'logos',
  'gallery',
  'video',
  'faq',
  'pricing',
  'cta',
  'contact',
  'spacer',
] as const;
export type PageBlockType = (typeof PAGE_BLOCK_TYPES)[number];

export const PAGE_BLOCK_INFO: Record<PageBlockType, { label: string; description: string }> = {
  hero: { label: 'Hero', description: 'Big headline, intro and buttons, with an optional image.' },
  richText: { label: 'Text', description: 'Headings, paragraphs, lists, links and images.' },
  features: { label: 'Feature grid', description: 'Two to four columns of icon, title and text.' },
  imageText: { label: 'Image and text', description: 'An image beside a paragraph and a button.' },
  stats: { label: 'Numbers', description: 'A row of big numbers with labels.' },
  steps: { label: 'Steps', description: 'A numbered how-it-works sequence.' },
  testimonials: { label: 'Testimonials', description: 'Quotes from customers.' },
  logos: { label: 'Logo strip', description: 'Customer or partner logos.' },
  gallery: { label: 'Gallery', description: 'A grid of images with captions.' },
  video: { label: 'Video', description: 'A YouTube or Vimeo video (privacy-enhanced).' },
  faq: { label: 'FAQ', description: 'Questions and answers, marked up for search.' },
  pricing: { label: 'Pricing', description: 'The live plan cards.' },
  cta: { label: 'Call to action', description: 'A bold band with a heading and buttons.' },
  contact: { label: 'Contact form', description: 'The website contact form.' },
  spacer: { label: 'Spacer', description: 'Empty space or a divider line.' },
};

export const BLOCK_BACKGROUNDS = ['none', 'muted', 'brand', 'dark', 'gradient'] as const;
export const BLOCK_ANIMATIONS = ['none', 'fade', 'rise', 'zoom', 'blur'] as const;
export const BLOCK_PADDINGS = ['none', 'sm', 'md', 'lg'] as const;

/** Icons a feature card can show (lucide names, mapped in the web app). */
export const BLOCK_ICONS = [
  'phone',
  'phone-incoming',
  'calendar',
  'bot',
  'chart',
  'shield',
  'zap',
  'clock',
  'globe',
  'users',
  'message',
  'mail',
  'star',
  'check',
  'sparkles',
  'headphones',
  'rocket',
  'lock',
  'heart',
  'target',
] as const;
export type BlockIcon = (typeof BLOCK_ICONS)[number];

const text = (max: number) => z.string().max(max).default('');
/** Site paths ("/pricing", "/#faq"), mailto/tel links and https URLs only. */
const href = z
  .string()
  .trim()
  .max(500)
  .refine(
    (v) => v === '' || /^(\/(?!\/)|#|https:\/\/|mailto:|tel:)/i.test(v),
    'Use a site path like /pricing, or a full https:// link',
  )
  .default('');
const imageUrl = z
  .string()
  .trim()
  .max(2000)
  .refine(
    (v) => v === '' || /^(\/|https:\/\/)/i.test(v),
    'Use an uploaded image or an https:// URL',
  )
  .default('');
const button = z.object({ label: text(60), href }).default({});

const style = z
  .object({
    background: z.enum(BLOCK_BACKGROUNDS).default('none'),
    align: z.enum(['left', 'center']).default('left'),
    padding: z.enum(BLOCK_PADDINGS).default('md'),
    animation: z.enum(BLOCK_ANIMATIONS).default('rise'),
    /** In-page link target: /page#anchor. */
    anchor: z
      .string()
      .trim()
      .max(60)
      .regex(/^[a-z0-9-]*$/, 'Lowercase letters, numbers and hyphens')
      .default(''),
    width: z.enum(['narrow', 'normal', 'wide']).default('normal'),
  })
  .default({});

const base = {
  id: z.string().min(1).max(40),
  hidden: z.boolean().default(false),
  style,
};

const items = <T extends z.ZodTypeAny>(item: T, max = 24) => z.array(item).max(max).default([]);

export const pageBlockSchema = z.discriminatedUnion('type', [
  z.object({
    ...base,
    type: z.literal('hero'),
    eyebrow: text(80),
    title: text(200),
    subtitle: text(600),
    primary: button,
    secondary: button,
    imageUrl,
    imageAlt: text(200),
    layout: z.enum(['centered', 'split']).default('centered'),
  }),
  z.object({ ...base, type: z.literal('richText'), markdown: text(100000) }),
  z.object({
    ...base,
    type: z.literal('features'),
    title: text(200),
    subtitle: text(600),
    columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(3),
    items: items(
      z.object({
        icon: z.enum(BLOCK_ICONS).default('sparkles'),
        title: text(120),
        text: text(600),
      }),
    ),
  }),
  z.object({
    ...base,
    type: z.literal('imageText'),
    title: text(200),
    markdown: text(10000),
    imageUrl,
    imageAlt: text(200),
    imageSide: z.enum(['left', 'right']).default('right'),
    button,
  }),
  z.object({
    ...base,
    type: z.literal('stats'),
    title: text(200),
    items: items(z.object({ value: text(24), label: text(120) }), 8),
  }),
  z.object({
    ...base,
    type: z.literal('steps'),
    title: text(200),
    subtitle: text(600),
    items: items(z.object({ title: text(120), text: text(600) }), 12),
  }),
  z.object({
    ...base,
    type: z.literal('testimonials'),
    title: text(200),
    items: items(
      z.object({ quote: text(800), name: text(120), role: text(120), avatarUrl: imageUrl }),
      12,
    ),
  }),
  z.object({
    ...base,
    type: z.literal('logos'),
    title: text(200),
    items: items(z.object({ imageUrl, alt: text(120), href }), 24),
  }),
  z.object({
    ...base,
    type: z.literal('gallery'),
    title: text(200),
    columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(3),
    items: items(z.object({ imageUrl, alt: text(200), caption: text(200) }), 24),
  }),
  z.object({
    ...base,
    type: z.literal('video'),
    title: text(200),
    url: z
      .string()
      .trim()
      .max(500)
      .refine(
        (v) => v === '' || !!parseVideoUrl(v),
        'Paste a YouTube or Vimeo link (e.g. https://www.youtube.com/watch?v=…)',
      )
      .default(''),
    caption: text(300),
  }),
  z.object({
    ...base,
    type: z.literal('faq'),
    title: text(200),
    /** "custom": the questions below; "site": the FAQs from Admin → FAQs (optionally one category). */
    source: z.enum(['custom', 'site']).default('custom'),
    category: text(60),
    items: items(z.object({ question: text(300), answer: text(5000) }), 40),
  }),
  z.object({ ...base, type: z.literal('pricing'), title: text(200), subtitle: text(600) }),
  z.object({
    ...base,
    type: z.literal('cta'),
    title: text(200),
    text: text(600),
    primary: button,
    secondary: button,
  }),
  z.object({ ...base, type: z.literal('contact'), title: text(200), text: text(600) }),
  z.object({
    ...base,
    type: z.literal('spacer'),
    size: z.enum(['sm', 'md', 'lg']).default('md'),
    divider: z.boolean().default(false),
  }),
]);
export type PageBlock = z.infer<typeof pageBlockSchema>;
export type PageBlockOf<T extends PageBlockType> = Extract<PageBlock, { type: T }>;

export const pageBlocksSchema = z.array(pageBlockSchema).max(80);

/** A YouTube or Vimeo link as a privacy-enhanced embed URL, or null. */
export function parseVideoUrl(
  url: string,
): { provider: 'youtube' | 'vimeo'; embedUrl: string } | null {
  const yt = url.match(
    /^https:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/i,
  );
  if (yt)
    return { provider: 'youtube', embedUrl: `https://www.youtube-nocookie.com/embed/${yt[1]}` };
  const vimeo = url.match(/^https:\/\/(?:www\.|player\.)?vimeo\.com\/(?:video\/)?(\d{6,12})/i);
  if (vimeo)
    return { provider: 'vimeo', embedUrl: `https://player.vimeo.com/video/${vimeo[1]}?dnt=1` };
  return null;
}

let counter = 0;
/** A short id for a new block (unique within a page). */
export function newBlockId(): string {
  counter = (counter + 1) % 1296;
  return `b${Date.now().toString(36)}${counter.toString(36)}`;
}

/** A new block of `type` with starter content an editor can overwrite. */
export function defaultBlock(type: PageBlockType): PageBlock {
  const id = newBlockId();
  const starters: Record<PageBlockType, Record<string, unknown>> = {
    hero: {
      eyebrow: 'New',
      title: 'A headline that says what you do',
      subtitle: 'One or two sentences on who it is for and why it matters.',
      primary: { label: 'Get started', href: '/signup' },
      secondary: { label: 'Talk to us', href: '/contact' },
      style: { align: 'center', padding: 'lg', animation: 'rise' },
    },
    richText: {
      markdown:
        '## A heading\n\nWrite your text here. **Bold**, _italic_ and [links](/pricing) work.',
    },
    features: {
      title: 'Why teams choose us',
      items: [
        {
          icon: 'phone',
          title: 'Calls every lead',
          text: 'Your agent rings new leads within minutes.',
        },
        {
          icon: 'calendar',
          title: 'Books meetings',
          text: 'Straight into your calendar, no back and forth.',
        },
        { icon: 'chart', title: 'Reports results', text: 'Summaries and outcomes for every call.' },
      ],
      style: { align: 'center' },
    },
    imageText: {
      title: 'Show, then tell',
      markdown: 'Explain one idea next to a picture of it.',
      button: { label: 'Learn more', href: '/pricing' },
    },
    stats: {
      items: [
        { value: '24/7', label: 'Always answering' },
        { value: '< 1 min', label: 'To call a new lead' },
        { value: '100%', label: 'Calls summarised' },
      ],
      style: { align: 'center', background: 'muted' },
    },
    steps: {
      title: 'How it works',
      items: [
        { title: 'Connect your number', text: 'Use the phone numbers you already have.' },
        { title: 'Create your agent', text: 'Tell it who it is and what to achieve.' },
        { title: 'Start calling', text: 'Upload a list or let it answer your line.' },
      ],
    },
    testimonials: {
      title: 'What customers say',
      items: [
        {
          quote: 'It booked eleven demos in its first week.',
          name: 'Alex Morgan',
          role: 'Head of Sales',
        },
      ],
    },
    logos: { title: 'Trusted by teams at' },
    gallery: { title: 'Gallery' },
    video: { title: 'See it in action' },
    faq: {
      title: 'Questions, answered',
      items: [{ question: 'A common question?', answer: 'A short, direct answer.' }],
    },
    pricing: {
      title: 'Simple pricing',
      subtitle: 'Start free. Upgrade when you grow.',
      style: { align: 'center' },
    },
    cta: {
      title: 'Ready to put your phones on autopilot?',
      text: 'Start free with 100 AI call minutes.',
      primary: { label: 'Start free', href: '/signup?plan=FREE' },
      secondary: { label: 'See pricing', href: '/pricing' },
      style: { align: 'center', background: 'gradient' },
    },
    contact: { title: 'Get in touch', text: 'We usually reply within one working day.' },
    spacer: { size: 'md', divider: false, style: { animation: 'none', padding: 'none' } },
  };
  const { style: s, ...rest } = starters[type] as { style?: object };
  return pageBlockSchema.parse({ id, type, ...rest, style: s ?? {} });
}

/** Ready-made layouts for a new builder page. */
export const PAGE_TEMPLATES = {
  blank: { label: 'Blank page', blocks: [] as PageBlockType[] },
  landing: {
    label: 'Landing page',
    blocks: [
      'hero',
      'logos',
      'features',
      'imageText',
      'stats',
      'testimonials',
      'faq',
      'cta',
    ] as PageBlockType[],
  },
  feature: {
    label: 'Feature page',
    blocks: ['hero', 'imageText', 'steps', 'features', 'video', 'cta'] as PageBlockType[],
  },
  about: {
    label: 'About us',
    blocks: ['hero', 'richText', 'stats', 'gallery', 'testimonials', 'contact'] as PageBlockType[],
  },
  pricing: { label: 'Pricing page', blocks: ['hero', 'pricing', 'faq', 'cta'] as PageBlockType[] },
} as const;
export type PageTemplate = keyof typeof PAGE_TEMPLATES;

export function templateBlocks(template: PageTemplate): PageBlock[] {
  return PAGE_TEMPLATES[template].blocks.map((t) => defaultBlock(t));
}
