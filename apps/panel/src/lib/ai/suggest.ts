import 'server-only';
import { runStructured, type AiUsage, type ClaudeClient } from './claude';
import { normalizeCaption, normalizePersona } from './normalize';
import { loadPromptTemplate, type PromptSource } from './prompts';
import {
  captionOutputSchema,
  personaOutputSchema,
  scriptOutputSchema,
  weeklyOutputSchema,
  type CaptionSuggestion,
  type PersonaSuggestion,
  type ScriptSuggestion,
  type WeeklySuggestion,
  type SuggestRequest,
} from './schemas';
export type SuggestDeps = {
  client: ClaudeClient;
  model: string;
  source?: PromptSource;
  metrics?: unknown;
  onUsage?: (usage: AiUsage, model: string) => Promise<void>;
};
export type SuggestResult =
  | { task: 'persona'; suggestion: PersonaSuggestion }
  | { task: 'caption'; suggestion: CaptionSuggestion }
  | { task: 'script'; suggestion: ScriptSuggestion }
  | { task: 'weekly'; suggestion: WeeklySuggestion };
export type SuggestResponse = SuggestResult & {
  warnings: string[];
  usage: AiUsage;
  model: string;
  promptId: string;
};
export async function suggest(
  request: SuggestRequest,
  deps: SuggestDeps,
): Promise<SuggestResponse> {
  const template = await loadPromptTemplate(request.task, deps.source);
  const schema = {
    persona: personaOutputSchema,
    caption: captionOutputSchema,
    script: scriptOutputSchema,
    weekly: weeklyOutputSchema,
  }[request.task];
  const input =
    request.task === 'weekly'
      ? { ...request.input, metrics: deps.metrics }
      : request.input;
  const result = await runStructured(deps.client, {
    model: deps.model,
    system: template.system,
    userMessage: template.buildUserMessage(input as never),
    schema,
    effort: template.effort,
    onUsage: deps.onUsage,
  });
  const common = {
    usage: result.usage,
    model: result.model,
    promptId: `${template.id}@${template.version}`,
  };
  if (request.task === 'persona')
    return {
      task: 'persona',
      ...normalizePersona(personaOutputSchema.parse(result.data)),
      ...common,
    };
  if (request.task === 'caption')
    return {
      task: 'caption',
      ...normalizeCaption(captionOutputSchema.parse(result.data)),
      ...common,
    };
  if (request.task === 'script') {
    const data = scriptOutputSchema.parse(result.data);
    if (
      data.scenes.reduce((sum, scene) => sum + scene.seconds, 0) >
      request.input.durationSeconds
    ) {
      const { AiError } = await import('./errors');
      throw new AiError('invalid_output');
    }
    return { task: 'script', suggestion: data, warnings: [], ...common };
  }
  return {
    task: 'weekly',
    suggestion: weeklyOutputSchema.parse(result.data),
    warnings: [],
    ...common,
  };
}
