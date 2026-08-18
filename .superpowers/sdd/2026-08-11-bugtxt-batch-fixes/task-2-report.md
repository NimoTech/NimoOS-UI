# Task 2 Report: Deep-theme native select popup white-on-white fix (console-svc)

## Summary

Fixed Bug 8: dark-theme native `<select>` dropdown in `AppConsolePage.vue` rendered white-on-white in the popup list.

**Root cause:** The guard regex `/<select\b[^>]*>/g` was cut short by `>` inside attribute values (e.g. `v-if="serviceNames.length > 1"`), causing `console-svc` to be silently skipped for one release cycle.

**Solution:** Made the regex quote-aware + fixed the overlooked element's CSS.

## Changes

### 1. `src/styles/selectPopup.test.ts` (lines 135-140)
- **Regex fix:** Changed from `/<select\b[^>]*>/g` to `/<select\b(?:"[^"]*"|'[^']*'|[^>])*>/g`
- **Reason:** Now correctly skips quoted attribute values containing `>` before finding the tag closure
- **Comment added:** Documented why quote-awareness is needed (reference to console-svc being skipped)

### 2. `src/apps/views/AppConsolePage.vue` (lines 153-156)
- **CSS added:** `.console-svc option, .console-svc optgroup { background-color: var(--set-option-bg); color: var(--set-option-fg); }`
- **Comment added:** Explains the Chrome behavior (author background bleeds into native popup) and rationale
- **Token reuse:** Uses existing `--set-option-bg` / `--set-option-fg` tokens (defined in `src/styles/theme.sp9.css`, same tokens used in 6 other locations)

## Test Results

### RED Run (Step 2):
```
 FAIL  src/styles/selectPopup.test.ts > ... > 作者背景是渐变或半透明的 <select>,必须显式钉住 option 的实心底色
...
  ../apps/views/AppConsolePage.vue  class="console-svc"  ← .console-svc 的背景 = linear-gradient(160deg, rgba(255, 255, 255, 0.26), rgba(255, 255, 255, 0.1))
```

✓ Confirmed the guard now correctly catches the overlooked element

### GREEN Run (Step 4):
```
 Test Files  1 passed (1)
      Tests  4 passed (4)
```

✓ All 4 tests pass:
1. "全仓至少扫到了 10 个 <select>(防守卫空转)" — PASS
2. "作者背景是渐变或半透明的 <select>,必须显式钉住 option 的实心底色" — PASS
3. "写了 option 底色的地方必须把 optgroup 一起覆盖" — PASS
4. "option 用的底色 token 在两套主题里都有值、且都是实心色" — PASS

## Commit

- **Short SHA:** `07c91b9c`
- **Subject:** `fix(apps): pin solid option colors on the console service select`
- **Body:** Explains the root cause (quote-truncation) and the fix (quote-aware extraction)

## Files Touched

1. `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/acceptance-bugfixes/src/styles/selectPopup.test.ts`
2. `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/acceptance-bugfixes/src/apps/views/AppConsolePage.vue`

## Concerns

None. The regex pattern is standard quote-aware extractor (double + single quotes + unquoted chars). Token reuse is consistent with existing patterns. All guard tests pass, including the "防守卫空转" protection (detects if fewer than 10 selects are scanned).
