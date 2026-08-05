### Task 6: 共享 toast 三档(info / warning / danger)

**Files:** Modify `src/stores/toast.ts`、`src/components/AppToast.vue`、`src/components/AppToast.test.ts`、`src/styles/theme.css`(如需新 token);Modify `src/ai/components/shell/AgentComposer.vue`(把 1c-1 的 7 处 toast 按语义标档)

**Interfaces:** Produces
```ts
export type ToastTier = 'info' | 'warning' | 'danger'
export interface ToastItem { id: number; text: string; tier: ToastTier }
show(text: string, duration?: number, tier?: ToastTier): void   // 两参调用保持原语义,tier 默认 'info'
```
**向后兼容是硬要求**:全仓现有 `show(text)` / `show(text, ms)` 调用点(文件区/应用区/首页等)一处都不许改,行为不许变。

样式:`AppToast.vue` 的 `.toast` 加 `[data-tier="warning"]` / `[data-tier="danger"]` 变体 —— 颜色走**全局** token(`src/styles/theme.css`;该组件不在 `.agent-app` 作用域内,不能用 Agent token)。缺语义就在 theme.css 的 light/dark 两块各加值(例如 `--toast-warn-bg`/`--toast-warn-fg`/`--toast-danger-bg`/`--toast-danger-fg`),**禁裸色**。视觉参考 Vue2 Buefy 的 `is-warning`(黄)/`is-danger`(红),但配色要落到本仓的设计语言里(与既有 `--danger`/`--warning` 语义一致)。

`AgentComposer` 的 7 处:上传失败/超限/建会话失败/授权失败 → `danger`;文档抽取警告(两处 7000ms)→ `warning`;"该功能暂未支持"/Browse 占位 → `info`(即不传)。

- [ ] **Step 1: 写失败测试**:`show(t)` 默认 tier=info 且现有两参调用行为不变 / 三档各自渲染出对应 `data-tier` / 多条不同档可共存堆叠 / composer 的失败路径推的是 danger、文档警告是 warning。
- [ ] **Step 2: 跑测试确认失败。**
- [ ] **Step 3: 实现。**
- [ ] **Step 4: 跑 `pnpm test`(**全量**,证明其他区域的 toast 调用零回归)+ tsc;并 `grep -nE '#[0-9a-fA-F]{3,8}|rgba?\(' src/components/AppToast.vue` 无输出。**
- [ ] **Step 5: Commit** `SP8-P1c2: shared toast tiers (info/warning/danger) + composer severity`

---

