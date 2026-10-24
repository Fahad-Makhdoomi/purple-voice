import OpenAI from 'openai';

/**
 * Sarvam's chat API speaks the OpenAI Chat Completions protocol, so the
 * OpenAI SDK talks to it with a different base URL and Sarvam's key header.
 */
export function sarvamChatClient(apiKey: string, timeout: number): OpenAI {
  return new OpenAI({
    apiKey,
    baseURL: 'https://api.sarvam.ai/v1',
    defaultHeaders: { 'api-subscription-key': apiKey },
    timeout,
  });
}
