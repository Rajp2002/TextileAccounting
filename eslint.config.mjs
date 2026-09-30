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
    ".vercel/**",
    "next-env.d.ts",
    "public/sw.js",
    "public/fallback-*.js",
    "public/workbox-*.js",
    "public/worker-*.js",
    // Local diagnostic scratchpads are gitignored and are not application code.
    "scratch/**",
    // Tracked QA evidence (reviewer helpers, run records, verification scripts), not application code.
    // Preserved evidence must not be edited to satisfy lint (its manifests carry hashes).
    "qa-artifacts/**",
  ]),
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
]);

export default eslintConfig;
