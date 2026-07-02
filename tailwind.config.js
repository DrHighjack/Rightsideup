/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#1a6640',
        'primary-light': '#e8f5ee',
        'primary-dark': '#0d4a2a',
        navy: {
          50: '#F0F5FA',
          100: '#DCE7F2',
          700: '#12395F',
          900: '#0A2540',
        },
        safety: {
          500: '#F1600D',
          600: '#D1530A',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-barlow)', 'var(--font-inter)', 'sans-serif'],
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
