import { Anthropic, claudeClient, claudeExtras } from '../../services/ai/claude';
import type { ToolDefinition } from '../tools';
import { MAX_TOOL_ROUNDS, type LlmConversation, type TurnHandlers } from './types';

/**
 * Claude via the official SDK, streamed so the first sentence can be spoken
 * while the rest is still being written.
 *
 * - History is append-only: each response's content goes back exactly as
 *   returned (thinking blocks included) and nothing earlier is ever edited.
 * - Effort is `low`: on a phone call, time to first word matters most.
 * - Tools stream their input eagerly; every input is validated against its
 *   zod schema by the executor before anything runs.
 */
export class ClaudeConversation implements LlmConversation {
  private readonly client: Anthropic;
  private readonly messages: Anthropic.Beta.BetaMessageParam[] = [];
  private readonly tools: Anthropic.Beta.BetaTool[];

  constructor(
    apiKey: string,
    private readonly model: string,
    private readonly system: string,
    tools: ToolDefinition[],
  ) {
    this.client = claudeClient(apiKey);
    this.tools = tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters,
      eager_input_streaming: true,
    }));
  }

  noteInterrupted(spokenText: string) {
    if (spokenText.trim())
      this.messages.push({ role: 'assistant', content: `${spokenText.trim()} —` });
  }

  async turn(userText: string, h: TurnHandlers): Promise<void> {
    this.messages.push({ role: 'user', content: userText });

    let reissued = false;
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const stream = this.client.beta.messages.stream(
        {
          model: this.model,
          max_tokens: 64000,
          system: [{ type: 'text', text: this.system, cache_control: { type: 'ephemeral' } }],
          tools: this.tools.length ? this.tools : undefined,
          messages: this.messages,
          ...claudeExtras(this.model, 'low'),
        },
        { signal: h.signal },
      );
      stream.on('text', (delta) => h.onText(delta));

      let final: Anthropic.Beta.BetaMessage;
      try {
        final = await stream.finalMessage();
      } catch (err) {
        // API errors (auth, rate limit, overload) and interruptions propagate.
        // Anything else here is a streamed tool input the SDK could not parse:
        // nothing was appended to history, so re-issue the request once.
        if (err instanceof Anthropic.APIError || h.signal.aborted || reissued) throw err;
        reissued = true;
        round--;
        continue;
      }

      this.messages.push({ role: 'assistant', content: final.content });
      if (final.stop_reason === 'refusal' || final.stop_reason === 'max_tokens') return;
      if (final.stop_reason !== 'tool_use') return;

      const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
      for (const block of final.content) {
        if (block.type !== 'tool_use') continue;
        const output = await h.onToolCall(block.name, block.input);
        results.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: output,
          ...(output.startsWith('Error:') ? { is_error: true } : {}),
        });
      }
      this.messages.push({ role: 'user', content: results });
      if (
        final.content.some(
          (b) => b.type === 'tool_use' && (b.name === 'end_call' || b.name === 'transfer_call'),
        )
      ) {
        return;
      }
    }
  }
}
