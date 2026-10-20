import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#090d18',
        surface: '#111827',
        line: '#263244',
        accent: '#8b9cff',
        mint: '#73e3c1',
      },
    },
  },
  plugins: [],
};

export default config;
