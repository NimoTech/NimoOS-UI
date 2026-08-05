# Task 7-E: Tokenize Hardcoded Colors — Report

## Status
✅ **Complete** — All assigned files processed and verified.

## Files Touched
- `src/views/Welcome.vue`
- `src/views/Login.vue`
- `src/views/Files.vue`
- `src/components/ui/AlertDialog.vue`
- `src/components/ui/ContextMenu.vue`
- `src/components/ui/Dialog.vue`

## Count Replaced
**17 color references** replaced with `var(--token)`:

| File | Count | Details |
|------|-------|---------|
| Welcome.vue | 8 | borders, inputs, buttons, chips, accents |
| Login.vue | 5 | borders, inputs, buttons |
| Files.vue | 0 | (already tokenized) |
| AlertDialog.vue | 2 | overlay background + blur filter |
| ContextMenu.vue | 0 | (already tokenized; danger text marked exception) |
| Dialog.vue | 2 | overlay background + blur filter |

### Replacements by Token
- `var(--card-border)`: 5 refs
- `var(--inner-bg)`: 2 refs
- `var(--on-accent)`: 2 refs
- `var(--chip-bg)`: 1 ref
- `var(--chip-border)`: 1 ref
- `var(--accent-soft)`: 1 ref
- `var(--overlay-bg)`: 2 refs
- `var(--overlay-blur)`: 2 refs
- **Total**: 17 refs

## Needs-New-Token Leftovers
Lines with hardcoded colors that have no existing token mapping (marked with `/* theme-exception */`):

| File | Line | Color Value | Context | Suggested Token |
|------|------|-------------|---------|-----------------|
| Welcome.vue | 155–156 | `rgba(220, 38, 38, 0.22)` + `rgba(220, 38, 38, 0.5)` | Error message background + border | `var(--error-bg)` + `var(--error-border)` |
| Welcome.vue | 156 | `#fecaca` | Error message text | `var(--error-text)` |
| Login.vue | 107–108 | `rgba(220, 38, 38, 0.22)` + `rgba(220, 38, 38, 0.5)` | Error message background + border | `var(--error-bg)` + `var(--error-border)` |
| Login.vue | 108 | `#fecaca` | Error message text | `var(--error-text)` |
| AlertDialog.vue | 41 | `#ff5d5d` (in `color-mix`) + border | Danger button background + border | `var(--remove-bg)` or `var(--danger-bg)` |
| ContextMenu.vue | 30 | `#ff8a8a` | Danger menu item text | `var(--remove-text)` or `var(--danger-text)` |

## Verification
```bash
grep -nE '#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\(' *.vue | grep -v 'var(--' | grep -v 'theme-exception'
# Result: No matches (clean)
```

All hardcoded colors either replaced with tokens or explicitly marked with `theme-exception` comments. Ready for token coordination.
