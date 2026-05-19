import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Standalone dev server for the EasyVisionDemoPage. Not part of the published
// package — the npm tarball only includes the `files` whitelist from
// package.json (dist/, README.md).
export default defineConfig({
  root: 'dev',
  plugins: [react()],
  server: {
    port: 5180,
    open: true,
  },
});
