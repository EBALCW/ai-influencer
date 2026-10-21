import { loadEnvConfig } from '@next/env';
import { resolve } from 'node:path';
import type { NextConfig } from 'next';

// Root .env.local is shared by the monorepo; Next runs from apps/panel.
loadEnvConfig(resolve(process.cwd(), '../..'));

const nextConfig: NextConfig = {
  transpilePackages: ['@ai-influencer/shared'],
};

export default nextConfig;
