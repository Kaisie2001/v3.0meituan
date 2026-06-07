import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        meituan: {
          yellow: "#FFD100",
          ink: "#1F2329",
          gray: "#F5F6F8",
        },
      },
      boxShadow: {
        soft: "0 12px 30px rgba(31, 35, 41, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
