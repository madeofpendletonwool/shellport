import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface:  '#0d0d10',
        surface2: '#14141a',
        surface3: '#1c1c24',
        border:   '#252530',
        accent:   '#7c6fd4',
        muted:    '#55556a',
      },
      fontFamily: {
        mono: ["'Menlo'", "'Monaco'", "'Cascadia Code'", 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config
