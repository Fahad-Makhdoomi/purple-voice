import { GoogleGenAI, type Content, type Part } from '@google/genai';
import type { ToolDefinition } from '../tools';
import { MAX_TOOL_ROUNDS, type LlmConversation, type TurnHandlers } from './types';

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
