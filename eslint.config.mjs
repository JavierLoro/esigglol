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
    ".next-e2e/**",
    ".next-valorant-sandbox/**",
    ".tmp/**",
    "out/**",
    "build/**",
    "dist/**",
    ".vinext/**",
    ".wrangler/**",
    "cloudflare/generated/**",
    "next-env.d.ts",
    "tools/cloudflare-poc/node_modules/**",
    "tools/cloudflare-poc/dist/**",
    "tools/cloudflare-poc/.wrangler/**",
    "tools/cloudflare-poc/.next/**",
  ]),
]);

export default eslintConfig;
