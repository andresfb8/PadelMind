import { defineConfig } from 'vitest/config';

export default defineConfig({
  // firebase@12.19 fija @firebase/app-compat@0.5.18 anidado, pero los paquetes *-compat usan la 0.5.22
  // hoisted: 'firebase/compat/app' y 'firebase/compat/firestore' acaban con instancias distintas y
  // @firebase/rules-unit-testing no encuentra Firestore. Se fuerza la copia hoisted para 'compat/app'.
  resolve: { alias: { 'firebase/compat/app': '@firebase/app-compat' } },
  test: {
    include: ['tests/rules/**/*.test.ts'],
    environment: 'node',
    testTimeout: 20000,
    server: { deps: { inline: [/@firebase\/rules-unit-testing/] } },
  },
});
