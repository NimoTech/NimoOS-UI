## Task 4: AI 卡组件 `PhotosAiCard.vue`

**Files:**
- Create: `src/photos/components/PhotosAiCard.vue`
- Test: `src/photos/components/__tests__/PhotosAiCard.test.ts`

**Interfaces:**
- Consumes: T1 store(`aiFeatures` / `setAiFeature` / `about` / `rebuildIndex` / `reclusterFaces`);`src/photos/stores/timeline.ts` 的 `tasks`(读 `rebuild` 任务进度);T2 键。
- Produces: `<PhotosAiCard @toast="(p: { icon: string; text: string }) => void" />`

**回源坐标**:Vue2 `PhotosSettings.vue:129-192`(模板)、`:283-291`(`rebuildTask` watcher)、`:332-370`(`rebuildTask`/`indexing`/`indexedPct`/`coverageCount`/`lastBuiltText`/`featureRows`)、`:458-486`(`rebuildIndex`/`doRecluster`)。

**逐条 1:1 契约**

1. **4 个功能开关**,顺序固定 faces → scenes → ocr → smartview(`:363-369`)。开关是 `.st-switch[data-on]` 形态。
2. **`rebuildTask` 的查找优先级**(`:332-337`):先按本地记住的 `rebuildTaskId` 找,找不到再找**任意** `type === 'rebuild'` 的任务,再没有就 `null`。
3. **`indexing = rebuildTask?.status === 'running'`**;`indexedPct = Math.round((progress || 0) * 100)` —— 注意后端 `progress` 是 **0–1 的小数**,不是百分数。
4. **rebuild 完成/失败的 toast**(`:283-291`):**只在 `old.status === 'running' && new.status === 'done'` 这个跳变上**弹「已重建」+ 重拉 about;`status === 'error'` 弹失败(附 `t.error`)。⚠️ 这是「跳变触发」而非「状态为 done 就弹」——**照搬这个跳变判据**,否则每次任务列表刷新都会重弹。
5. **`lastBuiltText`**:`about.indexLastBuilt` 为空 → `photosSettingsIndexNever`;否则 `new Date(iso).toLocaleString()`。⚠️ **Vue2 这里没传 locale 参数**,与 §7c-2 / §7e-4 同类缺陷(中文界面出英文日期)—— 按铁律**改成跟随 i18n locale**(照 P5-T6 先例,用 `src/photos/util/relTime.ts` 已有的 locale 取法),并注释登记。
6. **`doRecluster` 的 3 秒防抖窗口**(`:483-484`):成功/失败都在 `finally` 里 `setTimeout(() => reclustering = false, 3000)`,防连点。
7. **`coverageCount = about?.indexCoverage ?? 0`**。

- [ ] **Step 1: 写失败测试**

```ts
describe('PhotosAiCard', () => {
  it('4 个开关顺序固定 faces→scenes→ocr→smartview', async () => { /* 断言 data-test 序列 */ })

  it('点开关调 setAiFeature(id, 新值);失败时 emit toast', async () => { /* … */ })

  it('indexedPct 把后端 0-1 小数换算成百分数(progress 0.42 → 42%)', async () => { /* … */ })

  it('rebuildTask 查找优先级:先 rebuildTaskId,再任意 type=rebuild', async () => { /* … */ })

  it('只在 running→done 的跳变上弹「已重建」toast,不在每次刷新都弹', async () => {
    // 先把任务置成 done(无 running 前态)→ 断言零 toast
    // 再走 running → done → 断言恰好一条 toast
  })

  it('running→done 跳变后重拉 about(Vue2 :286)', async () => { /* … */ })

  it('lastBuilt 为空显示 never', async () => { /* … */ })

  it('lastBuilt 的日期跟随 i18n locale(Vue2 无 locale 参数是缺陷,本期改正)', async () => {
    // 断言渲染出的日期串符合当前 locale 的格式(如 zh 下不含英文月份缩写)
  })

  it('recluster 点一次后 3 秒内禁用(防连点)', async () => {
    vi.useFakeTimers()
    // 点击 → 断言 disabled → advanceTimersByTime(2999) → 仍 disabled
    // → advanceTimersByTime(2) → 恢复可点
    vi.useRealTimers()
  })
})
```

- [ ] **Step 2–4: 运行确认失败 → 实现 → 确认通过**

Run: `pnpm exec vitest run src/photos/components/__tests__/PhotosAiCard.test.ts --reporter=verbose`

- [ ] **Step 5: hover 级联守卫**

`.st-switch[data-on]` 是带变体的元素 ⇒ 变体必须自带 `:hover`。加断言并做删码验证。

- [ ] **Step 6: 变异验证 + Commit**

变异验证:①把跳变判据改成 `t.status === 'done'` → 「不在每次刷新都弹」应变红 ②把 `indexedPct` 的 `* 100` 删掉 → 百分数用例应变红 ③把 3000 改成 0 → 防连点用例应变红 ④给 `toLocaleString()` 传死 `'en'` → locale 用例应变红。

```bash
git add src/photos/components/PhotosAiCard.vue src/photos/components/__tests__/PhotosAiCard.test.ts
git commit -m "feat(photos): 设置页 AI 卡(P8a-T4)

按铁律修正的 Vue2 缺陷:lastBuilt 日期写死英文 locale(与 spec §7c-2/§7e-4 同类)。"
```

---

