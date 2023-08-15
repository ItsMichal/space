/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx,css}',
  ],
  theme: {
    extend: {
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      animation:{
        'marquee':'marquee 20s linear infinite',
        'marquee-loop':'marquee-loop 20s linear infinite',
      },
      keyframes:{
        marquee:{
          '0%':{transform:'translateX(0)'},
          '100%':{transform:'translateX(-100%)'},
        },
        'marquee-loop':{
          '0%':{transform:'translateX(100%)'},
          '100%':{transform:'translateX(0%)'},
        }
      },
      fontFamily:{
        title:['var(--akira-font)'],
        paragraph:['var(--new-mexica)'],
      }
    },
  },
  plugins: [],
}
