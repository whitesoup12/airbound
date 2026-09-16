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
        avionics: {
          bg: '#0a0d14',
          surface: '#121722',
          card: '#181f2f',
          border: '#222b40',
          amber: '#f59e0b',
          cyan: '#06b6d4',
          green: '#10b981',
          danger: '#ef4444'
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace']
      }
    },
  },
  plugins: [],
}
