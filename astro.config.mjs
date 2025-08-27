import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  vite: { server: { proxy: { '/api': 'http://localhost:8788' } } },
  output: 'static'
})