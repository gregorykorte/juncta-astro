# Juncta Juvant (Astro)

## Quick start
```bash
npm i
npm run dev
```
Open http://localhost:4321

## Build for Cloudflare Pages
- Build command: `npm run build`
- Output directory: `dist`
- Set `NODE_VERSION` to 18+ in Pages settings.

## Notes
- Static assets live in `public/`
- CSS: `public/assets/css/site.css`
- JS: `public/assets/js/main.js` (includes dateline & year script)
- Components: `src/components/`
- Pages: `src/pages/` (`/` and `/about`)
- Decap admin served at `/admin` from `public/admin/`
- If you need Cloudflare Pages Functions for Decap auth, keep your `functions/` at repo root.


## Live reload & where to edit
- Edit **pages** in `src/pages/` (e.g., `index.astro`, `about.astro`).
- Edit the **masthead/footer** in `src/components/`.
- Edit **CSS** in `src/styles/site.css` (Vite HMR will update without full reload).
- Edit **JS** in `src/scripts/` (modules in `src/scripts/modules`).

If your filesystem doesn’t emit file-watch events (e.g., network mounts or VMs), enable polling:
```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
export default defineConfig({
  output: 'static',
  vite: {
    server: { watch: { usePolling: true, interval: 300 } }
  }
});
```
