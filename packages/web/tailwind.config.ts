import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface:         '#0B1020',
        surface2:        '#111827',
        surface3:        '#131C2E',
        hover:           '#1B2840',
        border:          '#1E2940',
        accent:          '#22D3EE',
        'accent-hover':  '#67E8F9',
        'accent-deep':   '#0891B2',
        muted:           '#64748B',
        success:         '#22C55E',
        warning:         '#F59E0B',
        danger:          '#EF4444',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ["'JetBrains Mono'", "'Menlo'", "'Monaco'", 'monospace'],
      },
      boxShadow: {
        float:    '0 10px 30px rgba(0,0,0,0.35)',
        glow:     '0 0 0 1px rgba(34,211,238,0.4), 0 0 24px rgba(34,211,238,0.18)',
        'glow-sm':'0 0 0 1px rgba(34,211,238,0.3), 0 0 12px rgba(34,211,238,0.12)',
        'glow-xs':'0 0 8px rgba(34,211,238,0.22)',
      },
      borderRadius: {
        panel: '14px',
        card:  '18px',
      },
      transitionDuration: {
        '180': '180ms',
      },
    },
  },
  plugins: [],
} satisfies Config
