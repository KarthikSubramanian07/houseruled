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
    // Restored lint after Next 16 dropped `next lint`. These React Compiler rules
    // flag existing patterns; tracked for a follow-up cleanup, not merge blockers.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
    },
  },
];

export default config;
