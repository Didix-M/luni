import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Static design prototype; it is reference material, not application code.
    "design-reference/**",
    // Third-party PDF.js worker copied verbatim for in-browser extraction.
    "public/pdf.worker.min.mjs",
  ]),
]);

export default eslintConfig;
