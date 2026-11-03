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
          DEFAULT: '#2E7D32', // Forest green
          forest: '#2E7D32',
          leaf: '#66BB6A',   // Secondary leaf green
          50: '#E8F5E9',     // Healthy background
          100: '#C8E6C9',
          200: '#A5D6A7',
          300: '#81C784',
          400: '#66BB6A',
          500: '#4CAF50',
          600: '#2E7D32',
          700: '#1B5E20',
          800: '#144617',
          900: '#0d2e0f',
        },
        farm: {
          bg: '#F7F9F4',     // Pale herbal-gray background
          card: '#FFFFFF',   // White card surface
          border: '#E3E9E2', // Subtle borders
          healthy: '#E8F5E9',
          darkBg: '#0f130f',
          darkCard: '#181d18',
          darkBorder: '#273127',
          darkText: '#e2e8e2',
          darkMuted: '#8a9b8a',
        },
        agriText: {
          main: '#263238',   // Main text
          secondary: '#607067', // Secondary text
          muted: '#8A9990',
        },
        status: {
          success: '#2E7D32',
          warning: '#F9A825', // Warning
          danger: '#D84343',  // Critical
          critical: '#D84343',
          rest: '#7B1FA2',
          info: '#1976D2',    // Information
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
