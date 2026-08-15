import { defineConfig } from 'vitest/config';

// Separate from vite.config.ts on purpose: that one sets `root: 'dev'` for the
// demo server, which would scope test discovery to the demo folder.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
    // Globs must be `**/`-prefixed: setting `exclude` replaces vitest's
    // defaults, and a root-anchored `node_modules/**` misses nested ones —
    // a git worktree under `.worktrees/` or any package shipping its own
    // `src/**/*.test.ts` would otherwise get collected and run.
    exclude: ['**/node_modules/**', '**/dist/**', '**/.worktrees/**'],
  },
});
