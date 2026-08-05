# Task 2 Report: Lazy Image Thumbnails (FileThumb + useInView)

## Files Created/Modified

**Created:**
- `src/files/util/isImage.ts` — `isImageEntry()` using `IMAGE_EXTS` + `fileExt`
- `src/files/util/isImage.test.ts` — 2 test cases
- `src/files/composables/useInView.ts` — one-shot IntersectionObserver, degrades in jsdom
- `src/files/components/FileThumb.vue` — lazy `<img>` for images, icon fallback for non-images
- `src/files/components/FileThumb.test.ts` — 3 test cases with fake IO

**Modified:**
- `src/files/components/FileTile.vue` — replaced `<img class="tile-icon">` with `<FileThumb class="tile-icon" :entry>`
- `src/files/components/FileRow.vue` — removed `iconNameFor/iconUrl` imports, added `FileThumb`, replaced `<img class="file-icon">` with `<FileThumb class="file-icon" :entry>`
- `src/files/components/FileRow.test.ts` — added `stubs: { FileThumb: true }`, changed icon assertion from `img.file-icon` to `.file-icon` existence

## TDD RED/GREEN Evidence

### isImage (Steps 2 → 4)
- RED: `npx vitest run src/files/util/isImage.test.ts` → FAIL (`Cannot find module './isImage'`)
- GREEN: after writing `isImage.ts` → 2 passed (2)

### FileThumb (Steps 7 → 9)
- RED: `npx vitest run src/files/components/FileThumb.test.ts` → FAIL (`Cannot find module './FileThumb.vue'`)
- GREEN: after writing `FileThumb.vue` → 3 passed (3)

## Step-13 Batch Result

```
npx vitest run src/files/components/FileRow.test.ts src/files/components/FileThumb.test.ts src/files/util/isImage.test.ts src/views/Files.test.ts

Test Files  4 passed (4)
     Tests  11 passed (11)
```

All green. `Files.test.ts` uses only non-image entries → FileThumb renders icon branch, `service.image` never called.

## Commit

`14f4869` — `feat(files): lazy image thumbnails (FileThumb + useInView), wired into tile/row`

## Self-Review

- `showThumb` is only true when `isImageEntry && inView && !errored` — non-image entries never call `service.image.thumbUrl`.
- `.tile-icon` / `.file-icon` sizing classes are on the `<FileThumb>` element (not the inner span) so parent scoped CSS still sizes the component root.
- `useInView` degrades immediately to `inView=true` when `IntersectionObserver` is absent (jsdom), ensuring non-IO test environments don't silently stall.
- FileRow.test uses `stubs: { FileThumb: true }` so it doesn't need a service mock.
- No concerns. All steps completed exactly per brief.
