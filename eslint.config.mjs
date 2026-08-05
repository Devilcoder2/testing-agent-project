import js from "@eslint/js";
import nextVitals from "eslint-config-next/core-web-vitals";
import tseslint from "typescript-eslint";

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...nextVitals,
  {
    ignores: [".next/**", "node_modules/**", "coverage/**", "prisma/generated/**"]
  }
];
