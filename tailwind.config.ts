import type { Config } from "tailwindcss";
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        plano: "#f4f6f9",
        superficie: "#ffffff",
        borda: "#e2e7ee",
        tinta: { DEFAULT: "#0b1220", 2: "#46505f", 3: "#6b7482" },
        marinho: { DEFAULT: "#0b2a5b", 2: "#12397a", claro: "#e8eef8" },
        azul: { 100: "#cde2fb", 200: "#9ec5f4", 300: "#6da7ec", 400: "#3987e5", 450: "#2a78d6", 500: "#256abf", 600: "#184f95", 700: "#0d366b" },
        bom: "#006300",
        alerta: "#b07a00",
        serio: "#b8501f",
        critico: "#d03b3b",
      },
      fontFamily: { sans: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"] },
      borderRadius: { cartao: "10px" },
    },
  },
  plugins: [],
} satisfies Config;
