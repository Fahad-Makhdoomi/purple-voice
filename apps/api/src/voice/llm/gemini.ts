import {
  GoogleGenAI,
  ThinkingLevel,
  type Content,
  type Part,
  type ThinkingConfig,
} from '@google/genai';
import type { ToolDefinition } from '../tools';
import { MAX_TOOL_ROUNDS, type LlmConversation, type TurnHandlers } from './types';

/**
 * As little thinking as each Gemini generation allows: on a phone call every
 * second of thought is a second of silence. 2.5 Flash can switch it off;
 * 2.5 Pro's floor is 128 tokens; Gemini 3 takes a level instead of a budget.
 */
export function callThinking(model: string): ThinkingConfig | undefined {
  if (model.startsWith('gemini-2.5-pro')) return { thinkingBudget: 128 };
  if (model.startsWith('gemini-2.5')) return { thinkingBudget: 0 };
  if (/^gemini-[3-9]/.test(model))
    return { thinkingLevel: model.includes('pro') ? ThinkingLevel.LOW : ThinkingLevel.MINIMAL };
  return undefined;
}

/** Google Gemini, streamed, with function declarations. */
export class GeminiConversation implements LlmConversation {
  private readonly ai: GoogleGenAI;
  private readonly contents: Content[] = [];

  constructor(
    apiKey: string,
    private readonly model: string,
    private readonly system: string,
    private readonly tools: ToolDefinition[],
  ) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  noteInterrupted(spokenText: string) {
    if (spokenText.trim())
      this.contents.push({ role: 'model', parts: [{ text: `${spokenText.trim()} —` }] });
  }

  async turn(userText: string, h: TurnHandlers): Promise<void> {
    this.contents.push({ role: 'user', parts: [{ text: userText }] });

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const stream = await this.ai.models.generateContentStream({
        model: this.model,
        contents: this.contents,
        config: {
          systemInstruction: this.system,
          abortSignal: h.signal,
          thinkingConfig: callThinking(this.model),
          tools: this.tools.length
            ? [
                {
                  functionDeclarations: this.tools.map((t) => ({
                    name: t.name,
                    description: t.description,
                    parametersJsonSchema: t.parameters,
                  })),
                },
              ]
            : undefined,
        },
      });

      const parts: Part[] = [];
      for await (const chunk of stream) {
        const chunkParts = chunk.candidates?.[0]?.content?.parts ?? [];
        parts.push(...chunkParts);
        for (const part of chunkParts) if (part.text && !part.thought) h.onText(part.text);
      }
      if (!parts.length) return;
      this.contents.push({ role: 'model', parts });

      const calls = parts.filter((p) => p.functionCall).map((p) => p.functionCall!);
      if (!calls.length) return;

      const responses: Part[] = [];
      for (const call of calls) {
        const output = await h.onToolCall(call.name ?? '', call.args ?? {});
        responses.push({
          functionResponse: { id: call.id, name: call.name, response: { result: output } },
        });
      }
      this.contents.push({ role: 'user', parts: responses });
      if (calls.some((c) => c.name === 'end_call' || c.name === 'transfer_call')) return;
    }
  }
}
