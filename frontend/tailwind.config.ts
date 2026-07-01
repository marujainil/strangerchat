import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './src/hooks/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#08080c',
          900: '#0a0a0f',
          800: '#111119',
          700: '#181824',
          600: '#222234',
        },
        violet: {
          DEFAULT: '#8b5cf6',
          deep: '#7c3aed',
          glow: '#a855f7',
        },
        accentPink: '#ec4899',
        accentIndigo: '#6366f1',
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'violet-grad': 'linear-gradient(135deg, #a855f7 0%, #6366f1 50%, #ec4899 100%)',
        'violet-soft': 'linear-gradient(135deg, rgba(168,85,247,0.18), rgba(99,102,241,0.10))',
        'glow-radial': 'radial-gradient(60% 60% at 50% 0%, rgba(139,92,246,0.25) 0%, rgba(8,8,12,0) 70%)',
      },
      boxShadow: {
        glow: '0 0 40px -8px rgba(139,92,246,0.55)',
        'glow-lg': '0 0 80px -10px rgba(139,92,246,0.5)',
        glass: '0 8px 32px rgba(0,0,0,0.45)',
      },
      backdropBlur: {
        xs: '2px',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.95)', opacity: '0.7' },
          '70%': { transform: 'scale(1.3)', opacity: '0' },
          '100%': { opacity: '0' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        float: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s ease-out both',
        'pulse-ring': 'pulse-ring 2s cubic-bezier(0.4,0,0.6,1) infinite',
        shimmer: 'shimmer 2.5s linear infinite',
        float: 'float 6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
