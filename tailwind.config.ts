import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: "#FAF7F2",
        espresso: {
          DEFAULT: "#4A2C18",
          hover: "#361F10",
        },
        caramel: "#8B5A2B",
        ink: {
          DEFAULT: "#23170F",
          muted: "#6E5D52",
        },
        sand: "#EDE6DC",
      },
      fontFamily: {
        serif: ["var(--font-playfair)", "Georgia", "serif"],
        sans: ["var(--font-jakarta)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 4px 20px rgba(74, 44, 24, 0.06)",
        "card-hover": "0 8px 28px rgba(74, 44, 24, 0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
