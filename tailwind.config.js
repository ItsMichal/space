/** @type {import('tailwindcss').Config} */
// Paper design system: every value maps to a CSS variable in app/styles/tokens.css
// (generated from docs/design-system/tokens.json), so light/dark switching is free.
const v = (name) => `var(--${name})`

const style = (name) => [
  v(`type-${name}-size`),
  {
    lineHeight: v(`type-${name}-line`),
    fontWeight: v(`type-${name}-weight`),
    letterSpacing: `var(--type-${name}-tracking, normal)`,
  },
]

module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx,css}',
  ],
  theme: {
    extend: {
      colors: {
        paper: { DEFAULT: v('paper'), raised: v('paper-raised'), sunk: v('paper-sunk') },
        ink: { DEFAULT: v('ink'), muted: v('ink-muted'), faint: v('ink-faint') },
        hairline: v('hairline'),
        dot: v('dot'),
        accent: v('accent'),
        focus: v('focus'),
        'glass-tint': v('glass-tint'),
        'glass-rim': v('glass-rim'),
        'glass-edge': v('glass-edge'),
        'presence-1': v('presence-1'),
        'presence-2': v('presence-2'),
        'presence-3': v('presence-3'),
        'presence-4': v('presence-4'),
        'presence-5': v('presence-5'),
        'presence-6': v('presence-6'),
      },
      spacing: {
        'space-1': v('space-1'),
        'space-2': v('space-2'),
        'space-3': v('space-3'),
        'space-4': v('space-4'),
        'space-6': v('space-6'),
        'space-8': v('space-8'),
        'space-12': v('space-12'),
        'space-16': v('space-16'),
        'space-24': v('space-24'),
      },
      borderRadius: {
        sm: v('radius-sm'),
        md: v('radius-md'),
        lg: v('radius-lg'),
        pill: v('radius-pill'),
      },
      boxShadow: {
        glass: v('shadow-glass'),
      },
      fontFamily: {
        sans: [v('font-sans')],
        display: [v('font-display')],
        serif: [v('font-serif')],
        mono: [v('font-mono')],
      },
      fontSize: {
        'display-name': style('display-name'),
        display: style('display'),
        heading: style('heading'),
        title: style('title'),
        body: style('body'),
        'body-strong': style('body-strong'),
        prose: style('prose'),
        'prose-lede': style('prose-lede'),
        meta: style('meta'),
        label: style('label'),
        code: style('code'),
      },
      maxWidth: {
        content: '1120px',
        prose: '66ch',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'none' },
        },
      },
      animation: {
        'fade-up': 'fade-up 240ms ease-out both',
      },
    },
  },
  plugins: [],
}
