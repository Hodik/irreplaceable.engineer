Tech Context

Stack
- Framework: Astro ^5.14.8 (ESM, content-first, static by default)
- Language: `.astro` components, HTML/CSS; TypeScript config via `tsconfig.json`
- Package manager: npm

Local Development
- Scripts: `dev`, `build`, `preview`, `astro` (see `package.json`).
- Start dev server: `npm run dev` (Astro defaults to port 4321).

Build & Deploy
- Build output: `dist/` via `npm run build`.
- No adapter configured; defaults to static output suitable for any static host.

Project Structure
- `src/pages/` – page routes (file-based).
- `src/layouts/` – shared page frames; uses `<slot />` for content.
- `src/components/` – presentational components.
- `src/assets/` – static assets (SVGs, images).

TypeScript
- `tsconfig.json` extends `astro/tsconfigs/strict` to enable Astro type checking.

Dependencies
- Runtime: `astro` only (no additional UI libs or adapters yet).

