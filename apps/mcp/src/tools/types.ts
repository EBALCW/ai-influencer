import type * as z from 'zod';
import type { PanelGateway } from '../lib/gateway.ts';

export type ToolKind = 'read' | 'write';

export type ToolContext = {
  readonly db: PanelGateway;
  readonly now: () => Date;
};

export type ToolDefinition = {
  readonly name: string;
  readonly title: string;
  /** Modele aracın ne için olduğunu anlatan Türkçe açıklama. */
  readonly description: string;
  readonly kind: ToolKind;
  readonly input: z.ZodObject;
  /** Yazma aracında: aynı çağrı yinelenirse ek etki olmaz mı? */
  readonly idempotent?: boolean;
  /** Yazma aracında: geri alınması zor bir etki var mı? */
  readonly destructive?: boolean;
  readonly handler: (ctx: ToolContext, args: never) => Promise<unknown>;
};

export function defineTool<S extends z.ZodObject>(definition: {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly kind: ToolKind;
  readonly input: S;
  readonly idempotent?: boolean;
  readonly destructive?: boolean;
  readonly handler: (ctx: ToolContext, args: z.output<S>) => Promise<unknown>;
}): ToolDefinition {
  return definition as unknown as ToolDefinition;
}
