### Task 9: 类 2 替换 —— 桌面默认布局重排

**Files:**
- Create: `oss/files/defaultLayout.ts`
- Modify: `oss/manifest.mjs`(`REPLACE` 第一条)
- Test: `oss/tree.test.mjs`

**Interfaces:**
- Consumes: `src/home/grid/types.ts` 的 `LayoutItem`(已去掉 `'photo'`)
- Produces: `DEFAULT: Omit<LayoutItem,'id'>[]`,**不再导出 `PHOTO_PLACEHOLDERS`**

**为什么这个文件天生就该不一样**:开源版是重排后的新桌面,`PHOTO_PLACEHOLDERS` 整个不存在 —— 没有可继承的东西,所以走替换而不是补丁。

**账**:12×8 = 96 格。私有版默认占 86 格;删掉 AI 组件(4×4=16)、3 张照片磁贴(各 2×2=12)、photos/ai 两个应用磁贴(2)后剩 56 格,空 30 格 = 31%。重排后占 **69 格**,填满上面 6 行,**最后两行故意留空**给用户自己加。

**尺寸硬约束**(必须落在 `registry.ts` 各自的 `min`/`max` 内):`clock` [2,1]–[4,2] · `storage` [2,2]–[4,2] · `network` [2,2]–[4,4] · `events` [2,2]–[2,4] · `gpu` [2,2]–[4,2] · `cpu` [2,2]–[4,3]。

- [ ] **Step 1: 写失败断言**

```js
describe('类 2 · 桌面默认布局', () => {
  it('不再导出 PHOTO_PLACEHOLDERS,没有 photo 磁贴与 ai 组件', () => {
    const s = read('src/home/grid/defaultLayout.ts')
    expect(s).not.toMatch(/PHOTO_PLACEHOLDERS|kind: 'photo'|key: 'ai'/)
  })

  it('占 69 格,全部落在 12×8 内且不重叠', () => {
    const s = read('src/home/grid/defaultLayout.ts')
    const items = [...s.matchAll(/c:\s*(\d+),\s*r:\s*(\d+),\s*w:\s*(\d+),\s*h:\s*(\d+)/g)]
      .map(([, c, r, w, h]) => ({ c: +c, r: +r, w: +w, h: +h }))
    expect(items.length).toBe(15)
    const seen = new Set()
    let cells = 0
    for (const it of items) {
      expect(it.c + it.w - 1, JSON.stringify(it)).toBeLessThanOrEqual(12)
      expect(it.r + it.h - 1, JSON.stringify(it)).toBeLessThanOrEqual(8)
      for (let x = it.c; x < it.c + it.w; x++) for (let y = it.r; y < it.r + it.h; y++) {
        const k = `${x},${y}`
        expect(seen.has(k), `重叠于 ${k}`).toBe(false)
        seen.add(k); cells++
      }
    }
    expect(cells).toBe(69)
  })

  it('最后两行(r7/r8)完全留空', () => {
    const s = read('src/home/grid/defaultLayout.ts')
    const items = [...s.matchAll(/r:\s*(\d+),\s*w:\s*\d+,\s*h:\s*(\d+)/g)].map(([, r, h]) => +r + +h - 1)
    expect(Math.max(...items)).toBe(6)
  })

  it('每个小组件的落位尺寸都在 registry 的 min/max 内', () => {
    const layout = read('src/home/grid/defaultLayout.ts')
    const reg = read('src/home/widgets/registry.ts')
    const ranges = {}
    for (const [, k, mw, mh, xw, xh] of reg.matchAll(
      /(\w+):\s*\{[^}]*min:\s*\[(\d+),\s*(\d+)\][^}]*max:\s*\[(\d+),\s*(\d+)\]/g)) {
      ranges[k] = { min: [+mw, +mh], max: [+xw, +xh] }
    }
    for (const [, key, w, h] of layout.matchAll(
      /kind:\s*'widget',\s*key:\s*'(\w+)',\s*c:\s*\d+,\s*r:\s*\d+,\s*w:\s*(\d+),\s*h:\s*(\d+)/g)) {
      const r = ranges[key]
      expect(r, `registry 里没有 ${key}`).toBeTruthy()
      expect(+w, `${key}.w`).toBeGreaterThanOrEqual(r.min[0]); expect(+w, `${key}.w`).toBeLessThanOrEqual(r.max[0])
      expect(+h, `${key}.h`).toBeGreaterThanOrEqual(r.min[1]); expect(+h, `${key}.h`).toBeLessThanOrEqual(r.max[1])
    }
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run oss/tree.test.mjs -t '桌面默认布局'`
Expected: FAIL(4 例)

- [ ] **Step 3: 写 `oss/files/defaultLayout.ts`(坐标已定死)**

```ts
import type { LayoutItem } from './types'

// 开源版默认桌面:12 列 × 8 行 = 96 格,占 69 格,上面 6 行填满,最后两行故意留空
// 给用户自己加。尺寸全部落在 widgets/registry.ts 各自的 min/max 内。
//
//      c1   c2   c3   c4  | c5   c6   c7   c8  | c9   c10 | c11  c12
// r1  [ 时钟 4×2         ][ 存储 4×2          ][ GPU 4×2            ]
// r2  [                  ][                   ][                    ]
// r3  [ 网络 4×4         ][ CPU 4×3           ][事件 2×4 ][文件][设置]
// r4  [                  ][                   ][         ][商店][虚机]
// r5  [                  ][                   ][         ][存储][    ]
// r6  [                  ][文档][下载][媒体][图库][      ][    ][    ]
// r7   （留空）
// r8   （留空）
export const DEFAULT: Omit<LayoutItem, 'id'>[] = [
  // 顶部三条 4×2 小组件带
  { kind: 'widget', key: 'clock', c: 1, r: 1, w: 4, h: 2 },
  { kind: 'widget', key: 'storage', c: 5, r: 1, w: 4, h: 2 },
  { kind: 'widget', key: 'gpu', c: 9, r: 1, w: 4, h: 2 },

  // 中段大组件
  { kind: 'widget', key: 'network', c: 1, r: 3, w: 4, h: 4 },
  { kind: 'widget', key: 'cpu', c: 5, r: 3, w: 4, h: 3 },
  { kind: 'widget', key: 'events', c: 9, r: 3, w: 2, h: 4 },

  // 右侧系统应用磁贴列(c11-12,r3-5)
  { kind: 'app', key: 'files', c: 11, r: 3, w: 1, h: 1 },
  { kind: 'app', key: 'settings', c: 12, r: 3, w: 1, h: 1 },
  { kind: 'app', key: 'appstore', c: 11, r: 4, w: 1, h: 1 },
  { kind: 'app', key: 'vm', c: 12, r: 4, w: 1, h: 1 },
  { kind: 'app', key: 'storage', c: 11, r: 5, w: 1, h: 1 },

  // 底部文件夹磁贴带(c5-8,r6)—— LocalStorage 开机自建的四个系统目录
  { kind: 'folder', key: 'Documents', path: '/DATA/Documents', c: 5, r: 6, w: 1, h: 1 },
  { kind: 'folder', key: 'Downloads', path: '/DATA/Downloads', c: 6, r: 6, w: 1, h: 1 },
  { kind: 'folder', key: 'Media', path: '/DATA/Media', c: 7, r: 6, w: 1, h: 1 },
  { kind: 'folder', key: 'Gallery', path: '/DATA/Gallery', c: 8, r: 6, w: 1, h: 1 },
]
```

- [ ] **Step 4: 加 `REPLACE` 条目(带哈希钉)**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
node -e "console.log(require('node:crypto').createHash('sha256').update(require('node:fs').readFileSync('src/home/grid/defaultLayout.ts','utf8')).digest('hex'))"
```

把输出填进 `manifest.mjs`:

```js
export const REPLACE = [
  { path: 'src/home/grid/defaultLayout.ts', from: 'defaultLayout.ts',
    privateSha256: '<上面命令的输出>' },
]
```

- [ ] **Step 5: 跑产出树测试**

Run: `pnpm exec vitest run oss/tree.test.mjs`
Expected: PASS

- [ ] **Step 6: 手工确认哈希钉会响**

**⚠️ 不许用 `git checkout` / `git stash` 复原**(Global Constraints 已禁 —— 会卷走 index 里那 3 个
`design-export` 删除态)。用 `cp` 备份/还原,全程不碰 git:

```bash
F=src/home/grid/defaultLayout.ts
cp "$F" /tmp/probe-backup.ts
printf '\n// probe\n' >> "$F"
node oss/export.mjs --out /tmp/oss-probe2 --skip-guard --no-commit; echo "EXIT=$?"
cp /tmp/probe-backup.ts "$F" && rm /tmp/probe-backup.ts
git status --porcelain -- "$F"        # 必须为空 = 已完全还原
```

Expected:打印 `私有仓的 src/home/grid/defaultLayout.ts 变了(sha256 …)` 与 `请复核 oss/files/defaultLayout.ts`,`EXIT=1`。

- [ ] **Step 7: 双主题截图自查**

产出树装依赖后起 dev server(端口避开 5273/5277/5288 三条在跑的线),用缓存里的 chromium 截图暗色 + 亮色两套首屏:

```bash
node oss/export.mjs --out /tmp/oss-preview --skip-guard --no-commit
cd /tmp/oss-preview && pnpm install && pnpm dev --port 5299 &
# 截图脚本参考记忆 headless-chrome-screenshot-check 的手法
```

自查点:上面 6 行填满不漏、最后两行留空、组件不重叠不溢出、暗色与亮色都正常。**截图交用户眼验,坐标允许在此步微调**(改了要回到 Step 5 重跑断言)。

- [ ] **Step 8: 提交**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
git add oss/manifest.mjs oss/files/defaultLayout.ts oss/tree.test.mjs
git commit -m "feat(oss): 开源版桌面默认布局(69/96 格,末两行留空)"
```

---

