import globals from "globals";
import js from "@eslint/js";
import prettier from "eslint-config-prettier/flat";

export default [
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser
      }
    },
    rules: {
      "no-unused-vars": "warn",
      "no-console": "off"
    }
  },
  js.configs.recommended,
  prettier
];
