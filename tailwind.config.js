/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // DXVK Studio brand colors - Dark volcanic theme
        studio: {
          950: '#050505',  // Obsidian (Deepest)
          900: '#0f0f11',  // Main background
          850: '#18181b',  // Card background (Zinc-900)
          800: '#27272a',  // Elevated surfaces (Zinc-800)
          700: '#3f3f46',  // Borders (Zinc-700)
          600: '#52525b',  // Muted text
          500: '#71717a',  // Secondary text
          400: '#a1a1aa',  // Primary text
          300: '#d4d4d8',  // Headings
          200: '#e4e4e7',  // Bright text
          100: '#fafafa',  // White text
        },
        accent: {
          vulkan: '#ef4444',   // Vivid Red (Tailwind Red-500)
          dark: '#dc2626',     // Red-600
          light: '#f87171',    // Red-400
          hover: '#dc2626',    // Red-600
          pressed: '#b91c1c',  // Red-700
          glow: 'rgba(239, 68, 68, 0.5)', // Red glow

          success: '#10b981',  // Green
          warning: '#f59e0b',  // Amber
          danger: '#ef4444',   // Red (Same as Vulkan for consistency in errors)
          info: '#3b82f6',     // Blue
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
      boxShadow: {
        // Professional elevation system
        'elevation-1': '0 1px 2px 0 rgb(0 0 0 / 0.3)',
        'elevation-2': '0 4px 6px -1px rgb(0 0 0 / 0.4), 0 2px 4px -2px rgb(0 0 0 / 0.3)',
        'elevation-3': '0 10px 15px -3px rgb(0 0 0 / 0.5), 0 4px 6px -4px rgb(0 0 0 / 0.4)',
        // Glow effects
        'glow-sm': '0 0 10px -2px var(--tw-shadow-color)',
        'glow-md': '0 0 20px -5px var(--tw-shadow-color)',
        'glow-lg': '0 0 40px -10px var(--tw-shadow-color)',
        // Subtle inner highlight for depth
        'inner-highlight': 'inset 0 1px 0 rgb(255 255 255 / 0.05)',
      },
      backgroundImage: {
        'gradient-vulkan': 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
        'gradient-dark': 'linear-gradient(to bottom, rgba(24, 24, 27, 0.8), rgba(9, 9, 11, 0.95))',
      },
      backdropBlur: {
        'xs': '2px',
        'md': '12px',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'scale-in': 'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        }
      },
    },
  },
  plugins: [],
}
