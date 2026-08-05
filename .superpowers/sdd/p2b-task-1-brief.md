## Task 1: `AgentIcon` 补 `user` + `sk-modal*` / `sk-field*` 样式移植

**Files:**
- Modify: `src/ai/components/icons/AgentIcon.vue`（`PATHS` 追加一项）
- Modify: `src/ai/components/icons/AgentIcon.test.ts`（追加用例）
- Modify: `src/ai/styles/sk-shared.scss`（追加 `.sk-modal*` / `.sk-field*` 规则）
- Modify: `src/ai/styles/settingsStyles.test.ts`（`sk-shared.scss` 那个 describe 块里追加断言）
- Modify: `src/ai/styles/tokens.scss`（例外登记注释续写一句）

**Interfaces:**
- Produces: 图标名 `'user'`（`<AgentIcon name="user" :size="16" />`，Task 12 用）；CSS 类 `.sk-modal-bg` / `.sk-modal` / `.sk-modal-head` / `.sk-modal-title` / `.sk-modal-body` / `.sk-modal-foot`（内含 `.right`）/ `.sk-field` / `.sk-field-label` / `.sk-field-hint`（Task 3/10/12 用）

**背景：** New-UI 的 `AgentIcon.vue` 现有 44 个图标，`user` 不在其中（已 grep 确认）。Vue2 `ChannelsSection` 的绑定行用 `<SkillIcon name="user" :size="16"/>`。Vue2 该图标画在 **24 单位盒子**里（`cx="12" cy="8"`、`M4 21`），而 `AgentIcon` 的 viewBox 是 20 单位 —— 所以要按本档既有的 `settings` / `book` 先例包一层 `scale(0.8333)`（= 20/24）。

- [ ] **Step 1: 写失败的图标测试**

在 `src/ai/components/icons/AgentIcon.test.ts` 末尾追加（**不要改动既有用例**）：

```ts
describe('SP8-P2b Task 1 —— user 图标', () => {
  it('user 渲染出 circle + path,且按 24→20 单位缩放', () => {
    const w = mount(AgentIcon, { props: { name: 'user' } })
    const html = w.html()
    expect(html).toContain('transform="scale(0.8333)"')
    expect(html).toContain('cx="12"')
    expect(html).toContain('r="4"')
    expect(html).toContain('M4 21a8 8 0 0116 0')
  })

  it('对照组:20 单位的 folder 不带 scale 包裹', () => {
    expect(mount(AgentIcon, { props: { name: 'folder' } }).html()).not.toContain('scale(')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test src/ai/components/icons/AgentIcon.test.ts`
Expected: FAIL —— `user` 未定义，渲染出空 svg，`expect(html).toContain('transform="scale(0.8333)"')` 报错。

- [ ] **Step 3: 追加图标**

在 `src/ai/components/icons/AgentIcon.vue` 的 `PATHS` 里追加（位置紧跟 `settings` 一项之后，与 Vue2 `SkillIcon.vue:24` 逐字符一致，只多 scale 包裹）：

```ts
  // SP8-P2b Task 1 —— 1:1 取自 Vue2 src/views/AI/Skills/SkillIcon.vue:24。
  // 该图标画在 24 单位盒子里(cx=12/cy=8/M4 21),本档 viewBox 是 20 单位,
  // 故按同档 settings/book 先例包 scale(0.8333)=20/24。弧线参数 `0116 0` 是
  // SVG 允许的紧凑写法(flag 0、flag 1、x=16),照抄勿"格式化"。
  user: '<g transform="scale(0.8333)"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0116 0" /></g>',
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test src/ai/components/icons/AgentIcon.test.ts`
Expected: PASS（含既有全部用例）

- [ ] **Step 5: 写失败的样式守卫断言**

在 `src/ai/styles/settingsStyles.test.ts` 的 `describe('sk-shared.scss', …)` 块里追加：

```ts
  it('SP8-P2b Task 1 —— 导出弹窗外壳与表单字段两组类', () => {
    for (const sel of [
      '.sk-modal-bg', '.sk-modal', '.sk-modal-head', '.sk-modal-title',
      '.sk-modal-body', '.sk-modal-foot', '.sk-field', '.sk-field-label', '.sk-field-hint',
    ]) {
      expect(css).toContain(sel)
    }
  })

  it('SP8-P2b Task 1 —— 保留两个入场动画关键帧', () => {
    expect(css).toContain('@keyframes sk-fade-in')
    expect(css).toContain('@keyframes sk-pop')
  })
```

- [ ] **Step 6: 跑测试确认失败**

Run: `pnpm test src/ai/styles/settingsStyles.test.ts`
Expected: FAIL —— 两条新用例都报找不到选择器。

- [ ] **Step 7: 追加样式（整块逐字移植）**

在 `src/ai/styles/sk-shared.scss` 末尾追加。**取自 Vue2 `src/views/AI/Skills/skills-styles.scss:575-646` 与 `:686-694`，逐字符照抄，一处不改**：

```scss
// ===== SP8-P2b Task 1 —— 弹窗外壳 =====
// 1:1 移植自 Vue2 src/views/AI/Skills/skills-styles.scss:575-613。
// Vue2 的三处弹窗(令牌明文 / 加机器人 / 配对码)是手写裸 div 吃这套类;本仓改用
// reka Dialog(见 SkModal.vue),但视觉规则原样保留,故这些类照搬。
// .sk-modal-bg 的遮罩底色是深蓝灰半透明字面量,属本档「整档移植件」豁免范围
// (登记在 tokens.scss 头部例外清单),不接 token。
.sk-modal-bg {
  position: fixed; inset: 0;
  background: rgba(15, 20, 30, 0.32);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: grid; place-items: center;
  z-index: 1100;
  padding: 40px;
  animation: sk-fade-in 180ms ease;
}
@keyframes sk-fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
.sk-modal {
  width: min(560px, 100%);
  max-height: min(90vh, 720px);
  background: var(--bg-elevated);
  border: 1px solid var(--line);
  border-radius: var(--r-xl);
  box-shadow: var(--shadow-lg);
  display: flex; flex-direction: column;
  overflow: hidden;
  animation: sk-pop 200ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
@keyframes sk-pop {
  from { opacity: 0; transform: translateY(8px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0)   scale(1); }
}
.sk-modal-head {
  padding: 16px 20px;
  display: flex; align-items: center; gap: 10px;
  border-bottom: 1px solid var(--line-faint);
}
.sk-modal-title { font-size: 15px; font-weight: 600; letter-spacing: -0.01em; flex: 1; }

.sk-modal-body {
  padding: 18px 20px;
  display: flex; flex-direction: column; gap: 14px;
  overflow-y: auto;
}

// 1:1 移植自 Vue2 skills-styles.scss:686-694。
.sk-modal-foot {
  padding: 12px 20px;
  display: flex; align-items: center; gap: 8px;
  border-top: 1px solid var(--line-faint);
  background: var(--bg-canvas);
  .save-note {
    font-size: 11px;
    color: var(--text-tertiary);
    display: inline-flex; align-items: center; gap: 4px;
  }
  .right { margin-left: auto; display: flex; gap: 8px; }
}

// ===== SP8-P2b Task 1 —— 弹窗内的表单字段 =====
// 1:1 移植自 Vue2 skills-styles.scss:617-646。Task 12 的「添加机器人」表单用。
.sk-field { display: flex; flex-direction: column; gap: 6px; }
.sk-field-label {
  font-size: 12px; font-weight: 600;
  color: var(--text-secondary);
  letter-spacing: -0.005em;
  .sk-field-optional {
    color: var(--text-tertiary);
    font-weight: 400;
  }
}
.sk-field-hint { font-size: 11px; color: var(--text-tertiary); }
.sk-field input[type="text"],
.sk-field textarea {
  width: 100%;
  border: 1px solid var(--line);
  border-radius: var(--r-md);
  padding: 9px 12px;
  font-size: 13.5px;
  background: var(--bg-canvas);
  color: var(--text-primary);
  outline: none;
  transition: all 120ms ease;
  font-family: var(--font-sans);
  &:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-softer);
    background: var(--bg-elevated);
  }
}
.sk-field textarea { min-height: 88px; resize: vertical; line-height: 1.5; }
```

**不要移植** `.sk-trig-options` / `.sk-trig-option` / `.sk-color-row` / `.sk-color-dot`（夹在 Vue2 原文这两段之间，但那是技能编辑器的，属 P3 范围）。

- [ ] **Step 8: 续写例外登记**

在 `src/ai/styles/tokens.scss` 头部「另登记一项(SP8-P2a Task 2)」那条后面追加一句：

```scss
// SP8-P2b Task 1 追加:`sk-shared.scss` 末尾的 `.sk-modal-bg` 遮罩底色
// `rgba(15, 20, 30, 0.32)` 同属该整档移植件豁免(Vue2 skills-styles.scss:577)。
```

- [ ] **Step 9: 跑全量测试门**

```bash
pnpm test
pnpm exec vue-tsc --noEmit
pnpm build
```
Expected: 全绿，测试数比基线多 4 例。

- [ ] **Step 10: 提交**

```bash
git add src/ai/components/icons/AgentIcon.vue src/ai/components/icons/AgentIcon.test.ts \
        src/ai/styles/sk-shared.scss src/ai/styles/settingsStyles.test.ts src/ai/styles/tokens.scss
git commit -m "SP8-P2b Task 1: AgentIcon 补 user + sk-modal/sk-field 样式移植"
git show --stat HEAD && git status
```

---

