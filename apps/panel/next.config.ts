import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { NextConfig } from 'next';

// Setup script'i .env.local'i repo köküne yazar; Next ise sadece apps/panel'deki
// env dosyalarını okur. Kökteki .env.local'i de yükle. Önce yüklenen (apps/panel
// veya gerçek ortam değişkeni) kazanır, çünkü loadEnvFile mevcut değerleri ezmez.
function loadRootEnv() {
  let dir = process.cwd();
  while (!existsSync(join(dir, 'pnpm-workspace.yaml'))) {
    const parent = dirname(dir);
    if (parent === dir) return;
    dir = parent;
  }
  const file = join(dir, '.env.local');
  if (existsSync(file)) process.loadEnvFile(file);
}
loadRootEnv();

const nextConfig: NextConfig = {
  transpilePackages: ['@ai-influencer/shared'],
};

export default nextConfig;
