/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './lib/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT:   '#1a1a1a',
          secondary: '#5c5a55',
          faint:     '#9b9892',
        },
        paper: {
          DEFAULT: '#fafaf7',
          raised:  '#f1efe8',
        },
        rule:   '#ddd9d0',
        accent: {
          DEFAULT: '#1f6b4a',
          dim:     'rgba(31,107,74,0.08)',
        },
        danger: {
          DEFAULT: '#7a2e2a',
          dim:     'rgba(122,46,42,0.06)',
        },
      },
      fontFamily: {
        serif: ['var(--font-serif)', 'Georgia', 'Times New Roman', 'serif'],
        sans:  ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        xs:      ['13px', { lineHeight: '1.4' }],
        sm:      ['15px', { lineHeight: '1.55' }],
        base:    ['17px', { lineHeight: '1.65' }],
        lg:      ['21px', { lineHeight: '1.5' }],
        xl:      ['29px', { lineHeight: '1.3' }],
        display:    ['40px', { lineHeight: '1.2' }],
        'display-lg': ['58px', { lineHeight: '1.15' }],
      },
      maxWidth: {
        copy:  '720px',
        table: '920px',
      },
      borderRadius: {
        DEFAULT: '4px',
        sm: '2px',
        md: '4px',
        lg: '4px',
        xl: '4px',
        '2xl': '4px',
        full: '4px',
      },
      boxShadow: {
        none: 'none',
        DEFAULT: 'none',
        sm: 'none',
        md: 'none',
        lg: 'none',
        xl: 'none',
        '2xl': 'none',
      },
    },
  },
  plugins: [],
}
