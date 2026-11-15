// Bu makinenin çalıştırabildiği iş türleri. Gerçek render işleyicileri #219 / #220 ile eklenir.
import { selftestJob } from '../handlers/selftest.ts';
import { createRegistry, type Registry } from './registry.ts';

export function defaultRegistry(): Registry {
  return createRegistry([selftestJob]);
}
