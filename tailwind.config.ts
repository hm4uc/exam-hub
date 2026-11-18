import type { Config } from 'tailwindcss';

// Màu lấy từ CSS variables (globals.css) để có chế độ tối.
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        ground: v('ground'),
        surface: v('surface'),
        sunken: v('sunken'),
        ink: v('ink'),
        muted: v('muted'),
        line: v('line'),
        brand: { DEFAULT: v('brand'), strong: v('brand-strong'), soft: v('brand-soft'), on: v('on-brand') },
        pen: { DEFAULT: v('pen'), soft: v('pen-soft') },
        ok: { DEFAULT: v('ok'), soft: v('ok-soft') },
        warn: { DEFAULT: v('warn'), soft: v('warn-soft') },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        num: ['var(--font-num)', 'ui-monospace', 'Consolas', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgb(16 24 48 / 0.05), 0 4px 16px -8px rgb(16 24 48 / 0.12)',
        pop: '0 12px 32px -12px rgb(16 24 48 / 0.35)',
      },
      borderRadius: { xl: '0.875rem' },
    },
  },
  plugins: [],
} satisfies Config;
