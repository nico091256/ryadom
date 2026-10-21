const colors = require('tailwindcss/colors');

/**
 * Ryadom web theme — the same palette as the mobile design system
 * (docs/design PDF p.16, apps/mobile_client/lib/ui/tokens.dart):
 *   brand #0F5C45 (buttons, active state), soft #E8F3EE (selected bg, chips),
 *   accent #FF7A2F (location, call, discounts), text #14231C / #4F6058,
 *   page #F3F6F4, border #E1E8E4, danger #B42318.
 * `slate` is re-tinted to those greenish greys so every existing
 * `text-slate-*` / `border-slate-*` picks the palette up without edits.
 * Keep apps/admin and apps/store in sync.
 */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-manrope)', 'Manrope', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#E8F3EE',
          100: '#D4E7DD',
          200: '#A6D3BE',
          300: '#5CAE8C',
          400: '#2E8B6B',
          500: '#147558',
          600: '#0F5C45',
          700: '#0B4634',
          800: '#083526',
          900: '#072B20',
        },
        accent: {
          50: '#FFF1E8',
          100: '#FFE1CF',
          200: '#FFC4A3',
          300: '#FFA572',
          400: '#FF8E4D',
          500: '#FF7A2F',
          600: '#E0621B',
          700: '#C2500F',
          800: '#9A3E0B',
          900: '#7A3109',
        },
        slate: {
          ...colors.slate,
          50: '#F3F6F4',
          100: '#E9EFEB',
          200: '#E1E8E4',
          300: '#C9D3CD',
          400: '#8A9A92',
          500: '#4F6058',
          600: '#3F524A',
          700: '#2C3E34',
          800: '#1F3027',
          900: '#14231C',
          950: '#0B1510',
        },
        rose: {
          ...colors.rose,
          600: '#B42318',
          700: '#912018',
        },
      },
      boxShadow: {
        // Soft, slightly green-tinted elevation instead of Tailwind's neutral grey.
        card: '0 1px 2px rgba(20, 35, 28, 0.04), 0 1px 3px rgba(20, 35, 28, 0.06)',
        float: '0 8px 24px -8px rgba(20, 35, 28, 0.18), 0 2px 6px rgba(20, 35, 28, 0.06)',
        brand: '0 6px 16px -6px rgba(15, 92, 69, 0.45)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'pop-in': {
          from: { opacity: '0', transform: 'translateY(8px) scale(0.98)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'slide-in': { from: { transform: 'translateX(100%)' }, to: { transform: 'translateX(0)' } },
      },
      animation: {
        'fade-in': 'fade-in 150ms ease-out',
        'pop-in': 'pop-in 180ms ease-out',
        'slide-in': 'slide-in 220ms cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
};
