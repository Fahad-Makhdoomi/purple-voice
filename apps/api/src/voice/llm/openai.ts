import OpenAI from 'openai';
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';
import type { ToolDefinition } from '../tools';
import { MAX_TOOL_ROUNDS, type LlmConversation, type TurnHandlers } from './types';

/** OpenAI Chat Completions, streamed, with function calling. */
export class OpenAIConversation implements LlmConversation {
  private readonly client: OpenAI;
  private readonly messages: ChatCompletionMessageParam[];
  private readonly tools: ChatCompletionTool[];

  constructor(
    apiKey: string,
    private readonly model: string,
    system: string,
    tools: ToolDefinition[],
  ) {
    this.client = new OpenAI({ apiKey, timeout: 30_000 });
    this.messages = [{ role: 'system', content: system }];
    this.tools = tools.map((t) => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));
  }

  noteInterrupted(spokenText: string) {
    if (spokenText.trim()) this.messages.push({ role: 'assistant', content: `${spokenText.trim()} —` });
  }

  async turn(userText: string, h: TurnHandlers): Promise<void> {
    this.messages.push({ role: 'user', content: userText });

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const stream = await this.client.chat.completions.create(
        {
          model: this.model,
          messages: this.messages,
          tools: this.tools.length ? this.tools : undefined,
          stream: true,
        },
        { signal: h.signal },
      );

      let text = '';
      const calls = new Map<number, { id: string; name: string; args: string }>();
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        if (!delta) continue;
        if (delta.content) {
          text += delta.content;
          h.onText(delta.content);
        }
        for (const tc of delta.tool_calls ?? []) {
          const entry = calls.get(tc.index) ?? { id: '', name: '', args: '' };
          if (tc.id) entry.id = tc.id;
          if (tc.function?.name) entry.name += tc.function.name;
          if (tc.function?.arguments) entry.args += tc.function.arguments;
          calls.set(tc.index, entry);
        }
      }

      const toolCalls = [...calls.values()];
      this.messages.push({
        role: 'assistant',
        content: text || null,
        ...(toolCalls.length
          ? {
              tool_calls: toolCalls.map((c) => ({
                id: c.id,
                type: 'function' as const,
                function: { name: c.name, arguments: c.args },
              })),
            }
          : {}),
      });
      if (!toolCalls.length) return;

      for (const c of toolCalls) {
        let input: unknown;
        try {
          input = JSON.parse(c.args || '{}');
        } catch {
          input = { __invalid: c.args };
        }
        const output = await h.onToolCall(c.name, input);
        this.messages.push({ role: 'tool', tool_call_id: c.id, content: output });
      }
      if (toolCalls.some((c) => c.name === 'end_call' || c.name === 'transfer_call')) return;
    }
  }
}
