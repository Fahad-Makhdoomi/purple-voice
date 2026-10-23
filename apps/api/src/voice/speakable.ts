/**
 * The last guard before text-to-speech on the speech-pipeline engines
 * (Cascaded, ElevenLabs, Sarvam). A text model sometimes writes things a
 * caller must never hear: markdown headings and bullets, "Agent:" speaker
 * labels, stage directions like "(pause)", or lines of its own instructions
 * read back. Speech-to-speech engines don't need this; their models speak.
 */

const SPEAKER_LABEL =
  /^\s*(?:\*\*)?(?:agent|ai|assistant|bot|ai agent|representative|you|me|response|reply|answer)\s*(?:\*\*)?\s*[:：]\s*/i;
const STAGE_DIRECTION =
  /[([]\s*(?:pause[sd]?|laughs?|laughing|smiles?|smiling|sighs?|chuckles?|beat|silence|wait(?:s|ing)?(?: for (?:a )?(?:reply|response|answer))?|end(?:s)? (?:the )?call|calls? end_call|tool[^)\]]*|internal[^)\]]*|note[^)\]]*|thinking[^)\]]*)\s*[)\]]/gi;
/** A sentence spoken this way is the model narrating its instructions, not talking. */
const INSTRUCTION_START =
  /^(?:you are (?:an?|the) |you are calling|you represent |your (?:goal|task|role|job|name is|persona)|as an ai (?:voice )?(?:agent|assistant)[, ]|i (?:am|'m) (?:instructed|told|supposed|programmed) to|(?:my|the) (?:instructions|system prompt|prompt) (?:say|says|is|are)|here(?:'s| is) (?:how|what) i (?:would|will|should) say|(?:step|rule|section|instruction)\s*\d*\s*[:.-])/i;

function normalise(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export class SpeechFilter {
  private readonly prompt: string;

  /** `instructions` is the full system prompt the model runs with. */
  constructor(instructions: string) {
    this.prompt = ` ${normalise(instructions)} `;
  }

  /**
   * What of `sentence` may be spoken, or null for nothing. Formatting is
   * stripped; a sentence that is the instructions themselves is dropped.
   */
  clean(sentence: string): string | null {
    let text = sentence
      .split('\n')
      // Headings ("## Goal") and rule lines copied from the prompt are never speech.
      .filter((line) => !/^\s*#{1,6}\s/.test(line))
      .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '').replace(SPEAKER_LABEL, ''))
      .join(' ');
    text = text
      .replace(STAGE_DIRECTION, ' ')
      .replace(/\*\*|__|`+|~~|^\s*>\s?/g, '')
      .replace(/(^|\s)[*_](\S[^*_]*?)[*_](?=\s|$|[.,!?])/g, '$1$2')
      // Template placeholders a variable didn't fill ({{name}}, {name}).
      .replace(/\{\{?\s*[\w.]+\s*\}\}?/g, ' ')
      .replace(/\s+([,.!?।])/g, '$1')
      .replace(/https?:\/\/\S+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!text || !/[\p{L}\p{N}]/u.test(text)) return null;
    if (INSTRUCTION_START.test(text)) return null;
    if (this.isFromPrompt(text)) return null;
    return text;
  }

  /**
   * A long sentence found word for word in the system prompt, and phrased as
   * an instruction, is the prompt being read out. Short ones (a scripted
   * line the subscriber wants said, a price from the knowledge) are fine.
   */
  private isFromPrompt(text: string): boolean {
    const n = normalise(text);
    if (n.split(' ').length < 6 || !this.prompt.includes(` ${n} `)) return false;
    // A rule ("Never…", "Ask…", "If the caller…") or talk about the caller in
    // the third person is meta; a line that addresses the caller is a script.
    return (
      /^(?:you are|you re|your|never|always|do not|dont|don t|must|ask|tell|keep|avoid|use|reply|respond|make sure|remember|only|be|greet|introduce|confirm|offer|end|call|speak|answer|follow|stay|try|if)\b/.test(
        n,
      ) || /\bthe (?:caller|person|customer|prospect|user|lead|client)\b/.test(n)
    );
  }
}
