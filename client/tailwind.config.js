/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#172b4d",
        muted: "#718096",
        brand: "#e8414f",
        "brand-dark": "#c92f3d",
        canvas: "#f5f7fa",
      },
      boxShadow: {
        card: "0 8px 28px rgba(23, 43, 77, 0.055)",
      },
    },
  },
  plugins: [],
};
