/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'sans-serif',
        ],
      },
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
        secondary: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
        },
        // Dark StudentCarr SaaS theme (used by the app shell, sidebar,
        // dashboard and career chatbot). Existing light pages are untouched.
        navy: {
          bg: '#08111f',
          panel: '#0d1828',
          panel2: '#101d2f',
          card: '#121f32',
          border: '#24344d',
        },
        ink: {
          DEFAULT: '#f5f7fb',
          muted: '#a8b5ca',
        },
        accent: {
          blue: '#6f9cff',
          lilac: '#9b7cff',
          green: '#68d89b',
          yellow: '#ffc65c',
          red: '#ff7c86',
        },
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
}
