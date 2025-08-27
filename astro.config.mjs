// astro.config.mjs
import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  vite: {
    // 🚫 stop turning small files into data: URLs
    build: {
      assetsInlineLimit: 0,
    },
  },
});
