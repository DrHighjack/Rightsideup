/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1a6640',
          light: '#e8f5ee',
          dark: '#0d4a2a',
          50: '#f0f9f4',
          100: '#e8f5ee',
          200: '#c3e6d2',
          300: '#8fd0ab',
          400: '#4fb37e',
          500: '#2a8c58',
          600: '#1a6640',
          700: '#155434',
          800: '#0d4a2a',
          900: '#0a3820',
        },
        // Dark chrome for sidebars/headers — slate with a cool tint
        ink: {
          DEFAULT: '#0f172a',
          hover: '#1e293b',
          border: '#1e293b',
          muted: '#94a3b8',
          faint: '#64748b',
        },
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.06)',
        'card-hover': '0 4px 6px -1px rgb(15 23 42 / 0.07), 0 2px 4px -2px rgb(15 23 42 / 0.06)',
        modal: '0 20px 25px -5px rgb(15 23 42 / 0.15), 0 8px 10px -6px rgb(15 23 42 / 0.10)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.96) translateY(4px)' },
          to: { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(100%)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 150ms ease-out',
        'scale-in': 'scale-in 180ms cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-up': 'slide-up 260ms cubic-bezier(0.16, 1, 0.3, 1)',
        shimmer: 'shimmer 1.6s infinite',
      },
    },
  },
  plugins: [],
};
