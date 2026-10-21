import 'server-only';
import { runStructured, type AiUsage, type ClaudeClient } from './claude';
import { normalizeCaption, normalizePersona } from './normalize';
import { getPromptTemplate } from './prompts';
import {
  captionOutputSchema,
  personaOutputSchema,
  type CaptionSuggestion,
  type PersonaSuggestion,
  type SuggestRequest,
} from './schemas';

export type SuggestDeps = { client: ClaudeClient; model: string };

export type SuggestResult =
  | { task: 'persona'; suggestion: PersonaSuggestion }
  | { task: 'caption'; suggestion: CaptionSuggestion };

export type SuggestResponse = SuggestResult & {
  warnings: string[];
  usage: AiUsage;
  model: string;
  promptId: string;
};

/**
 * Öneri üretir. Sonuç hiçbir yere kaydedilmez; kullanıcı onaylarsa forma yazılır.
 * Token kullanımı döner. `costs` tablosuna kayıt, maliyet modülü gelince (#48 / #59).
 */
export async function suggest(
  request: SuggestRequest,
  deps: SuggestDeps,
): Promise<SuggestResponse> {
  if (request.task === 'persona') {
    const template = getPromptTemplate('persona');
    const result = await runStructured(deps.client, {
      model: deps.model,
      system: template.system,
      userMessage: template.buildUserMessage(request.input),
      schema: personaOutputSchema,
      effort: template.effort,
    });
    const { suggestion, warnings } = normalizePersona(result.data);
    return {
      task: 'persona',
      suggestion,
      warnings,
      usage: result.usage,
      model: result.model,
      promptId: `${template.id}@${template.version}`,
    };
  }

  const template = getPromptTemplate('caption');
  const result = await runStructured(deps.client, {
    model: deps.model,
    system: template.system,
    userMessage: template.buildUserMessage(request.input),
    schema: captionOutputSchema,
    effort: template.effort,
  });
  const { suggestion, warnings } = normalizeCaption(result.data);
  return {
    task: 'caption',
    suggestion,
    warnings,
    usage: result.usage,
    model: result.model,
    promptId: `${template.id}@${template.version}`,
  };
}
