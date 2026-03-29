import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        pulse: {
          navy:   '#0f172a',  // dominant base
          deep:   '#1e3a5f',  // mid-tone deep blue
          ocean:  '#0f4c75',  // mid-tone ocean blue
          indigo: '#1a1a3e',  // AI chat / advice scene
          accent: '#38bdf8',  // interactive accent
        },
      },
    },
  },
  plugins: [],
};

export default config;
