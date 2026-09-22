// eslint.config.js — ESLint 10 flat config
// Uses CommonJS require() so it works alongside the CJS webpack config
// without needing "type":"module" in package.json.

const tsParser = require("@typescript-eslint/parser");
const tsPlugin = require("@typescript-eslint/eslint-plugin");

/** @type {import("eslint").Linter.Config[]} */
module.exports = [
  {
    // Apply to all TypeScript source files
    files: ["src/**/*.ts", "src/**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      // Core rules
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "no-debugger": "error",

      // TypeScript-specific rules
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "separate-type-imports" },
      ],
    },
  },
  {
    // Ignore build output and dependencies
    ignores: ["dist/**", "node_modules/**", "tests/**", "*.config.js", "*.config.ts"],
  },
];
