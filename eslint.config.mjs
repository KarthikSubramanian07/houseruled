import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/** @type {import("eslint").Linter.Config[]} */
const config = [
  ...nextVitals,
  ...nextTs,
  {
    ignores: [
      ".next/**",
      ".open-next/**",
      ".wrangler/**",
      "node_modules/**",
      "coverage/**",
      "cloudflare-env.d.ts",
      "next-env.d.ts",
    ],
  },
  {
    // React Compiler rules are errors once warning sites were refactored.
    rules: {
      "react-hooks/set-state-in-effect": "error",
      "react-hooks/refs": "error",
    },
  },
];

export default config;
