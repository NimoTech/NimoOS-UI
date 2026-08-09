# Task 1 Report: Wallpaper Store Core (Pure Logic + Built-in Resources)

## Implementation Summary

Task 1 is **DONE**. Implemented the complete wallpaper record model, URL derivation, and DOM application layer as the root of the SP11 wallpaper system. This task contains pure logic + two built-in JPEG assets. Later tasks add CSS styling (Task 2), Pinia store integration (Task 4), and the picker UI (Task 6+).

## Files Created

1. **`src/assets/wallpaper/wallpaper01.jpg`** (2.2 MB)
   - Copied byte-for-byte from `../NimoOS-UI/src/assets/background/wallpaper01.jpg`
   - No transcoding, no compression (per spec §4.6 and owner decision 2026-08-07)

2. **`src/assets/wallpaper/wallpaper02.jpg`** (848 KB)
   - Copied byte-for-byte from `../NimoOS-UI/src/assets/background/wallpaper02.jpg`
   - No transcoding, no compression

3. **`src/stores/wallpaper.ts`** (84 lines)
   - Type definitions: `BuiltinId`, `WallpaperRecord`
   - Exported constants: `BUILTIN_IDS`, `NONE`, `WALLPAPER_CUSTOM_KEY`, `WALLPAPER_IMAGE_KEY`, `WALLPAPER_CACHE_KEY`, `MAX_UPLOAD_BYTES`
   - Exported functions: `builtinUrl()`, `recordUrl()`, `parseRecord()`, `applyWallpaper()`, `cacheRecord()`, `initialWallpaper()`

4. **`src/stores/wallpaper.test.ts`** (108 lines)
   - 13 test cases covering all functions and edge cases
   - Uses vitest with jsdom environment for localStorage and DOM access

## TDD Evidence

### RED Phase (Tests Failed)

```bash
$ pnpm vitest run src/stores/wallpaper.test.ts
# Output:
# FAIL  src/stores/wallpaper.test.ts
# Error: Failed to resolve import "./wallpaper" from "src/stores/wallpaper.test.ts".
# Does the file exist?
```

Expected failure: The wallpaper.ts implementation file did not exist, so the test file could not import it.

### GREEN Phase (Tests Passed)

```bash
$ pnpm vitest run src/stores/wallpaper.test.ts
# Output:
#  Test Files  1 passed (1)
#       Tests  13 passed (13)
#   Start at  21:27:21
#   Duration  638ms
```

All 13 tests pass:
- **constants**: 1 test (all pinned values match spec)
- **builtinUrl**: 1 test (both builtins resolve to distinct URLs)
- **recordUrl**: 4 tests (none/builtin/image cases, URL encoding, cache busting)
- **parseRecord**: 2 tests (valid shapes accepted, all malformed inputs degrade to NONE)
- **applyWallpaper**: 2 tests (setting and clearing wallpaper on DOM)
- **cacheRecord / initialWallpaper**: 3 tests (localStorage round-trip, NONE handling, corrupt data resilience)

### Type Checking

```bash
$ pnpm exec vue-tsc --noEmit
# (No output = no errors)
```

Exit code 0 with no output confirms all types are correct.

## Commit

Created one commit: **c4e63bd** (fmt: `feat(wallpaper): add record model, url derivation and dom application`)

```
commit c4e63bd574c927a6f434f3b61e24354edcb8aed3
Author: Tiansanchuan <1312528051@qq.com>
Date:   Fri Aug 7 21:27:55 2026 +0800

    feat(wallpaper): add record model, url derivation and dom application
    
    Builtin wallpapers store a stable id rather than a build-hashed URL so a
    redeploy cannot break an existing selection, and image records carry a stamp
    because the backend overwrites one fixed filename per user.
    
    Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
```

Committed using the exact command from the brief with `-o` pathspec form to avoid sweeping staged deletions.

## Self-Review Findings

### Completeness
- ✅ All exports from the brief are implemented with exact names and signatures
- ✅ Both JPEGs copied byte-for-byte (sizes: 2.2M, 848K match expected ~2.2M and ~848K)
- ✅ All 13 test cases from the brief are present and passing
- ✅ No `defineStore` added (Pinia integration deferred to Task 4 per spec)
- ✅ Only files listed in the brief were touched

### Code Quality
- ✅ All comments and error messages in English
- ✅ Type safety: Uses type guards (`isBuiltinId`), `as const satisfies`, `Record<>` mapping
- ✅ Error handling: `parseRecord()` never throws, degrades all malformed inputs to `NONE`; `initialWallpaper()` catches JSON parse errors
- ✅ CSS integration: Functions correctly set/clear `data-wallpaper` attribute and `--wallpaper-img` CSS variable for theme.css to key off
- ✅ URL encoding: `recordUrl()` percent-encodes image paths and appends cache-bust stamp
- ✅ localStorage API: Symmetric `cacheRecord()` / `initialWallpaper()` pair; clearing is explicit (removes key rather than storing null blob)

### Test Quality
- ✅ **Constants**: All pinned values verified (WALLPAPER_CUSTOM_KEY must be 'wallpaper_v3' to avoid conflicts with Vue2)
- ✅ **Builtin URL resolution**: Both IDs map to distinct, resolvable URLs containing the right filenames
- ✅ **Image URL encoding**: Spaces and slashes in paths are percent-encoded; stamp parameter varies per record to bust browser cache
- ✅ **Malformed input robustness**: 13 distinct invalid inputs all degrade to NONE (tests use `JSON.stringify(bad)` as assertion label for clarity)
- ✅ **DOM application**: Both setting (with builtin) and clearing (with NONE) are tested; clearing removes both the attribute and the CSS variable
- ✅ **localStorage round-trip**: Valid records survive JSON.stringify → setItem → getItem → JSON.parse → parseRecord
- ✅ **Cache resilience**: Missing cache yields NONE; corrupted JSON yields NONE; string values (which JSON.parse succeeds on) also yield NONE

### Naming & Conventions
- ✅ Constants use UPPER_SNAKE_CASE and are immutable (`as const`)
- ✅ Functions use camelCase and are side-effect-free except `applyWallpaper` and `cacheRecord` (which are named to signal mutation)
- ✅ Type names use PascalCase (`BuiltinId`, `WallpaperRecord`)
- ✅ Comments explain *why* not what (e.g., "The server key MUST stay wallpaper_v3" rather than "This is the server key")

### Spec Alignment
- ✅ **Spec §2.3**: WALLPAPER_CUSTOM_KEY is deliberately NOT 'wallpaper' (Vue2 separation)
- ✅ **Spec §4.6**: JPEGs copied byte-for-byte, no re-encoding (cost ~3MB is accepted)
- ✅ **Spec §7**: Image URL is relative (same-origin `/v1/users/image?…`) not absolute with SERVER_URL placeholder (Vue2's approach is not ported)
- ✅ **Spec §8.2**: MAX_UPLOAD_BYTES capped at 10MB (deliberate deviation from Vue2)

### No Concerns
- No YAGNI violations (each function is used by tests and matches the brief)
- No dead code paths
- No uncovered test cases
- No implicit any or type errors
- No hardcoded colors (pure logic, no CSS)
- No console.log or debug artifacts

## Integration Notes

This task is the root of the wallpaper system. Later tasks depend on these exports:
- Task 2 (CSS styling) will write theme.css rules that key off `data-wallpaper` and use the `--wallpaper-img` variable
- Task 4 (Pinia store) will wrap these functions in store actions
- Task 6+ (Picker UI) will call these functions to change and persist wallpapers

The two built-in images are now at permanent locations (`src/assets/wallpaper/`) and will be hashed by Vite at build time (so stable IDs 'w01'/'w02' can survive redeployments).

---

**Status**: DONE  
**Test result**: 13/13 passing  
**Type check**: ✅ No errors  
