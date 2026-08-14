import { defineConfig } from 'vitest/config';

// Separate from vite.config.ts on purpose: that one sets `root: 'dev'` for the
// demo server, which would scope test discovery to the demo folder.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: ['node_modules/**', 'dist/**'],
  },
});
