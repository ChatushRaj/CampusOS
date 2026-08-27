import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: { center: true, padding: '1.5rem', screens: { '2xl': '1320px' } },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        canvas: 'hsl(var(--canvas))',
        surface: 'hsl(var(--surface))',
        ink: { DEFAULT: 'hsl(var(--ink))', muted: 'hsl(var(--ink-muted))', subtle: 'hsl(var(--ink-subtle))' },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
          soft: 'hsl(var(--primary-soft))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
          soft: 'hsl(var(--accent-soft))',
        },
        danger: {
          DEFAULT: 'hsl(var(--danger))',
          foreground: 'hsl(var(--danger-foreground))',
          soft: 'hsl(var(--danger-soft))',
        },
        success: { DEFAULT: 'hsl(var(--success))', soft: 'hsl(var(--success-soft))' },
        // Each content type carries its own hairline colour across the whole product.
        kind: {
          post: 'hsl(var(--kind-post))',
          blog: 'hsl(var(--kind-blog))',
          notice: 'hsl(var(--kind-notice))',
          event: 'hsl(var(--kind-event))',
          job: 'hsl(var(--kind-job))',
          listing: 'hsl(var(--kind-listing))',
          poll: 'hsl(var(--kind-poll))',
        },
      },
      borderRadius: { lg: '0.625rem', md: '0.4375rem', sm: '0.25rem' },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        'display-lg': ['clamp(2.75rem, 6vw, 4.5rem)', { lineHeight: '0.95', letterSpacing: '-0.03em' }],
        'display-md': ['clamp(2rem, 4vw, 3rem)', { lineHeight: '1.02', letterSpacing: '-0.025em' }],
        'display-sm': ['clamp(1.5rem, 2.5vw, 2rem)', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        eyebrow: ['0.6875rem', { lineHeight: '1', letterSpacing: '0.14em' }],
      },
      boxShadow: {
        card: '0 1px 2px hsl(var(--shadow) / 0.05), 0 1px 3px hsl(var(--shadow) / 0.04)',
        raised: '0 2px 4px hsl(var(--shadow) / 0.05), 0 8px 24px -8px hsl(var(--shadow) / 0.12)',
        pop: '0 12px 32px -12px hsl(var(--shadow) / 0.24)',
      },
      keyframes: {
        'fade-up': { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'none' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        // One easing curve everywhere: a decelerating ease-out, which reads as
        // settling into place rather than arriving abruptly. Overlay motion
        // (modals, menus) comes from tailwindcss-animate rather than being
        // redefined here.
        'fade-up': 'fade-up 260ms cubic-bezier(0.22, 1, 0.36, 1) both',
        shimmer: 'shimmer 1.6s infinite',
      },
    },
  },
  plugins: [animate],
} satisfies Config;
