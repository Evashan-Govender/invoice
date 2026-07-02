import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // -------------------------------------------------------
        // SAMBE CONSULTING OFFICIAL COLOR PALETTE — exact values
        // Source: Sambe Consulting Corporate Identity Guidelines
        //
        // PRIMARY:
        //   sb-blue:        #0056AE  Sambe Consulting Blue
        //   sb-green:       #4B9200  Sambe Consulting Green
        //
        // SECONDARY:
        //   sb-grey-1:      #282828  Grey 1
        //   sb-grey-2:      #535353  Grey 2
        //   sb-dark-green:  #004000  Dark Green
        //   sb-light-green: #8BBE00  Light Green
        //   sb-dark-blue:   #0042AF  Dark Blue
        //   sb-light-blue:  #8AC4FF  Light Blue
        // -------------------------------------------------------

        // -- Exact brand colors (use directly in className) --
        'sb-blue':        '#0056AE',
        'sb-green':       '#4B9200',
        'sb-grey-1':      '#282828',
        'sb-grey-2':      '#535353',
        'sb-dark-green':  '#004000',
        'sb-light-green': '#8BBE00',
        'sb-dark-blue':   '#0042AF',
        'sb-light-blue':  '#8AC4FF',

        // -- Tints derived from brand colors --
        'sb-blue-5':         '#f0f5fb',
        'sb-blue-10':        '#e6eef7',
        'sb-blue-20':        '#ccddf0',
        'sb-green-5':        '#f4f9ed',
        'sb-green-10':       '#eaf3da',
        'sb-green-20':       '#d0e8aa',
        'sb-light-blue-10':  '#eaf4ff',
        'sb-light-blue-20':  '#d0e8ff',
        'sb-light-green-10': '#edf4d4',
        'sb-light-green-20': '#d6eaaa',
        'sb-grey-2-10':      '#f0f0f0',
        'sb-grey-2-20':      '#e0e0e0',
        'sb-grey-2-50':      '#a9a9a9',

        // -- Aliases: primary maps to Sambe Blue --
        primary: {
          50:  '#f0f5fb',
          100: '#e6eef7',
          200: '#ccddf0',
          300: '#99bbe0',
          400: '#4d8ecb',
          500: '#1a6eb6',
          600: '#0056AE',
          700: '#0042AF',
          800: '#003282',
          900: '#001f52',
          950: '#000f29',
        },
        // -- Aliases: accent maps to Sambe Green --
        accent: {
          50:  '#f4f9ed',
          100: '#eaf3da',
          200: '#d0e8aa',
          300: '#aad46a',
          400: '#8BBE00',
          500: '#4B9200',
          600: '#3d7800',
          700: '#004000',
          800: '#002800',
          900: '#001400',
        },
      },
      fontFamily: {
        sans:    ['Verdana', 'Geneva', 'Tahoma', 'sans-serif'],
        display: ['Verdana', 'Geneva', 'Tahoma', 'sans-serif'],
      },
      boxShadow: {
        'glow':       '0 0 40px -10px rgb(0 86 174 / 0.4)',
        'glow-lg':    '0 0 60px -15px rgb(0 86 174 / 0.5)',
        'inner-glow': 'inset 0 2px 4px 0 rgb(0 0 0 / 0.06)',
        'card':       '0 2px 8px 0 rgb(0 86 174 / 0.08)',
        'card-hover': '0 8px 24px 0 rgb(0 86 174 / 0.14)',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      animation: {
        'fade-in':     'fadeIn 0.3s ease-out',
        'slide-up':    'slideUp 0.3s ease-out',
        'slide-down':  'slideDown 0.3s ease-out',
        'scale-in':    'scaleIn 0.2s ease-out',
        'spin-slow':   'spin 3s linear infinite',
        'pulse-slow':  'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-soft': 'bounceSoft 1s ease-in-out infinite',
        'glow':        'glow 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:     { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp:    { '0%': { opacity: '0', transform: 'translateY(10px)' },  '100%': { opacity: '1', transform: 'translateY(0)' } },
        slideDown:  { '0%': { opacity: '0', transform: 'translateY(-10px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        scaleIn:    { '0%': { opacity: '0', transform: 'scale(0.95)' },       '100%': { opacity: '1', transform: 'scale(1)' } },
        bounceSoft: { '0%, 100%': { transform: 'translateY(-5%)' }, '50%': { transform: 'translateY(0)' } },
        glow: {
          '0%, 100%': { boxShadow: '0 0 20px -5px rgb(0 86 174 / 0.4)' },
          '50%':      { boxShadow: '0 0 30px -5px rgb(0 86 174 / 0.6)' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':  'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
}
export default config
