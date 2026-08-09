### Task 9: #98 Knowledge 桌面磁贴

**Files:**
- Create: `src/home/apps/icons/knowledge.svg`
- Modify: `src/home/apps/systemApps.ts`
- Modify: `src/home/composables/useOpenAction.ts:36-52`
- Modify: `src/home/grid/defaultLayout.ts`
- Test: `src/home/apps/systemApps.test.ts`（若不存在则新建）· `src/home/composables/useOpenAction.test.ts`（补例）
- Modify: `src/i18n/zh_cn.ts` · `src/i18n/en_us.ts`（磁贴名是**桌面**文案，不在 `.ai` 分片里 —— 落笔前确认既有 `appFiles` / `appAi` 在哪个文件，跟着放）

**Interfaces:**
- Produces: `SYSTEM_APPS` 多一项 `{ key: 'knowledge', label: 'appKnowledge', … }`

**为什么这条值得做：** `/ai/knowledge` 有 11 条路由、9 项 rail、笔记/Wiki/队列/白名单全都实现了，但**全仓没有任何入口** —— 只有知识库内部互跳，桌面、AI 页、设置里都进不去。这不是「补个磁贴」，是补上唯一的入口。

- [ ] **Step 1: 搬图标**

```bash
cp /home/nimo/NimoTech/NimoOS-UI/src/assets/img/app/knowledge.svg src/home/apps/icons/knowledge.svg
```
（Vue2 那份是 #98 引入的 31 行 svg。若文件里有硬编码颜色，那属于「品牌识别色」例外 —— 与既有 `ai.svg` / `files.svg` 同一处置，不要 token 化。）

- [ ] **Step 2: 写失败的测试**

`src/home/apps/systemApps.test.ts`（若已存在就往里加）：

```ts
import { describe, it, expect } from 'vitest'
import { SYSTEM_APPS, SYSTEM_APP_KEYS } from './systemApps'

describe('SYSTEM_APPS —— knowledge(SP14 #98)', () => {
  it('知识库在系统应用表里,带 i18n 键与图标', () => {
    const k = SYSTEM_APPS.find((a) => a.key === 'knowledge')
    expect(k).toBeDefined()
    expect(k!.label).toBe('appKnowledge')
    expect(k!.icon).toBeTruthy()
  })

  it('key 不重复(Dock 与 AddPanel 都按 key 去重)', () => {
    expect(new Set(SYSTEM_APP_KEYS).size).toBe(SYSTEM_APP_KEYS.length)
  })
})
```

在 `src/home/composables/useOpenAction.test.ts` 里补（照该文件既有的 `router.push` mock 写法）：

```ts
it('知识库磁贴走应用内路由 /ai/knowledge', () => {
  const { openApp } = useOpenAction()
  openApp('knowledge')
  expect(push).toHaveBeenCalledWith('/ai/knowledge')
})
```

- [ ] **Step 3: 跑测试确认它红**

Run: `pnpm exec vitest run src/home/apps/systemApps.test.ts src/home/composables/useOpenAction.test.ts`
Expected: FAIL —— 表里没有 knowledge；`openApp('knowledge')` 落到 `window.location.href = '/#/legacy'`。

- [ ] **Step 4: 改三个文件**

`systemApps.ts`：加 import 与一项（`glyph` 用一个书本/文库形状的 path，与既有 `G` 常量同风格）：

```ts
import iconKnowledge from './icons/knowledge.svg'
// G 里加:
  book: '<path d="M4.5 5.5A2 2 0 0 1 6.5 3.5H19v15H6.5a2 2 0 0 0-2 2Z"/><path d="M9 7.5h6M9 11h6"/>',
// SYSTEM_APPS 里 ai 之后加:
  { key: 'knowledge', name: 'Knowledge', label: 'appKnowledge', cls: 'ic-knowledge', glyph: G.book, icon: iconKnowledge },
```

> `cls: 'ic-knowledge'` 要在 `src/styles/theme.css` 的 `.ic-*` 渐变段里有对应定义（那是**有意为之的品牌色例外**，两套主题都保留）。照既有 `.ic-ai` 的写法加一条，并在旁边留注释标明属于既有例外。

`useOpenAction.ts` 的 `openApp` 里，`ai` 那条之后加：

```ts
      // 知识库:SP8 建的应用内路由,Vue2 侧没有对应入口 ⇒ 不设回退 flag(无处可退)。
      if (key === 'knowledge') { router.push('/ai/knowledge'); return }
```

`defaultLayout.ts` 的 `DEFAULT` 里加一格（放在 `{ kind: 'app', key: 'vm', c: 12, r: 6 … }` 之后的空位，例如 `c: 11, r: 6` 已被 appstore 占用 → 用 `{ kind: 'app', key: 'knowledge', c: 3, r: 1, w: 1, h: 1 }` 会撞 storage 小组件；**落笔前先按 `c/r/w/h` 把现有 21 项画一遍网格，挑一个真正空的格子**，并在测试里断言它不与任何既有项重叠）。

- [ ] **Step 5: 加 i18n 键**

`appKnowledge` → zh：`知识库`；en：`Knowledge`。放进 `appFiles` / `appAi` 所在的同一个文件。

- [ ] **Step 6: 跑测试**

Run: `pnpm exec vitest run src/home/ src/i18n/parity.test.ts`
Expected: PASS（含既有 `defaultLayout.test.ts` 不回归 —— 若它断言了项数，一并更新）。

- [ ] **Step 7: Commit**

```bash
git add src/home/apps/icons/knowledge.svg src/home/apps/systemApps.ts src/home/apps/systemApps.test.ts \
        src/home/composables/useOpenAction.ts src/home/composables/useOpenAction.test.ts \
        src/home/grid/defaultLayout.ts src/styles/theme.css src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "$(cat <<'EOF'
feat(home): give Knowledge a desktop tile

/ai/knowledge has eleven routes and a nine-item rail, and until now nothing
in the app linked to any of them -- only the knowledge pages navigate
between themselves, so the whole area was reachable only by typing the URL.
Vue 2 reached it from a home tile; the port took the routes and left the
tile behind.

The tile pushes an in-app route rather than opening a tab as Vue 2 did: the
AI area moved into this application at SP8-P6, so a new tab would drop the
in-app state. No strangler fallback flag, because Vue 2 has no Knowledge
entry to fall back to.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

