import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@noobrpg/shared': path.resolve(__dirname, '../shared/src/index.ts')
    }
  },
  server: {
    port: 3000,
    host: true
  },
  build: {
    assetsInlineLimit: 0,
    target: 'esnext'
  }
});
