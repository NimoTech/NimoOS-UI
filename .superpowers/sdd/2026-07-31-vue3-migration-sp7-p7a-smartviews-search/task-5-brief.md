### Task 5: `SmartViewCreateDialog.vue` —— 创建弹窗(左表单 + 右预览 + 5 模板)

**Files:**
- Create: `src/photos/components/SmartViewCreateDialog.vue`
- Create: `src/photos/components/__tests__/SmartViewCreateDialog.test.ts`
- Modify: `src/views/PhotosSmartViews.vue`(挂载弹窗,把 T4 的 TODO 兑现)
- Modify: `src/views/__tests__/PhotosSmartViews.test.ts`(把 T4 的 `createOpen` 断言升级为「弹窗真渲染」)
- Modify(按需): `src/styles/theme.css` + `docs/THEMING.md`
- Read-only 参考: `PhotosSmartViewsView.vue:40-183`(模板)、`:359-436`(逻辑)、`photos-smartview.scss:659-1013`

**Interfaces:**
- Consumes: T1 的 `SV_QUICK_TEMPLATES` / `inferChips`、T2 的 store(`refreshPreview` / `preview` / `createSmartView` / `createBusy`)、T1 的键
- Produces:
  ```ts
  // props(v-model:open)
  { open: boolean }
  // emits
  (e: 'update:open', v: boolean): void
  (e: 'created', id: string): void   // 建成后由宿主决定跳详情页
  ```

**结构规格(逐段照 Vue2 `:42-182`;这是本期最大的单个组件,列清点表再动手):**

1. `.sv-modal-scrim`(`v-if="open"`,`@click.self` 关闭)→ `.sv-modal`(`role="dialog"`,`:aria-label="t('photosSvNewSmartView')"`)。**过渡照 Vue2 `scss:1008-1013`。**
2. `.sv-modal-head`:28×28 渐变图标块(sparkles 15px,**白色图标压在渐变实底上 → 这里可以用 `--on-accent` 吗?不能** —— 那块底是 Vue2 写死的紫渐变;New-UI 改成 `background: var(--accent)` 实底后**才**可用 `--on-accent`。**照后者做并注释登记**)+ 标题 `photosSvNewSmartView` + 副标题 `photosSvSavedSearchKeepsItself` + 右侧关闭按钮(`photosClose` 复用键)。
3. `.sv-modal-body`(左右两栏,`scss:700-707` 是 grid):
   **左 `.sv-modal-form`(6 段)**
   - **名称**:`.sv-field` → label `photosSvName` + `<input class="sv-input">`(`v-model="draft.name"`,`@keydown.enter.prevent="confirm"`,占位 `photosSvEGSaraTokyo`)。**弹窗打开后自动聚焦**(Vue2 `:388` 的 `$nextTick` + `focus()`)。
   - **描述**:label `photosSvNimoMatch` + hint `photosSvDescribePlainEnglishConditions` + `<textarea>`(`v-model="draft.desc"`,占位 `photosSvSunsetsSaraOurTokyo`,`@input` → `refreshPreview()`)。
   - **Nimo 建议**(`v-if="suggestedChips.length"`):head(sparkles 11px + `photosSvNimoSuggests`)+ 一行 `.sv-suggest-chip` 按钮(文本 `+ {chip}`,点击 `addChip`)。`suggestedChips = inferChips(draft.desc).filter(c => !draft.chips.includes(c))`(照搬 `:308-310`)。
   - **条件 bin**:label `photosSvConditions` + `.sv-chip-bin`(`:data-empty="draft.chips.length === 0"`)内含 `v-for` 的 `.sv-chip-item`(文本 + `.sv-chip-x` 删除按钮,`aria-label` 用 `photosSvRemoveCondition`)+ 一个 `.sv-chip-input`(`v-model="draft.customChip"`,`@keydown.enter.prevent="addCustom"`,`@keydown` → 逗号也提交,占位随 `chips.length` 二选一:`photosSvAddAnother` / `photosSvTypeConditionEG`)。`chips.length === 0` 时下方一行 hint `photosSvPressEnterAddPick`(**带 `{enter}` 插值,Vue2 `:104` 传的是字面 `'Enter'`,照搬**)。
   - **阈值**:label `photosSvQualityThreshold` + `.sv-thresh-val` 显示 `≥ {thresh}%` + `<input type="range" min="50" max="99">`(`@input` → 置值 + `refreshPreview()`;**注意 Vue2 用 `:value` + `@input` 而非 `v-model`,照搬**)+ `.sv-slider-marks` 三档(`photosSvLoose` / `photosSvBalanced` / `photosSvStrict`)+ `v-if="threshMuted"` 的 hint `photosSvCurrentConditionsMatchExactly`。
     - **`threshMuted` 判据照搬 `:313-318` 连注释**:`!preview.thresholdActive && (chips.length > 0 || desc.trim().length > 0)` —— 空表单不算失效、滑块保持可拖。
   - **两个开关**:`.sv-toggle-row` × 2(`photosSvKeepLive` + 说明 `photosSvAutoAddMatchesPhotos`;`photosSvIncludeVideos` + 说明 `photosSvMatchAgainstVideoKeyframes`),各带 `.sv-switch[:data-on]`。
     - **`.sv-switch` 是 Vue2 的自绘开关**(`scss:584-605`),New-UI **必须补 accessible name**:`role="switch"` + `:aria-checked` + `aria-label`(P5 的 `b-switch` 替换教训 —— 手写版一度丢了 accessible name)。**偏离登记。**
     - **`includeVideos` 变更要 `refreshPreview()`**(Vue2 `:134`),`live` 变更**不**触发(Vue2 `:127` 确实没调,照搬)。
   **右 `.sv-modal-side`(4 段)**
   - `.sv-preview-head`(sparkles 11px + `photosSvLivePreview`)。
   - `.sv-preview-count`:`<b>~{count 千分位}</b>` + `photosSvCandidatesThreshold`。
   - `.sv-preview-grid`:`v-for` 出 `preview.seeds` 的 `<img>`(`thumbnailUrl(seed, 'large')`,`loading="lazy"`)。**seeds 为空时该网格为空 —— 照搬(不加占位,D15 只约束卡片)。**
   - `.sv-preview-help` 三档三元(`thresh > 88` → `photosSvStrictOnlyHighestConfidence`;`< 65` → `photosSvLooseExpectSomeFalse`;否则 `photosSvBalancedHealthyMixCertainty`)。**边界照搬:88 与 65 都走 else。**
   - `.sv-templates`:head `photosSvStartTemplate` + 5 个 `.sv-template-row`(sparkles 11px + `.t-label`(`t(row.labelKey)`)+ `.t-desc`(`t(row.descKey)`)),点击 `useTemplate(row)`。
4. `.sv-modal-foot`:`.sv-btn-ghost`(`photosSvCancel`,关闭)+ `.sv-btn-primary`(sparkles 12px + `photosSvCreateSmartView`,`:disabled="!canSubmit || store.createBusy"`)。
   - **`canSubmit` 照搬 `:319-322`**:`name.trim().length > 0 && (chips.length > 0 || desc.trim().length > 0)`。
   - **`.sv-btn-ghost:hover` 与 `.sv-btn-primary` 会撞**(Vue2 `scss:970-1007` 两者都有 hover) → 两个变体各自带 `:hover` 背景,`cssCascade.ts` 断言胜出选择器含 `:hover`。primary hover 用 `background: var(--accent); filter: brightness(1.08);`。
5. **方法逐条照搬**(`:359-436`):`emptyDraft()`(`{ name:'', desc:'', customChip:'', chips:[], thresh:80, live:true, includeVideos:false }`,**默认阈值 80、live 默认真** —— 逐字核)/ `addChip`(trim + 去重 + push + refreshPreview)/ `removeChip`(filter + refreshPreview)/ `addCustom`(addChip + 清空 customChip + refreshPreview)/ `onChipKey`(仅 `,` 触发 addCustom)/ `useTemplate`(name = `t(labelKey)`、desc = `t(descKey)`、thresh、**chips = `inferChips(row.descEn).slice(0, 4)`** —— 用 `descEn` 不用 `descKey`,T1 契约)。
   - **`open` 变 true 时重置 draft + 聚焦 + `refreshPreview()`**(照搬 `openCreate` 的三件事)。**用 `watch(() => props.open)`,不是 `onMounted`** —— 弹窗常驻挂载、靠 `v-if` 显隐时 `onMounted` 只跑一次(P2 的「持久挂载坑」两次前例:isMoving 自隐与视频 startMs)。
6. **`confirm()`**:`canSubmit` 短路 → `store.createSmartView({ name: draft.name.trim(), description: draft.desc.trim(), conds: [...draft.chips], threshold: draft.thresh, live: draft.live, includeVideos: draft.includeVideos })` → 成功 `emit('created', created.id)` + 关闭;**失败 catch → toast(`useToast`)且弹窗不关**(偏离登记:Vue2 `:433-435` 没有 catch,失败是未处理的 rejection、弹窗照关、界面无提示)。
   - **`description` 空串时 Vue2 传 `undefined`**(`:431` 的 `|| undefined`)。**照搬**(后端 `omitempty` 语义),即 `description: draft.desc.trim() || undefined`。
7. **token 映射**:`--surface-1/2/3` → `--popup-bg`(弹窗底)/ `--chip-bg` / `--chip-bg-hi`;`--line`/`--line-strong` → `--card-border`;scrim 用本仓既有 overlay token(**grep `Dialog.vue` 看现成写法**);投影 `--card-shadow-hi`。
8. **窄屏**:Vue2 `scss` 里这个弹窗是固定宽的左右两栏 —— **≤768px 改单列**(左表单在上、右预览在下),`.sv-modal` 宽度改 `min(100% - 24px, …)`。**偏离登记(Vue2 零 `@media`)。**

- [ ] **Step 1: 写失败测试**

必含用例:
- 结构清点:6 段左栏(name input / textarea / 建议区 / chip-bin / range / 2 个 switch)+ 4 段右栏(head / count / grid / help)+ 5 个 `.sv-template-row` + foot 两钮 各存在且数量正确。
- **`open: false` → 整个 scrim 不渲染**;置真 → 渲染。
- **draft 重置走 watch 不走 onMounted**:挂载时 `open: false`,填一次 `draft.name`(通过打开 → 输入 → 关闭),再置 `open: true` → name 为空。**这条钉住持久挂载坑。**
- 建议 chips:`draft.desc` 设成 `'sunset in tokyo'` → 出现 `scene: sunset` 与 `place: Japan` 两个建议;点其中一个 → 它进 chip-bin **且从建议区消失**;`store.refreshPreview` 被调。
- chip 增删:输入 `'scene: x'` + Enter → chip-bin 多一项、input 清空;输入含逗号 → 同样提交;重复输入同一条 → chip 不重复;点 `.sv-chip-x` → 移除。**每一步都断言 `refreshPreview` 被调。**
- 占位文案二态:`chips` 为空 → `photosSvTypeConditionEG`;非空 → `photosSvAddAnother`。hint `photosSvPressEnterAddPick` 只在空时出现。
- 阈值:拖 range 到 92 → `.sv-thresh-val` 显示 `≥ 92%` 且 `refreshPreview` 被调;`.sv-preview-help` 在 92 / 60 / 75 三值下分别是三条不同文案;**边界 88 与 65 都走 balanced 那条**。
- `threshMuted`:`preview.thresholdActive = false` + chips 与 desc 都空 → hint **不出现**(空表单不算失效);加一条 chip → 出现。
- 两个开关:`role="switch"` 存在、`aria-checked` 随状态变、有 `aria-label`;点 `includeVideos` → `refreshPreview` 被调;点 `live` → **未被调**。
- 模板:点第 1 个模板行 → name/desc 变成对应 i18n 值、thresh 变 75、chips 非空且长度 ≤ 4;**断言 chips 是由 `descEn` 推出的**(即包含 `scene: family gathering`),这条钉住 T1 的 `descEn` 契约。
- `canSubmit`:name 空 → primary `disabled`;name 有值但 chips 与 desc 都空 → 仍 `disabled`;name + desc → 可点;`store.createBusy = true` → `disabled`。
- `confirm` 成功:`createSmartView` 收到的对象逐字段断言(含 `description: undefined` 当 desc 为空时);`created` 事件带 id;`update:open` 发 false。
- `confirm` 失败:`createSmartView` reject → `useToast().show` 被调、`update:open` **未**发出(弹窗不关)。
- `cssCascade.ts`:hover 态下 `.sv-btn-primary` 的 background 归属含 `:hover` 且含 `-primary` 的规则;`.sv-btn-ghost` 同理。
- 前景色合规:`.sv-modal-icon` 用的是 `--accent` 实底 + `--on-accent` 前景(**这一条是本期唯一合法的 `--on-accent` 用法,要正向断言**);其余压照片的元素本组件没有。
- 窄屏规则:样式块含 `max-width: 768px`,其中 `.sv-modal-body` 的 `grid-template-columns` 为单列(先锚定规则体)。

- [ ] **Step 2: 跑测试确认失败** — `pnpm exec vitest run src/photos/components/__tests__/SmartViewCreateDialog.test.ts`

- [ ] **Step 3: 实现 + 在 `PhotosSmartViews.vue` 挂载 + 升级 T4 的断言**

- [ ] **Step 4: 跑全量 + tsc + color-guard,逐个删码验证**

Run: `pnpm exec vitest run && pnpm exec vue-tsc --noEmit`

删码清单:①`watch(() => props.open)` 换成 `onMounted` → 「draft 重置」用例红;②`useTemplate` 里的 `descEn` 换成 `descKey` → 模板 chips 用例红;③`suggestedChips` 的 `.filter(c => !chips.includes(c))` → 「建议消失」用例红;④`threshMuted` 的第二个条件 → 空表单用例红;⑤`live` 开关误加 `refreshPreview` → 「live 未调」用例红;⑥`description: … || undefined` 的 `|| undefined` → 空 desc 字段用例红;⑦`confirm` 的 catch → 失败不关弹窗用例红;⑧`.sv-btn-primary:hover` 整条 → cssCascade 用例红。

- [ ] **Step 5: Commit**

```bash
git add src/photos/components/SmartViewCreateDialog.vue src/photos/components/__tests__/SmartViewCreateDialog.test.ts src/views/PhotosSmartViews.vue src/views/__tests__/PhotosSmartViews.test.ts src/styles/theme.css docs/THEMING.md
git commit -m "feat(photos): P7a-T5 智能视图创建弹窗 —— 左表单 + 实时预览 + 5 模板"
```

---

