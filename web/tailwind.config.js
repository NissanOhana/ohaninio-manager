/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#ffffff",
          dark: "#0f1117",
        },
        panel: {
          DEFAULT: "#f8f9fa",
          dark: "#1a1b23",
        },
        border: {
          DEFAULT: "#e5e7eb",
          dark: "#2a2b35",
        },
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
