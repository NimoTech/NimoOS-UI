### Task 11: 类 2 替换 —— AddPanel 去照片 tab

**Files:**
- Create: `oss/files/AddPanel.vue`
- Modify: `oss/manifest.mjs`(`REPLACE` 第三条)
- Test: `oss/tree.test.mjs`

**Interfaces:**
- Consumes: `useAddPanel.ts` 的 `curTab`(已去掉 `'photo'`)
- Produces: 三 tab(小组件 / 应用 / 文件夹)的添加面板

**为什么走替换**:照片 tab 织进了 519 行里(模板块、tab 定义、`usePhotosStore`、`.lib-photo-*` 样式四处),抠起来比重写脆。

- [ ] **Step 1: 写失败断言**

```js
describe('类 2 · AddPanel', () => {
  it('照片 tab 与 photos store 全无', () => {
    const s = read('src/home/components/AddPanel.vue')
    for (const bad of ['usePhotosStore', 'photosStore', "curTab.value === 'photo'",
                       'addPanelNoPhotos', 'addPanelTabPhoto', 'lib-photo']) {
      expect(s, bad).not.toContain(bad)
    }
  })

  it('三个 tab 都还在', () => {
    const s = read('src/home/components/AddPanel.vue')
    for (const k of ["key: 'widget'", "key: 'app'", "key: 'folder'"]) expect(s).toContain(k)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run oss/tree.test.mjs -t 'AddPanel'`
Expected: FAIL(2 例)

- [ ] **Step 3: 拷一份并删四处**

```bash
cp src/home/components/AddPanel.vue oss/files/AddPanel.vue
```

按行号从后往前删(以 519 行版为准):
- `<style>`:484–496 的 `/* ── Photo grid ── */` 到 `.lib-photo-thumb img` 整段
- 409 行注释里的 `ic-photos` 字样改成泛化措辞(注释洗白)
- 225 行 `{ key: 'photo', label: 'addPanelTabPhoto' },` 一行
- 218 行 `const photosStore = usePhotosStore()` 与 131 行 `import { usePhotosStore } from '../stores/photos'`
- `<template>` 104–116 的 `<!-- Photo tab -->` 整块

- [ ] **Step 4: 加 `REPLACE` 条目(哈希钉同 T9/T10 的取法)**

- [ ] **Step 5: 跑产出树测试 + tsc**

```bash
pnpm exec vitest run oss/tree.test.mjs
node oss/export.mjs --out /tmp/oss-ap --skip-guard --no-commit
cd /tmp/oss-ap && pnpm install && pnpm exec vue-tsc --noEmit
```

Expected: 断言绿;`vue-tsc` 0 错。

- [ ] **Step 6: 提交**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
git add oss/manifest.mjs oss/files/AddPanel.vue oss/tree.test.mjs
git commit -m "feat(oss): AddPanel 去照片 tab"
```

---

