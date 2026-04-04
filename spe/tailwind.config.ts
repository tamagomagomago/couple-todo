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
        block: {
          sleep: "#1e3a5f",
          work: "#374151",
          commute: "#78716c",
          task: "#1d4ed8",
          fitness: "#7c3aed",
          break: "#065f46",
          meal: "#92400e",
          deep_work: "#854d0e",
          free: "#1f2937",
        },
      },
    },
  },
  plugins: [],
};

export default config;
