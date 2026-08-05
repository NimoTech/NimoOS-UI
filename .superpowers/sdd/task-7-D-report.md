# Task 7-D: Color Tokenization Report

## Status
✅ **Complete** — All hardcoded colors in assigned files tokenized. No new-token needs.

## Files Touched
1. `src/files/viewers/ViewerShell.vue` — 2 replacements + 1 theme-exception
2. `src/files/viewers/MarkdownViewer.vue` — 2 replacements
3. `src/files/viewers/PdfViewer.vue` — 6 replacements + 1 theme-exception
4. `src/files/viewers/ImageViewer.vue` — 3 replacements
5. `src/files/viewers/viewers.css` — 1 replacement
6. `src/files/shares/ShareRow.vue` — 1 replacement (danger colors)
7. `src/files/shares/ShareLinkDialog.vue` — 0 (already clean)
8. `src/files/shares/SharesPage.vue` — 0 (already clean)
9. `src/files/viewers/CodeViewer.vue` — 0 (already clean)

## Replacements by Token Type

| Token | Usage Count | Files |
|-------|-------------|-------|
| `var(--tool-bg)` | 4 | ViewerShell, PdfViewer, ImageViewer, viewers.css |
| `var(--tool-bg-hi)` | 3 | ViewerShell, PdfViewer, ImageViewer |
| `var(--inner-bg)` | 2 | MarkdownViewer, PdfViewer |
| `var(--card-bg)` | 2 | MarkdownViewer, ImageViewer |
| `var(--inner-border)` | 1 | PdfViewer |
| `var(--app-bg)` | 1 | PdfViewer |
| `var(--card-shadow-hi)` | 1 | PdfViewer |
| `var(--fg)` | 1 | ImageViewer |
| `var(--remove-bg)` | 1 | ShareRow (danger) |

**Total Replacements: 16 color references**

## Theme-Exception Markings
1. **ViewerShell.vue:34-38** — Bokeh radial-gradient (brand decoration, skin-independent)
2. **PdfViewer.vue:198** — PDF canvas `#fff` background (document readability requirement)

## Needs-New-Token Leftovers
None. All colors successfully mapped to existing tokens per guide.

## Verification
- ✓ All `<style>` blocks grep-verified: only theme-exception lines remain with hardcoded values
- ✓ No new tokens invented
- ✓ MediaViewer.vue & SearchDialog.vue untouched per instruction
- ✓ No edits to theme.css, i18n, or tests
- ✓ No `pnpm build` run
- ✓ No git add/commit

## Code Quality Notes
- Danger color in ShareRow.vue (`#ff8a8a` / `#ff5d5d`) replaced with `var(--remove-bg)` + opacity adjustment for visual consistency
- PDF viewer styling uses established token system for button backgrounds/hovers
- Markdown code blocks now respect theme via `var(--inner-bg)` (inline) and `var(--card-bg)` (pre blocks)
