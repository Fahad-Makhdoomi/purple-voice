import type { Prisma } from '@prisma/client';
import type { AiSettingsInput } from '@pv/shared';
import {
  aiSettingsSchema,
  analyticsSettingsSchema,
  appearanceSettingsSchema,
  securitySettingsSchema,
  seoSettingsSchema,
  type AnalyticsSettings,
  type AppearanceSettings,
  type SecuritySettings,
  type SeoSettings,
} from '@pv/shared';
import type { z } from 'zod';
import { prisma } from '../lib/prisma';

/**
 * Typed access to the SiteSetting key/value table. Each key has a schema and
 * defaults, so a fresh database (or a key added in a later release) still
 * returns a complete object.
 */

const DEFAULTS = {
  seo: {
    siteName: 'Purple Voice',
    defaultTitle: 'Purple Voice — AI voice agents for sales calls',
    titleTemplate: '%s · Purple Voice',
    defaultDescription:
      'Create, manage and run AI voice agents that call your leads, qualify them, book appointments and hand hot prospects to your team.',
    ogImageUrl: null,
    twitterHandle: null,
    contactEmail: 'hello@purplevoice.ai',
    googleSiteVerification: null,
  } satisfies SeoSettings,
  security: {
    captcha: { signup: true, login: false, forgotPassword: true, contact: true },
  } satisfies SecuritySettings,
  analytics: { plausibleDomain: null, ga4MeasurementId: null } satisfies AnalyticsSettings,
  appearance: { theme: 'default', music: true } satisfies AppearanceSettings,
  /** The AI layer for subscribers staff haven't configured individually. */
  ai: {
    voiceEngine: 'GEMINI_LIVE',
    llmProvider: 'GEMINI',
    model: 'gemini-3.8-live',
  } satisfies AiSettingsInput,
};

const SCHEMAS = {
  seo: seoSettingsSchema,
  security: securitySettingsSchema,
  analytics: analyticsSettingsSchema,
  appearance: appearanceSettingsSchema,
  ai: aiSettingsSchema,
} as const;

export type SettingKey = keyof typeof SCHEMAS;
type SettingValue<K extends SettingKey> = z.infer<(typeof SCHEMAS)[K]>;

export async function getSetting<K extends SettingKey>(key: K): Promise<SettingValue<K>> {
  const row = await prisma.siteSetting.findUnique({ where: { key } });
  const merged = { ...DEFAULTS[key], ...((row?.value as object) ?? {}) };
  const parsed = SCHEMAS[key].safeParse(merged);
  return (parsed.success ? parsed.data : DEFAULTS[key]) as SettingValue<K>;
}

export async function setSetting<K extends SettingKey>(
  key: K,
  value: unknown,
): Promise<SettingValue<K>> {
  const data = SCHEMAS[key].parse(value) as SettingValue<K>;
  await prisma.siteSetting.upsert({
    where: { key },
    create: { key, value: data as Prisma.InputJsonValue },
    update: { value: data as Prisma.InputJsonValue },
  });
  return data;
}

/** Keys any admin may edit from the CMS. `security`, `appearance` and `ai` are super-admin only. */
const CMS_SETTING_KEYS = ['seo', 'analytics'] as const;

export function isCmsSettingKey(key: string): key is (typeof CMS_SETTING_KEYS)[number] {
  return (CMS_SETTING_KEYS as readonly string[]).includes(key);
}
