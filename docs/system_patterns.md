System Patterns

Overview
- This repository is the Astro "Basics" starter scaffolded with Astro 5.
- The site is a static, content-first app with zero server/runtime code.

Architecture
- Entry routing: Requests map to files under `src/pages/` (file-based routing).
- Composition: Pages import a shared `Layout` and render child components via `<slot />`.
- Presentation: Styles are co-located inside `.astro` components using `<style>` blocks.
- Assets: Static assets (SVG) are imported and referenced via `asset.src`.

Critical Paths
- Page: `src/pages/index.astro` → wraps content with `src/layouts/Layout.astro` → renders `src/components/Welcome.astro`.
- Build: `npm run build` runs Astro's static build to `dist/` per `astro.config.mjs` defaults.

Design Decisions
- File-based routing minimizes router configuration and encourages simple page composition.
- Slot-based layout isolates document head/body scaffolding from page content for reuse.
- Co-located CSS improves discoverability for small components; acceptable at current scale.

Non-Goals (current)
- No islands/interactive components, server endpoints, or SSR adapters are configured.

Dependencies Between Components
- `index.astro` depends on `Layout.astro` and `Welcome.astro`.
- `Welcome.astro` depends on assets in `src/assets/`.

Risks/Constraints
- As pages/components grow, co-located styles can become harder to share; consider extracting shared styles when needed.

