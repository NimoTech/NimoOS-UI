## Task 5: F17 布局封顶 + 防复发闸

**Files:**
- Modify: `src/views/Files.vue`（`<style scoped>` 的 `.files-layout` / `.files-main` / `.files-listwrap`）
- Test: `src/views/__tests__/filesLayoutHeightCap.test.ts`（新建）

**Interfaces:**
- Consumes: 无
- Produces: 无

- [ ] **Step 1: 写失败的守卫测试**

创建 `src/views/__tests__/filesLayoutHeightCap.test.ts`：

```ts
// Bidirectional regression guard for the Files area .files-layout height capping —
// same origin and logic as photosLayoutHeightCap.test.ts in the photos area,
// except Files has only one page.
//
// Background: .files-layout originally had `min-height: 100%` (at least one viewport height,
// can grow unbounded) instead of `height: 100%`. The sidebar with align-self:stretch then
// stretched to content height instead of viewport height, and the only scroller became
// AreaShell's .area-body ⇒ sidebar and breadcrumb scrolled away with the file listing,
// and the sidebar's own overflow-y:auto never engaged (can't reach favorites when there are many).
//
// Unlike the photos area: photos had 11 pages each with an inner scroll container already,
// Files has none — so capping must be done together with building the container. Changing
// .files-layout alone would clip the listing. The three CSS rules are one unit: if any is
// missing the layout breaks, so this guard locks all three.
//
// jsdom doesn't do layout (getBoundingClientRect always 0), actual behavior is verified on device;
// this guard only locks source text and prevents regressions. Always read files with node:fs —
// `?raw` is always empty in this repo's test environment.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const SRC = readFileSync('src/views/Files.vue', 'utf8')

describe('Files area .files-layout height capping', () => {
  it('forward: .files-layout uses height: 100% to cap', () => {
    expect(SRC).toContain('.files-layout { display: flex; gap: 16px; align-items: flex-start; height: 100%; }')
  })

  it('backward: must not regress to min-height: 100%', () => {
    expect(
      SRC.includes('.files-layout { display: flex; gap: 16px; align-items: flex-start; min-height: 100%; }'),
      '.files-layout regressed to min-height:100%, sidebar and breadcrumb will scroll away with the file listing again',
    ).toBe(false)
  })

  it('.files-main has explicit min-height: 0 (without it child elements burst the parent, capping does nothing)', () => {
    const rule = SRC.split('\n').find((l) => l.trimStart().startsWith('.files-main {'))
    expect(rule, 'could not find .files-main rule').toBeTruthy()
    expect(rule).toContain('min-height: 0')
  })

  it('.files-listwrap has overflow-y: auto (after capping, it takes over scrolling)', () => {
    const rule = SRC.split('\n').find((l) => l.trimStart().startsWith('.files-listwrap {'))
    expect(rule, 'could not find .files-listwrap rule').toBeTruthy()
    expect(rule).toContain('overflow-y: auto')
  })

  it('.files-listwrap no longer uses min-height: 200px to prop up height', () => {
    const rule = SRC.split('\n').find((l) => l.trimStart().startsWith('.files-listwrap {'))
    expect(rule).not.toContain('min-height: 200px')
  })
})
```

- [ ] **Step 2: 跑测试确认它红**

Run: `pnpm exec vitest run src/views/__tests__/filesLayoutHeightCap.test.ts`
Expected: FAIL，5 例中 4 例红（只有「反向不许回退」那条此刻是红的反面——它现在就该红，因为文件里正是 `min-height`）

- [ ] **Step 3: 改三条 CSS**

`src/views/Files.vue` 的 `<style scoped>`，`:687-688` 与 `:695`：

```css
/* Height capping (not min-height) + .files-main's min-height:0 unblocks the flex shrinking chain
   + .files-listwrap takes over scrolling — these three are one unit. Without min-height:0, child
   elements burst the parent; without overflow-y, the listing gets clipped. After the change:
   sidebar and breadcrumb stay put, only the file listing scrolls, and FilesSidebar's own
   overflow-y:auto finally engages. */
.files-layout { display: flex; gap: 16px; align-items: flex-start; height: 100%; }
.files-main { position: relative; flex: 1 1 auto; min-width: 0; min-height: 0; align-self: stretch; display: flex; flex-direction: column; } /* Stretches to fill right-side height, so whitespace below the listing can be a right-click target */
```

以及 `.files-listwrap`：

```css
.files-listwrap { position: relative; flex: 1 1 auto; min-height: 0; overflow-y: auto; user-select: none; } /* flex:1 makes whitespace below the listing part of the reka-ui right-click trigger area; after capping, this container takes over scrolling */
```

- [ ] **Step 4: 跑测试确认它绿**

Run: `pnpm exec vitest run src/views/__tests__/filesLayoutHeightCap.test.ts`
Expected: PASS，5 例

- [ ] **Step 5: 跑全部 Files 相关测试确认没打破虚拟滚动/框选的既有断言**

Run: `pnpm exec vitest run src/views/Files.test.ts src/views/Files.openEntry.test.ts src/views/Files.contextTarget.test.ts src/views/Files.share.test.ts src/files/components/FileGridView.test.ts src/files/util/gridVirtual.test.ts`
Expected: 全 PASS

（两个测试文件都已确认存在：`src/files/components/FileGridView.test.ts`、`src/files/util/gridVirtual.test.ts`。）

- [ ] **Step 6: 提交**

```bash
git add src/views/Files.vue src/views/__tests__/filesLayoutHeightCap.test.ts
git commit -m "fix(files): pin the sidebar and breadcrumb, scroll the listing itself

.files-layout faked its height with min-height, so the sidebar stretched to
content height and AreaShell's .area-body became the only scroller -- sidebar
and breadcrumb scrolled away with the listing and the sidebar's own overflow
never engaged. Capping alone would clip the listing, so the listing wrapper
takes over scrolling in the same change."
```

---

