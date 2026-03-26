/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: 'var(--c-primary)',
        accent: 'var(--c-accent)',
        bg: 'var(--c-bg)',
        surface: 'var(--c-surface)',
        text: 'var(--c-text)',
        muted: 'var(--c-muted)',
        border: 'var(--c-border)',
        success: 'var(--c-success)',
        warning: 'var(--c-warning)',
        danger: 'var(--c-danger)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
