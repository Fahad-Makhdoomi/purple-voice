/**
 * Seeds what a fresh install needs:
 *   - the three plans (from @pv/shared), without overwriting later admin edits
 *   - a super admin (SEED_SUPER_ADMIN_EMAIL / SEED_SUPER_ADMIN_PASSWORD)
 *   - starter FAQs, legal pages and two blog posts so the site isn't empty
 *   - outside production, a demo subscriber with sample calls (SEED_DEMO=false to skip)
 *
 * Safe to run repeatedly.
 */
import crypto from 'node:crypto';
import { PrismaClient, type Prisma } from '@prisma/client';
import { DEFAULT_LLM_MODEL, DEFAULT_VOICE, PLAN_LIST } from '@pv/shared';
import { hashPassword } from '../src/lib/password';

const prisma = new PrismaClient();
const isProd = process.env.NODE_ENV === 'production';

async function seedPlans() {
  for (const [i, plan] of PLAN_LIST.entries()) {
    const stripePriceId =
      plan.code === 'BASIC'
        ? process.env.STRIPE_PRICE_BASIC
        : plan.code === 'PRO'
          ? process.env.STRIPE_PRICE_PRO
          : undefined;
    const existing = await prisma.plan.findUnique({ where: { code: plan.code } });
    if (existing) {
      if (!existing.stripePriceId && stripePriceId) {
        await prisma.plan.update({ where: { code: plan.code }, data: { stripePriceId } });
      }
      continue;
    }
    await prisma.plan.create({
      data: {
        code: plan.code,
        name: plan.name,
        tagline: plan.tagline,
        priceMonthlyCents: plan.priceMonthlyCents,
        includedMinutes: plan.includedMinutes,
        limits: plan.limits as unknown as Prisma.InputJsonValue,
        features: plan.features as unknown as Prisma.InputJsonValue,
        highlights: plan.highlights,
        featured: plan.featured,
        selfServe: plan.selfServe,
        stripePriceId: stripePriceId ?? null,
        sortOrder: i,
      },
    });
  }
  console.log('✓ plans');
}

async function seedSuperAdmin() {
  const email = (process.env.SEED_SUPER_ADMIN_EMAIL ?? 'admin@purplevoice.local').toLowerCase();
  if (await prisma.user.findUnique({ where: { email } }))
    return console.log(`✓ super admin exists (${email})`);
  let password = process.env.SEED_SUPER_ADMIN_PASSWORD;
  if (!password) {
    if (isProd) {
      // Another super admin already runs the platform: nothing to bootstrap.
      if (await prisma.user.count({ where: { role: 'SUPER_ADMIN' } }))
        return console.log('✓ super admin exists');
      throw new Error('Set SEED_SUPER_ADMIN_PASSWORD to seed the first super admin in production');
    }
    password = `pv-${crypto.randomBytes(6).toString('hex')}1`;
  }
  await prisma.user.create({
    data: {
      email,
      name: 'Super Admin',
      role: 'SUPER_ADMIN',
      passwordHash: await hashPassword(password),
    },
  });
  console.log(
    `✓ super admin ${email}${process.env.SEED_SUPER_ADMIN_PASSWORD ? '' : ` / ${password}`}`,
  );
}

const FAQS = [
  [
    'Getting started',
    'What is Purple Voice?',
    'Purple Voice lets you build AI voice agents that make and answer sales calls on your own phone numbers. They qualify leads, answer questions, book meetings into your calendar and hand hot prospects to your team.',
  ],
  [
    'Getting started',
    'Do I need my own phone number?',
    'Yes. Connect your phone provider and pick a number you already rent there. Number rental is billed by your provider and is not part of a Purple Voice plan.',
  ],
  [
    'Getting started',
    'Which AI models do my agents use?',
    'Leading speech and language models, including speech-to-speech models for the most natural conversations. The Purple Voice team sets up the AI for your workspace, so there are no AI keys for you to manage.',
  ],
  [
    'Pricing',
    'What counts as a call minute?',
    'Talk time on connected calls, rounded up to the next minute per call, the same way carriers bill. Unanswered calls use no minutes.',
  ],
  [
    'Pricing',
    'What happens if I use all my minutes?',
    'New calls pause until your next billing period or until you upgrade. Running campaigns pause automatically and resume when you have minutes again.',
  ],
  [
    'Pricing',
    'Can I cancel any time?',
    'Yes. Cancel from the billing page and your plan stays active until the end of the period you paid for.',
  ],
  [
    'Calling',
    'Can the agent transfer a call to a person?',
    'Yes. Turn on call transfer and set the number to ring. The agent tells the caller it is connecting them and hands the live call over.',
  ],
  [
    'Calling',
    'How does appointment booking work?',
    'Connect Google Calendar and switch on booking for an agent. During the call it checks your real availability, offers open slots and books the meeting with an invite to the prospect.',
  ],
  [
    'Compliance',
    'Is it legal to call people with an AI agent?',
    "Rules differ by country. In many places, including under the US TCPA, automated or AI-voiced calls need the recipient's prior consent, and you must honour do-not-call requests. Purple Voice gives you calling windows and automatic do-not-call handling; you are responsible for having consent for the numbers you upload.",
  ],
] as const;

async function seedContent() {
  if ((await prisma.faq.count()) === 0) {
    await prisma.faq.createMany({
      data: FAQS.map(([category, question, answer], sortOrder) => ({
        category,
        question,
        answer,
        sortOrder,
      })),
    });
    console.log('✓ FAQs');
  }

  const pages = [
    {
      slug: 'privacy',
      title: 'Privacy Policy',
      body: '> Starter text. Have this reviewed by your legal counsel before launch.\n\n## What we collect\nAccount details you give us, the configuration of your agents, call metadata, transcripts and summaries of calls placed through your workspace.\n\n## How we use it\nTo run the service, bill you, and support you. We never sell personal data.\n\n## Your API keys\nKeys for AI and telephony providers are encrypted at rest and used only to run your calls.\n\n## Contact\nWrite to us from the contact page with any privacy question or request.',
      showInFooter: true,
    },
    {
      slug: 'terms',
      title: 'Terms of Service',
      body: '> Starter text. Have this reviewed by your legal counsel before launch.\n\n## Using Purple Voice\nYou are responsible for the calls your agents make, including having consent to call the numbers you upload and complying with local telemarketing law.\n\n## Billing\nPlans renew monthly. Call minutes are counted per billing period and do not roll over. Carrier and AI provider charges are billed by those providers.\n\n## Acceptable use\nNo calls that harass, deceive, or impersonate a real person or organisation.',
      showInFooter: true,
    },
  ];
  for (const page of pages) {
    await prisma.page.upsert({
      where: { slug: page.slug },
      create: { ...page, status: 'PUBLISHED', publishedAt: new Date() },
      update: {},
    });
  }

  const posts = [
    {
      slug: 'ai-voice-agents-for-sales',
      title: 'What an AI voice agent actually does on a sales call',
      excerpt:
        'From the first hello to a booked demo: the moments where an AI agent earns its place on your team.',
      tags: ['sales', 'ai-agents'],
      body: "Most sales calls follow the same arc: open, qualify, handle an objection or two, and agree a next step. That repeatability is exactly what an AI voice agent is good at.\n\n## Opening\nThe agent greets the prospect by name, says who it is calling for and why, in a sentence.\n\n## Qualifying\nIt asks your qualification questions one at a time and listens. Answers land in the call summary, so your team never re-asks.\n\n## Objections\nPut your top objections and the best answers in the agent's knowledge. It uses them naturally, not as a script.\n\n## The next step\nWhen the prospect is ready, the agent checks your calendar and books the meeting — or transfers the call to a person while the interest is warm.",
    },
    {
      slug: 'realtime-vs-cascaded-voice',
      title: 'Realtime or cascaded: how voice engines work',
      excerpt:
        'Speech-to-speech models answer fastest. A cascaded pipeline can use any model. Here is how they differ.',
      tags: ['product', 'ai-agents'],
      body: "Purple Voice runs agents on three kinds of voice engine.\n\n## OpenAI Realtime and Gemini Live\nSpeech-to-speech models hear and speak directly. Replies start in a few hundred milliseconds and interruptions feel natural. They suit calls where conversational feel matters most.\n\n## Cascaded\nSpeech is transcribed, the text goes to a language model — Claude, Gemini or OpenAI — and the reply is spoken back. It suits calls that need a specific model's reasoning or writing style.\n\nThe Purple Voice team sets up the engine for your workspace and can switch it at any time; your agents, prompts and campaigns stay as they are.",
    },
  ];
  for (const post of posts) {
    await prisma.post.upsert({
      where: { slug: post.slug },
      create: { ...post, status: 'PUBLISHED', publishedAt: new Date() },
      update: {},
    });
  }
  console.log('✓ pages and posts');
}

/** A Pro workspace with an agent, a campaign and two weeks of calls, for development. */
async function seedDemo() {
  if (isProd || process.env.SEED_DEMO === 'false') return;
  const email = 'demo@purplevoice.local';
  if (await prisma.user.findUnique({ where: { email } }))
    return console.log(`✓ demo subscriber exists (${email})`);

  const pro = await prisma.plan.findUniqueOrThrow({ where: { code: 'PRO' } });
  const now = new Date();
  const periodEnd = new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000);
  const workspace = await prisma.workspace.create({
    data: {
      name: 'Northwind Solar',
      users: {
        create: { email, name: 'Dana Demo', passwordHash: await hashPassword('demo-password-1') },
      },
      subscription: {
        create: {
          planId: pro.id,
          status: 'ACTIVE',
          provider: 'MANUAL',
          currentPeriodStart: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
          currentPeriodEnd: periodEnd,
        },
      },
      subscriptionEvents: {
        create: { type: 'CREATED', toPlan: 'PRO', mrrDeltaCents: pro.priceMonthlyCents ?? 0 },
      },
    },
  });
  // Staff choose a subscriber's AI layer; the demo runs Claude on the cascaded engine.
  await prisma.workspaceAiSettings.create({
    data: {
      workspaceId: workspace.id,
      voiceEngine: 'CASCADED',
      llmProvider: 'ANTHROPIC',
      model: DEFAULT_LLM_MODEL.ANTHROPIC,
    },
  });
  const agent = await prisma.agent.create({
    data: {
      workspaceId: workspace.id,
      name: 'Ava — Solar Consultations',
      status: 'DRAFT',
      voice: DEFAULT_VOICE.CASCADED,
      systemPrompt:
        'You are Ava, a friendly consultant for Northwind Solar. You call homeowners who asked for a solar quote. Confirm they own the home, ask about their average monthly electricity bill and roof direction, and book a free 30-minute consultation.',
      greeting:
        'Hi {{first_name}}, this is Ava from Northwind Solar — you asked about a solar quote. Is now a good time?',
      goal: 'Book a free consultation with homeowners who spend over $100 a month on electricity.',
      knowledge:
        'Panels from $9,800 after incentives. 25-year warranty. Installation takes one day.',
      appointmentBookingEnabled: true,
      timezone: 'America/New_York',
    },
  });

  const outcomes = [
    'APPOINTMENT_BOOKED',
    'INTERESTED',
    'NOT_INTERESTED',
    'CALLBACK_REQUESTED',
    'VOICEMAIL',
    'OTHER',
  ] as const;
  const calls: Prisma.CallCreateManyInput[] = [];
  let minutes = 0;
  for (let d = 13; d >= 0; d--) {
    const perDay = 6 + Math.floor(Math.random() * 10);
    for (let i = 0; i < perDay; i++) {
      const created = new Date(
        now.getTime() - d * 24 * 60 * 60 * 1000 - Math.random() * 8 * 60 * 60 * 1000,
      );
      const answered = Math.random() > 0.3;
      const duration = answered ? 40 + Math.floor(Math.random() * 300) : 0;
      const billed = Math.ceil(duration / 60);
      minutes += billed;
      calls.push({
        workspaceId: workspace.id,
        agentId: agent.id,
        provider: 'TWILIO',
        direction: Math.random() > 0.8 ? 'INBOUND' : 'OUTBOUND',
        fromNumber: '+14155550100',
        toNumber: `+1415555${String(1000 + Math.floor(Math.random() * 8999))}`,
        status: answered ? 'COMPLETED' : 'NO_ANSWER',
        startedAt: created,
        answeredAt: answered ? created : null,
        endedAt: new Date(created.getTime() + duration * 1000),
        durationSec: duration,
        billedMinutes: billed,
        outcome: answered ? outcomes[Math.floor(Math.random() * outcomes.length)] : null,
        sentiment: answered ? Math.round((Math.random() * 1.6 - 0.6) * 100) / 100 : null,
        summary: answered
          ? 'Homeowner confirmed ownership, monthly bill around $180. Interested in panels; asked about financing.'
          : null,
        transcript: answered
          ? [
              {
                role: 'agent',
                text: 'Hi, this is Ava from Northwind Solar — you asked about a solar quote. Is now a good time?',
                at: created.toISOString(),
              },
              { role: 'caller', text: 'Sure, I have a few minutes.', at: created.toISOString() },
            ]
          : [],
        finalizedAt: created,
        createdAt: created,
      });
    }
  }
  await prisma.call.createMany({ data: calls });
  await prisma.usagePeriod.create({
    data: {
      workspaceId: workspace.id,
      periodStart: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
      periodEnd,
      minutesUsed: minutes,
      callCount: calls.length,
    },
  });
  console.log(`✓ demo subscriber ${email} / demo-password-1 (${calls.length} sample calls)`);
}

async function main() {
  await seedPlans();
  await seedSuperAdmin();
  await seedContent();
  await seedDemo();
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
