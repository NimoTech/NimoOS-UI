## Task 2: 把 picker 改名为 `PhotosLibraryPicker`

**Files:**
- Rename: `src/photos/components/AlbumLibraryPicker.vue` → `src/photos/components/PhotosLibraryPicker.vue`
- Rename: `src/photos/components/__tests__/AlbumLibraryPicker.test.ts` → `.../PhotosLibraryPicker.test.ts`
- Modify: `src/views/PhotosAlbums.vue` · `src/views/PhotosAlbumDetail.vue`
- Modify: `oss/manifest.mjs`

**Interfaces:**
- Consumes: 无
- Produces: 组件新路径 `src/photos/components/PhotosLibraryPicker.vue`，**props 与 emits 一字不改**

> **这一步只改名字，不改任何行为。** P1 已经把这个组件泛化成与相册无关的通用 picker，
> 名字从那时起就在说谎；本任务只是还这笔债。**任何 props/emits/逻辑改动都属越界。**

- [ ] **Step 1: 记录基线**

```bash
pnpm exec vitest run src/photos/components/__tests__/AlbumLibraryPicker.test.ts \
  src/views/__tests__/PhotosAlbums.test.ts src/views/__tests__/PhotosAlbumDetail.test.ts --reporter=verbose
```

把三个文件各自的条数记进报告。**改名后必须一条不少。**

- [ ] **Step 2: 用 `git mv` 改名（保住历史）**

```bash
git mv src/photos/components/AlbumLibraryPicker.vue src/photos/components/PhotosLibraryPicker.vue
git mv src/photos/components/__tests__/AlbumLibraryPicker.test.ts src/photos/components/__tests__/PhotosLibraryPicker.test.ts
```

- [ ] **Step 3: 改所有引用点**

先找全：

```bash
grep -rn "AlbumLibraryPicker" src oss --include='*.vue' --include='*.ts' --include='*.mjs'
```

逐处把标识符 `AlbumLibraryPicker` 换成 `PhotosLibraryPicker`、路径换成新路径。涉及：
- `src/views/PhotosAlbums.vue`：`import` 语句 + 模板里的组件标签
- `src/views/PhotosAlbumDetail.vue`：同上
- `src/photos/components/__tests__/PhotosLibraryPicker.test.ts`：`import` 与 `describe` 标题
- `oss/manifest.mjs`：剥离清单里的路径（**两个文件都要**：组件与它的测试）

在组件文件头把 P1 登记的「名字说谎」那条债改成已还，写明改名发生在 SP15-P2a、且只改名不改行为。

- [ ] **Step 4: 跑测试确认零回归**

```bash
pnpm exec vitest run src/photos/components/__tests__/PhotosLibraryPicker.test.ts \
  src/views/__tests__/PhotosAlbums.test.ts src/views/__tests__/PhotosAlbumDetail.test.ts --reporter=verbose
pnpm exec vue-tsc --noEmit
pnpm exec vitest run oss
```

Expected: 三个测试文件条数与 Step 1 逐一相等；`vue-tsc` clean；`oss` 全绿。

> **`oss` 若变红**：说明剥离清单里还留着旧路径（清单对不存在的路径会 `exit 1`，这是设计好的过期报警）。改清单里的路径，**不要**去动 `oss/forbidden.mjs` 的词表。

- [ ] **Step 5: 全仓确认没有残留**

```bash
grep -rn "AlbumLibraryPicker" src oss packages docs || echo "clean"
```

Expected: `clean`（`docs/` 里的历史设计文档若提到旧名字，那是历史记录，保留不改 —— 只确认 `src`/`oss`/`packages` 干净）。

- [ ] **Step 6: 提交**

```bash
git add -A src/photos/components src/views/PhotosAlbums.vue src/views/PhotosAlbumDetail.vue oss/manifest.mjs
git commit -m "refactor(photos): rename the library picker to match what it does

P1 made this component collection-agnostic — both halves of its album-specific
behaviour moved out to its callers — but left the name, and registered the gap as
debt. The smart view detail page becomes its third consumer, so the name is now
actively misleading.

Rename only: props, emits and behaviour are untouched, and the album pages'
existing tests carry over unchanged as the evidence."
```

---

