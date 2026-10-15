import Anthropic from '@anthropic-ai/sdk';

/**
 * Request options shared by every Claude call the platform makes.
 *
 * - Server-side fallback (`fallbacks: "default"`): if the requested model's
 *   safety classifiers decline a request, the API re-runs it on Anthropic's
 *   recommended fallback model instead of returning a refusal. Claude Haiku
 *   has no server-side fallback, so it is omitted there.
 * - Effort: the current Claude models think adaptively; `effort` is the dial.
 *   It is only sent to model families known to accept it, since subscribers
 *   can type any model id.
 */

type Effort = 'low' | 'medium' | 'high';

const EFFORT_MODELS = /^claude-(opus-5|opus-5-5|sonnet-5|sonnet-5-5|haiku-5-5|fable-5|fable-5-1|opus-4-[678]|sonnet-4-6)$/;

export function claudeExtras(
  model: string,
  effort: Effort,
  format?: Anthropic.Beta.BetaJSONOutputFormat,
): {
  betas?: Anthropic.Beta.AnthropicBeta[];
  fallbacks?: 'default';
  output_config?: Anthropic.Beta.BetaOutputConfig;
} {
  const supportsFallback = !model.startsWith('claude-haiku');
  const outputConfig: Anthropic.Beta.BetaOutputConfig = {
    ...(EFFORT_MODELS.test(model) ? { effort } : {}),
    ...(format ? { format } : {}),
  };
  return {
    ...(supportsFallback ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' } : {}),
    ...(Object.keys(outputConfig).length ? { output_config: outputConfig } : {}),
  };
}

export function claudeClient(apiKey: string) {
  return new Anthropic({ apiKey, maxRetries: 2, timeout: 60_000 });
}

export { Anthropic };
