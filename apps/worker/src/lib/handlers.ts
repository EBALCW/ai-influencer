// Bu makinenin çalıştırabildiği iş türleri.
import { createExplainerRenderJob } from '../handlers/explainer/index.ts';
import { selftestJob } from '../handlers/selftest.ts';
import { createRegistry, type Registry } from './registry.ts';

export function defaultRegistry(): Registry {
  return createRegistry([selftestJob, createExplainerRenderJob()]);
}
