/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f5ebe5',
          100: '#ecd7ca',
          300: '#d09a76',
          400: '#c57943',
          500: '#BC561D',
          600: '#a24a19',
          700: '#843c14',
          900: '#4f240c'
        },
        arsenic: '#434242',
        granite: '#606060',
        isabelline: '#F1F0F0',
        gray: {
          50: '#fbfbfb',
          100: '#F1F0F0',
          200: '#e3e1e1',
          300: '#cbc7c7',
          400: '#a09c9c',
          500: '#7f7a7a',
          600: '#606060',
          700: '#4f4d4d',
          800: '#434242',
          900: '#353434'
        },
        slate: {
          50: '#fbfbfb',
          100: '#F1F0F0',
          300: '#c9c6c6',
          400: '#9d9999',
          600: '#606060',
          700: '#525151',
          800: '#434242',
          900: '#3a3939',
          950: '#2f2e2e'
        }
      },
      fontFamily: {
        heading: ['"Avenir LT Std 95 Black"', '"Avenir LT Std"', 'Avenir', 'Roboto', 'sans-serif'],
        subheading: ['"Avenir LT Std 45 Book"', '"Avenir LT Std"', 'Avenir', 'Roboto', 'sans-serif'],
        body: ['Roboto', 'sans-serif']
      },
      backgroundImage: {
        glow: 'radial-gradient(circle at top, rgba(188, 86, 29, 0.24), transparent 55%)'
      }
    }
  },
  plugins: []
};
