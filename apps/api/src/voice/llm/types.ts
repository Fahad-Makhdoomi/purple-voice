import type { ToolExecutor } from '../tools';

export interface TurnHandlers {
  /** Text as the model generates it; the cascaded engine speaks it sentence by sentence. */
  onText(delta: string): void;
  onToolCall: ToolExecutor;
  /** Aborted when the caller interrupts. */
  signal: AbortSignal;
}

/**
 * A multi-turn conversation with one LLM vendor. Each implementation keeps
 * its own native message history, so vendor-specific content (Claude's
 * thinking blocks, Gemini's function-call parts) is replayed exactly as the
 * vendor returned it.
 */
export interface LlmConversation {
  /** Runs one caller turn to completion, including any tool round-trips. */
  turn(userText: string, handlers: TurnHandlers): Promise<void>;
  /** Records what the agent actually said before being cut off. */
  noteInterrupted(spokenText: string): void;
}

/** Tool-call rounds allowed within a single caller turn. */
export const MAX_TOOL_ROUNDS = 5;
