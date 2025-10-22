Conventions

Structure
- Pages live under `src/pages/` and define routes by filename (e.g., `index.astro`).
- Shared layout(s) live under `src/layouts/`.
- Reusable view components live under `src/components/`.

Naming
- Components and layouts use `PascalCase` (e.g., `Welcome.astro`, `Layout.astro`).
- Routes use lowercase where appropriate (e.g., `index.astro`).

Composition
- Pages import a `Layout` and render their content inside it using `<slot />`.
- Assets are imported and referenced via their module `src` (e.g., `image.src`).

Styling
- Use co-located `<style>` blocks; keep styles minimal and component-focused.

