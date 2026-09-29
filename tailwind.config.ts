import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#132238",
        surf: "#f3f6f9",
        signal: "#0f9d7a",
        amber: "#d98c00",
        danger: "#c0392b"
      },
      fontFamily: {
        sans: ["var(--font-work-sans)"],
        display: ["var(--font-space-grotesk)"]
      },
      boxShadow: {
        panel: "0 20px 45px rgba(19, 34, 56, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
