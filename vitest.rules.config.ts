import { defineConfig } from 'vitest/config';

// Runs against the Firestore emulator: `pnpm test:rules` (needs Java and network access once to
// download the emulator).
export default defineConfig({
  test: { include: ['tests/rules/**/*.test.ts'], environment: 'node', testTimeout: 20_000 },
});
