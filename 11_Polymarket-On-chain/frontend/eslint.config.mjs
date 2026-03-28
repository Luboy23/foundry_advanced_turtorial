import nextVitals from "eslint-config-next/core-web-vitals";

const config = [
  ...nextVitals,
  {
    ignores: ["playwright-report/**", "test-results/**"]
  }
];

export default config;
