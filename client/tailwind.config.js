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
        // 60% Dominant Canvas (Warm Cream / Soft Linen / Dark Roasted Espresso)
        warm: {
          50: '#FBF9F5',
          100: '#F5EFEB',
          200: '#EBE1D7',
          300: '#DDD0C3',
          400: '#C7B4A3',
          500: '#AA9482',
          600: '#8C7563',
          700: '#6E5848',
          800: '#4D3B2F',
          900: '#2F231B',
          950: '#18120E',
        },
        // 30% Structural Secondary (Rich Mocha / Deep Coffee Wood / Espresso)
        brown: {
          50: '#FAF6F0',
          100: '#F1E9DF',
          200: '#E3D3C2',
          300: '#CDB69F',
          400: '#B0947A',
          500: '#94755A',
          600: '#7A5B42',
          700: '#5F442E',
          800: '#463020',
          900: '#2E1E14',
          950: '#1A100A',
        },
        // 10% Vibrant Accent (Caramel Amber / Warm Terracotta)
        accent: {
          50: '#FFF8F1',
          100: '#FEEFD8',
          200: '#FCDCAC',
          300: '#FAC37A',
          400: '#F7A344',
          500: '#E8841B',
          600: '#C9650F',
          700: '#A34C0C',
          800: '#7F390E',
          900: '#642E10',
          950: '#381605',
        },
        brand: {
          50: '#FAF6F0',
          100: '#F1E9DF',
          500: '#C9650F',
          600: '#A34C0C',
          700: '#7F390E',
        },
        navy: {
          800: '#2E1E14',
          900: '#1A100A',
        }
      }
    },
  },
  plugins: [],
}
