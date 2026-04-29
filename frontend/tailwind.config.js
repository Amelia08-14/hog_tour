/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        orange: "#FF6B00",
        "orange-dark": "#CC4E00",
        bg: "#0A0A08",
        bg2: "#111109",
        bg3: "#181814",
        bg4: "#1E1E18",
        htext: "#F0EBE0",
        muted: "#7A7568",
        muted2: "#5A5550",
      },
      fontFamily: {
        display: ["var(--font-display)", "cursive"],
        condensed: ["var(--font-condensed)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
      },
      maxWidth: {
        container: "1160px",
      },
    },
  },
  plugins: [],
};
