/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },
      colors: {
        brand: {
          50:  '#fafafa',
          100: '#f4f4f5',
          200: '#e4e4e7',
          300: '#d4d4d8',
          400: '#a1a1aa',
          500: '#71717a',
          600: '#52525b',
          700: '#3f3f46',
          800: '#27272a',
          900: '#18181b',
        },
        surface: {
          low: '#000000',     /* Pure black background */
          DEFAULT: '#09090b', /* Zinc 950 cards */
          high: '#18181b',    /* Zinc 900 highlights */
          variant: '#27272a', /* Zinc 800 borders */
        },
        danger:  '#ef4444',
        warning: '#f59e0b',
        success: '#10b981',
        night:   '#a855f7',
      }
    }
  },
  plugins: []
}
