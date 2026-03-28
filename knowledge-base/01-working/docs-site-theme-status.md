---
date created: 2026-03-28
date modified: 2026-03-28
temperature: working
tags:
  - docs-site
  - theme
  - starlight
  - blocked
related:
  - "[[2026-03-28-multi-instance-sync-testing]]"
---

# Docs Site Theme Status

## Current State

The Clasty docs site (`docs-site/`) uses **Starlight's default theme**. The intended theme stack is:

| Plugin | Purpose | Status |
|--------|---------|--------|
| `starlight-theme-obsidian` (Fevol) | Obsidian Publish visual aesthetic | **Blocked** — Astro v6 / Zod v4 compat issue |
| `starlight-site-graph` (Fevol) | Interactive graph view + backlinks | **Blocked** — same issue (bundled by theme) |
| `starlight-obsidian` (HiDeoo) | Import knowledge-base/ as OFM vault | **Working** |
| `remark-mermaidjs` | Mermaid diagram rendering | **Working** |
| `@flowershow/remark-wiki-link` | Wikilink support across all pages | **Working** |

## The Blocker

`starlight-theme-obsidian@0.4.1` depends on `starlight-site-graph@^0.5.0`. When the theme initializes the graph plugin, it fails with:

```
Invalid options passed to "starlight-site-graph-integration" integration
Hint: Invalid input: expected map, received object
```

This is a Zod v4 serialization issue introduced by Astro v6 (which upgraded from Zod v3 to Zod v4). The graph plugin's option schema uses Zod `map()` which changed behavior between versions.

## What to Watch

- [ ] `starlight-site-graph` releases a version > 0.5.0 with Astro v6 / Zod v4 fix
- [ ] `starlight-theme-obsidian` updates its peer dep to require the fixed graph version
- [ ] GitHub issues to monitor:
  - https://github.com/Fevol/starlight-site-graph/issues (check for Astro v6 compat issues)
  - https://github.com/Fevol/starlight-theme-obsidian/issues

## How to Re-enable

When the fix lands, in `docs-site/astro.config.mjs`:

1. Uncomment the import:
```js
import starlightThemeObsidian from 'starlight-theme-obsidian';
```

2. Uncomment the plugin:
```js
plugins: [
  starlightObsidian({ ... }),
  starlightThemeObsidian(),  // uncomment this
],
```

3. Update versions:
```bash
cd docs-site && bun update starlight-theme-obsidian starlight-site-graph
```

## Alternative: Custom CSS Theme

If the upstream fix takes too long, we can approximate the Obsidian Publish aesthetic with custom CSS:

```css
/* docs-site/src/styles/obsidian-theme.css */
:root {
  --sl-color-accent-low: #1a1a2e;
  --sl-color-accent: #e85d26;      /* magma orange — matches Clasty brand */
  --sl-color-accent-high: #f59e0b;
  --sl-color-gray-1: #e8e6e3;
  --sl-color-gray-5: #1a1a2e;
  --sl-color-gray-6: #0f0f17;
  --sl-color-black: #0f0f17;
}
```

Then add to astro.config.mjs:
```js
starlight({
  customCss: ['./src/styles/obsidian-theme.css'],
})
```

This gives us the Clasty color palette without waiting on the theme plugin.

## Decision

**DECISION-005: Docs Theme Approach — ACCEPTED**
- **Choice:** Custom CSS theme with Clasty brand palette (Option B)
- **Rationale:** Zero dependency risk, self-owned, resilient to upstream breakage. Brand consistency now > graph view later.
- **Implementation:** `docs-site/src/styles/clasty-theme.css` — overrides Starlight CSS variables for both dark and light mode
- **Graph view:** Kept as future goal (`starlight-site-graph` stays in package.json but not wired into config)
- **Theme plugin:** `starlight-theme-obsidian` removed from dependencies
