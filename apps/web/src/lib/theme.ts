import 'server-only';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { AppearanceSettings, SiteTheme } from '@pv/shared';

/**
 * Per-theme assets that live outside the stylesheet. A theme's colours, type
 * and shapes are in src/styles/themes/<theme>.css, scoped by
 * [data-theme="<theme>"] on the site wrapper.
 */
const MUSIC: Partial<Record<SiteTheme, string>> = {
  kawaii: '/audio/themes/kawaii.mp3',
};

/** The music file to offer, or null when the theme has none or it isn't uploaded yet. */
export function themeMusic({ theme, music }: AppearanceSettings): string | null {
  const src = MUSIC[theme];
  if (!music || !src) return null;
  return existsSync(path.join(process.cwd(), 'public', src)) ? src : null;
}
