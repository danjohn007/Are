/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fef7ee',
          100: '#fdebd3',
          500: '#e67e22',
          700: '#b65d15',
          900: '#4a2811'
        },
        slate: {
          950: '#111827'
        }
      },
      fontFamily: {
        heading: ['Poppins', 'sans-serif'],
        body: ['Lato', 'sans-serif']
      },
      backgroundImage: {
        glow: 'radial-gradient(circle at top, rgba(230,126,34,0.25), transparent 55%)'
      }
    }
  },
  plugins: []
};
