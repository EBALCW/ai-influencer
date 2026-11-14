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
      // Dışarıdan alınan skill'ler ve tarayıcıda çalışan film örnekleri (bkz. .claude/skills/edit-video/KAYNAK.md)
      '.claude/skills/{find-ideas,write-script,edit-video,film-styles,animated-explainer}/**',
      '.claude/skills/anlatim-videosu/ornek/**',
    ],
  },
];

export default config;
