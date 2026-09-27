import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: '#FAFAFA',
        surface: '#FFFFFF',
        'surface-2': '#F3F4F6',
        border: {
          DEFAULT: '#E5E7EB',
          strong: '#D1D5DB',
        },
        text: {
          primary: '#1F2937',
          secondary: '#4B5563',
          muted: '#69707D',
        },
        accent: '#6D28D9',
        warning: '#B45309',
        success: '#15803D',
        danger: '#DC2626',
        steel: '#3B6E96',
      },
      fontFamily: {
        display: ['var(--font-cinzel)'],
      },
    },
  },
  plugins: [typography],
};
export default config;
