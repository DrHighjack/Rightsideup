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
      },
    },
  },
  plugins: [],
};
