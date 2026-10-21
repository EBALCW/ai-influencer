import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier/flat';

const config = [
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    settings: { next: { rootDir: 'apps/panel/' } },
  },
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/next-env.d.ts',
      '**/playwright-report/**',
      '**/test-results/**',
      'supabase/functions/**', // Deno ortamı; ayrı lint edilir
    ],
  },
];

export default config;
