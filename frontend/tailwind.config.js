/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2E7D32',
          50: '#E8F5E9',
          100: '#C8E6C9',
          200: '#A5D6A7',
          600: '#256628',
          700: '#1B5E20',
          800: '#144617',
          900: '#0d2e0f',
        },
        farm: {
          bg: '#F6F8F4',
          border: '#E5EAE2',
          card: '#FFFFFF',
          darkBg: '#0f130f',
          darkCard: '#181d18',
          darkBorder: '#273127',
          darkText: '#e2e8e2',
          darkMuted: '#8a9b8a',
        },
        status: {
          success: '#2E7D32',
          warning: '#F59E0B',
          danger: '#D32F2F',
          rest: '#7B1FA2',
          info: '#1976D2',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)',
      },
    },
  },
  plugins: [],
}
