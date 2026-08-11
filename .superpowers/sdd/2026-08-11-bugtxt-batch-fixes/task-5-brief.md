### Task 5: Bug 6 — 文件夹图标溢出格子相互重叠

`theme.css`(约 703 行)的方形约束规则 `.kind-app .app-ic, .kind-folder .folder-ic, .kind-folder .folder-tile { flex:1 1 auto; min-height:0; width:auto; height:auto; aspect-ratio:1; }` 被 `FolderTile.vue:26` 的 scoped 规则 `.folder-ic { width:100%; height:100% }` 同分后置压掉(theme.css 在 main.ts 最先 import,SFC 样式后注入,特异度同为 0,2,0 时后者胜)。`.folder-ic` 是 `FileThumb` 的 inline-flex 根,内部 `<img>` 的固有尺寸(folder svg 多为 64×64)把内容最小宽度钉在 ~64px,窄窗口下格子缩到 60-75px 时溢出单格压到邻格。修法:删掉 scoped 覆盖,让 theme.css 方形规则生效,并给该规则补 `min-width: 0` 斩断替换元素的最小宽度下限。**只动 folder 侧;`AppTile.vue:46` 的 `.app-ic` 覆盖保持原样**(应用图标现状无 bug,动它属于无关视觉变更,验收时若发现 folder/app 尺寸失调再回来评估)。

**Files:**
- Modify: `src/home/components/FolderTile.vue`(删 26 行 scoped 规则)
- Modify: `src/styles/theme.css`(~703 行的方形规则加 `min-width: 0;` —— 动手前先读该行确认选择器原文)
- Create: `src/home/components/tileSizing.test.ts`(源码级守卫)

**Interfaces:**
- Consumes: theme.css 既有方形规则;`FileThumb.vue` 根元素(inline-flex,注释声明"尺寸由父级类名给到本组件根元素")。
- Produces: 无新接口;`.folder-ic` 尺寸自此完全由 theme.css 决定。

- [ ] **Step 1: 写红守卫测试**

Create `src/home/components/tileSizing.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import folderSrc from './FolderTile.vue?raw'
import themeSrc from '../../styles/theme.css?raw'

// bug.txt #6:FolderTile 的 scoped `.folder-ic { width:100%; height:100% }` 与
// theme.css 的方形规则(aspect-ratio:1)特异度同分,SFC 样式后注入而胜出,方形
// 规则整条变死规则;.folder-ic 内部 <img> 的 64px 固有宽度进而把磁贴撑出格子。
// 守卫:SFC 不得再对 .folder-ic 声明 width/height;theme.css 方形规则必须带
// min-width:0(替换元素 min-width:auto 的下限就是当年撑爆格子的元凶)。
describe('desktop tile sizing (bug.txt #6)', () => {
  const style = folderSrc.slice(folderSrc.indexOf('<style'))
  it('FolderTile scoped style must not redeclare .folder-ic width/height', () => {
    expect(style).not.toMatch(/\.folder-ic[^{]*\{[^}]*(width|height)\s*:/)
  })
  it('theme.css square-tile rule keeps aspect-ratio and min-width:0', () => {
    const rule = themeSrc.match(/\.kind-folder \.folder-ic[^{]*\{[^}]*\}/)?.[0] ?? ''
    expect(rule).toMatch(/aspect-ratio\s*:\s*1/)
    expect(rule).toMatch(/min-width\s*:\s*0/)
  })
})
```

Run: `pnpm vitest run src/home/components/tileSizing.test.ts`
Expected: FAIL(两条都红)

- [ ] **Step 2: 改实现**

1. `src/home/components/FolderTile.vue`:删除 `.folder-ic { width: 100%; height: 100%; }` 一行,并把 23 行注释改为:`/* .kind-folder 列布局 + .folder-ic 尺寸(方形 aspect-ratio 规则)全在全局 theme.css —— 不要在此覆盖 width/height,同分后置会压掉方形规则(bug.txt #6) */`
2. `src/styles/theme.css` ~703 行:先 Read 确认原文,在该规则的声明块里 `min-height: 0;` 后加 `min-width: 0;`。

- [ ] **Step 3: 跑守卫与既有测试**

Run: `pnpm vitest run src/home/components/tileSizing.test.ts src/home/components/FolderTile.test.ts src/home/components/GridItem.edit.test.ts src/home/components/GridCanvas.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/home/components/FolderTile.vue src/styles/theme.css src/home/components/tileSizing.test.ts
git commit -m "fix(home): keep folder tiles inside their grid cell

FolderTile's scoped .folder-ic { width/height: 100% } outranked (same
specificity, later injection) the theme.css square-tile rule, reviving the
inner <img>'s 64px intrinsic min-width; on narrow windows cells shrink
below that and folder tiles overlapped their neighbours. Drop the scoped
override and add min-width:0 to the square rule, with a source-level guard
so the override cannot come back."
```

> 注:jsdom 无布局,真实宽度只能在 Task 8 的真机截图里复核(重点看窄窗口下 folder 磁贴)。

---

