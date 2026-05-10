/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        background: '#0A0A0F',
        surface: '#13131A',
        card: '#1A1A24',
        cardLight: '#22222E',
        primary: '#0F3460',
        primaryLight: '#1E4D8B',
        accent: '#FF6B35',
        accentDark: '#E55525',
        blue: '#1E90FF',
        text: '#FFFFFF',
        textSecondary: '#A0A0B0',
        textMuted: '#6B6B7B',
        border: '#2A2A38',
        success: '#00C896',
        warning: '#FFB800',
        danger: '#FF4757',
      },
      fontFamily: {
        sans: ['System'],
      },
    },
  },
  plugins: [],
};
