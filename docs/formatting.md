Formatting & Style

General
- Follow Astro conventions for `.astro` files: frontmatter `---` block, markup, and a trailing `<style>` block when needed.
- Keep styles co-located with their component when they are specific to that component.

Whitespace & Indentation
- Preserve existing indentation style used in the repo (tabs in current `.astro` files).
- Avoid reformatting unrelated code in edits.

Imports & Ordering
- Place imports within the frontmatter section at the top of `.astro` files.
- Group project imports by proximity (`../components`, `../layouts`, `../assets`).

CSS
- Prefer component-scoped styles in `.astro` files; extract shared styles only when duplication becomes evident.

