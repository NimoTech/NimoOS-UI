### Task 7: `SmartViewConditionEditor.vue` —— 条件 chips + 加条件弹层

**Files:**
- Create: `src/photos/components/SmartViewConditionEditor.vue`
- Create: `src/photos/components/__tests__/SmartViewConditionEditor.test.ts`
- Modify: `src/views/PhotosSmartViewDetail.vue`(把 T6 的挂载点兑现)
- Modify: `src/views/__tests__/PhotosSmartViewDetail.test.ts`(升级 stub 断言为真组件)
- Read-only 参考: `PhotosSmartViewDetail.vue:26-59`(模板)、`:334-343`(建议)、`:445-477`(四个方法)、`:386-391`(点外部)、`photos-smartview.scss:252-376`

**Interfaces:**
- Consumes: T1 的 `condSuggestionsFor`、T1 的键
- Produces:
  ```ts
  // props
  { conds: string[]; busy?: boolean }
  // emits
  (e: 'add', cond: string): void       // 宿主负责调 updateSmartView({ conds: [...conds, cond] })
  (e: 'remove', cond: string): void    // 宿主负责调 updateSmartView({ conds: filtered })
  ```
  **组件自己不碰 store** —— 条件的真实来源是 `sv.conds`(store),组件只做 UI 与 draft 输入。这样 §7e-2 的修复自动生效:加删条件后 store 更新 → `conds` prop 变 → chips 立即重绘。

**结构规格(逐段照 Vue2 `:27-58`):**

1. `v-for` 出 `.sv-cond.sv-cond-removable`(文本 + `.sv-cond-x` 内含 x 图标 9px),**整个 chip `@click` 即删除**(照搬 Vue2 `:27` —— 点 chip 任意处都删,不只点叉),`:title="t('photosSvRemoveC', { c })"`。
2. 一个相对定位的 `<div>` 包住:
   - `.sv-cond.sv-cond-add` 按钮(`ref="addBtn"`,plus 图标 10px + `photosSvAddCondition`,`:data-open="open"`,点击 toggle)。
   - `<transition name="sv-menu">` 内 `.sv-cond-pop`(`ref="pop"`,`v-if="open"`):
     - `.sv-cond-pop-head`(`photosSvNewCondition`)
     - `<input class="sv-cond-pop-input">`(`ref="input"`,`v-model="draft"`,占位 `photosSvEGSceneSunset`,`@keydown.enter.prevent="submit"`、`@keydown.esc.prevent="close"`)
     - `v-if="suggestions.length"` → `.sv-cond-pop-sugg-head`(sparkles 10px + `photosSvSuggestions`)+ `.sv-cond-pop-sugg`(按钮组,文本 `+ {s}`,点击 `addSuggestion`)
     - `.sv-cond-pop-foot`:`.sv-btn-ghost`(`photosSvDone`,关闭)+ `.sv-btn-primary`(`photosSvAdd`,`:disabled="!draft.trim() || busy"`)
3. **`suggestions = condSuggestionsFor(props.conds)`**(computed,T1 的纯函数)。
4. **方法照搬**:
   - `openPop`:`open = true`、`draft = ''`、`$nextTick` 聚焦 input(照搬 `:450-454`)。
   - `close`:`open = false`、`draft = ''`(照搬 `:455-458`)。
   - `submit`:trim 空 → 只关闭(照搬 `:461`);`props.conds.includes(v)` 则跳过 emit(照搬 `:462`);否则 `emit('add', v)`;**然后清空 draft 并重新聚焦,弹层不关**(照搬 `:467-468` —— 可以连续加多条)。
   - `addSuggestion`:不在 `conds` 里才 emit;**同样保持弹层开着并重新聚焦**(照搬 `:470-477`)。
5. **点外部关闭**:`mousedown` 监听,判据是 `pop` 与 `addBtn` **都不包含** target(照搬 `:386-391`);Esc 走 `document` 级(硬约束,禁早退)。`watch(open)` 挂/摘。
6. **`busy` 期间禁用**:Vue2 没有 busy 概念(它的 `updateSmartView` 无重入守卫)。New-UI 的 primary 按钮与 chip 删除在 `busy` 时禁用,**偏离登记**(防止连点产生并发 patch —— T2 的 `patchBusy` 会短路,但界面不给反馈就成了「点了没反应」)。
7. **token 与 hover**:`.sv-cond` 基类有 hover、`.sv-cond-removable` 与 `.sv-cond-add[data-open]` 是变体 ⇒ 变体自带 `:hover`,cssCascade 断言;`.sv-cond-pop` 底用 `--popup-bg` + `--card-shadow-hi`。

- [ ] **Step 1: 写失败测试**

必含用例:
- `conds` 3 条 → 3 个 `.sv-cond-removable` + 1 个 `.sv-cond-add`;`conds` 为 `[]` → 0 + 1。
- 点任意 chip(**不是点叉**)→ `remove` 事件带该 chip 文本;点叉 → 同样。
- 点「添加条件」→ 弹层出现,input 自动聚焦(断言 `document.activeElement` 是那个 input);再点 → 关闭。
- 输入 `'scene: x'` + Enter → `add` 事件带 `'scene: x'`;**弹层仍开着、input 已清空**(两条断言);连续再输一条 → 第二个 `add` 事件。
- 输入空白 + Enter → **无 `add` 事件**且弹层关闭。
- 输入一条**已存在**的条件 + Enter → **无 `add` 事件**(去重);input 清空、弹层仍开。
- 建议区:`conds` 含 `'scene: sunset'` → 建议里**不含**它;建议最多 8 条;点一条建议 → `add` 事件 + 弹层仍开;`conds` 覆盖了 12 条中的 12 条 → 建议区**整块不渲染**。
- `busy: true` → primary 按钮 `disabled`、chip 的删除点击**不发** `remove`。
- 点外部(`document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))` 打在 body 上)→ 关闭;点弹层内部 → **不关**;点「添加条件」按钮本身 → 走 toggle 不走点外部(**这条钉住 `addBtn.contains` 那半判据**)。
- Esc → 关闭;**并且**:构造一个「宿主同时开着另一个浮层」的场景不在本组件范围,故本组件只断言自己的 Esc handler **没有** early-return(读源文本断言 handler 体内 `return` 只出现在非 Esc 分支)。
- `cssCascade.ts`:`.sv-cond-removable` 与 `.sv-cond-add[data-open="true"]` 的 hover 胜出规则含 `:hover` 且归属变体。

- [ ] **Step 2: 跑测试确认失败** — `pnpm exec vitest run src/photos/components/__tests__/SmartViewConditionEditor.test.ts`

- [ ] **Step 3: 实现 + 在详情页挂载 + 升级 T6 断言**

- [ ] **Step 4: 跑全量 + tsc + color-guard,逐个删码验证**

Run: `pnpm exec vitest run && pnpm exec vue-tsc --noEmit`

删码清单:①`submit` 里的 `includes` 去重 → 重复条件用例红;②`submit` 成功后不关弹层的那行(把 `close()` 加回去)→ 「弹层仍开」用例红;③`addBtn.contains` 那半判据 → 「点按钮走 toggle」用例红;④`condSuggestionsFor` 换成 `COND_SUGGESTIONS` 原样 → 「建议不含已有」用例红;⑤`busy` 的 disabled → busy 用例红;⑥`.sv-cond-removable:hover` → cssCascade 用例红。

- [ ] **Step 5: Commit**

```bash
git add src/photos/components/SmartViewConditionEditor.vue src/photos/components/__tests__/SmartViewConditionEditor.test.ts src/views/PhotosSmartViewDetail.vue src/views/__tests__/PhotosSmartViewDetail.test.ts
git commit -m "feat(photos): P7a-T7 智能视图条件编辑器 —— chips 可删 + 加条件弹层 + 建议"
```

---

