### Task 10: `AgentRightPanel` + `ActivityTab` + `ContextTab`

**Files:** Create `src/ai/components/shell/AgentRightPanel.vue` + `.test.ts`、`src/ai/components/tabs/ActivityTab.vue` + `.test.ts`、`src/ai/components/tabs/ContextTab.vue`;Modify `src/i18n/{zh_cn,en_us}.ts`

**AgentRightPanel** 逐字港 Vue2(80 行):`<aside v-if="!collapsed" class="rightpanel">`(**双重折叠机制:`v-if` + 外层 grid 列宽归零,两者都要**);4 个 `.right-tab` 按钮 + `:data-active`;Resources 按钮上 `pendingCount > 0` 时显示 `.badge-pending`(`pendingCount = stagedChanges.reduce((n,g)=>n+g.items.length,0)`,**对 `g.items` 缺失要容错**);`.right-content.scroll` 内 `v-if/v-else-if/v-else` 四选一(**Resources 是 `v-else` 兜底**,照抄);12 个 props + 7 个 emits(本期要**补 `emits` 声明**,Vue2 没写)。裸色:`.badge-pending` 的 `color: white`(Vue2:76)→ `var(--text-on-accent)`。
**ActivityTab** 逐字港(55 行):步骤列表(`.activity-bullet` 的 `data-state` 驱动颜色/脉冲动画)、`success` 显示 `formatDuration`、`running` 显示"运行中…"、其余"等待";`busy` 且无步骤时显示 `.dots` 载入态;都没有时空态(`AgentIcon name="layers"`)。`formatDuration` 抽成纯函数 + 单测(`<1000` → `Xms`;`<10s` → `X.Xs`;否则 `Xs`;falsy 且非 0 → "完成")。
**ContextTab** 逐字港(16 行):纯占位面板,原样保留("暂未支持" + 说明句)——**不要顺手实现它**。
i18n:`aiTabActivity/Context/System/Resources`、`aiActivityHeader`("Agent Run")、`aiActivityRunning`/`aiActivityWaiting`/`aiActivityEmpty`/`aiActivityDone`、`aiContextNotYet`/`aiContextDesc`。

- [ ] **Step 1: 写失败测试**:面板 5 例(collapsed 时不渲染 / 4 个 tab 点击 emit `set-tab` / 未知 tab 值落 Resources / pendingCount 角标出现与数值 / `items` 缺失不炸);ActivityTab 4 例(三种步骤态各自文案 / busy 空列表出 dots / 全空出空态 / formatDuration 四档);ContextTab 1 例(渲染占位文案)。
- [ ] **Step 2: 跑测试确认失败。**
- [ ] **Step 3: 实现。**
- [ ] **Step 4: 跑测试 + tsc + 零裸色 grep + parity 绿。**
- [ ] **Step 5: Commit** `SP8-P1c2: right panel shell + Activity/Context tabs`

---

