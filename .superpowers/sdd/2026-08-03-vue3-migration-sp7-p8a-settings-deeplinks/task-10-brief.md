## Task 10: 杂项收口

**Files:**
- Modify: `src/photos/util/httpErrors.ts` + `src/photos/util/__tests__/httpErrors.test.ts`
- Modify: `src/views/PhotosPersonDetail.vue`、`src/views/PhotosPeople.vue`
- Modify: `src/photos/util/taskBus.ts` 或 `src/views/Photos.vue`(任务过期清理,**实施时先定位**)

**四件事**

1. **`isConflict` 加词边界**。现状 `httpErrors.ts:8` 用裸 `/409/`,会把 `4090` / `1409` 误判成冲突;同文件 `isNotFound` 已用 `/\b404\b/`。改成 `/\b409\b/` 对齐。**live 调用点只有 1 处**(`AlbumPickerDialog.vue:143`,回源已核 —— 开工 prompt 说的「3 处」不成立)。⚠️ 同时把 `httpErrors.ts:21-25` 那段「刻意不同、收紧超出范围、记账留后续」的注释改成如实描述(本期已收紧)。
2. **`photosPersonMergedToast` 的空名兜底**。`PhotosPeople.vue:263` 已有 `intoName || t('photosPersonMergeAsSame')` 兜底,但 `PhotosPeople.vue:332`(`targetName`)与 `PhotosPersonDetail.vue:420`(`target.name`)**没有** ⇒ 目标是未命名人物时渲染成「已合并到「」」。给这两处补同样的兜底。
3. **P1 挂账:非 `index` 类型的 done 任务 5s 过期清理**。回源 Vue2 的 `scheduleTaskRemove`(`src/store/modules/photos.js` 顶部 `taskTimers` 那套,行 ~40-58)与 `_onTaskBus` 的 done 分支;New-UI 侧落点先 `grep -n 'scheduleTaskRemove\|REMOVE_DONE_TASKS_BY_TYPE\|taskTimers' src/` 定位。**连带收 `Photos.vue` 里那条已知边界**:`onTaskProgress` 的注释记着「`fetchIndexStatus` 的 idle 对账会移除 index 任务,迟到的重复 done 事件会二次 toast」——在同一处加去重守卫。
4. **三条只登记不改的**(写进代码注释 + 台账,**不动代码**):
   - 人物资产 300 上限照搬 Vue2 无分页;
   - `usePlaceAssets.months` 已是死导出(P7b 改用自算的 `gridMonths`),按禁无关重构保留;
   - `places` 维度未做端到端贯通(P7b 只补了 `cameras`)。

- [ ] **Step 1: 写失败测试**

```ts
// httpErrors.test.ts
it('isConflict 不再把 4090 / 1409 误判成冲突', () => {
  expect(isConflict({ message: 'code 4090' })).toBe(false)
  expect(isConflict({ message: 'req 1409 failed' })).toBe(false)
  expect(isConflict({ message: 'HTTP 409' })).toBe(true)
  expect(isConflict({ response: { status: 409 } })).toBe(true)
})

// PhotosPeople.test.ts / PhotosPersonDetail.test.ts
it('合并到未命名人物时 toast 不渲染成「已合并到「」」', async () => {
  // target.name 为空串 ⇒ 断言 toast 文本含兜底词,不含空的书名号
  expect(toastText).not.toMatch(/「」/)
})

// 任务过期清理
it('非 index 类型的 done 任务 5 秒后从列表移除', async () => {
  vi.useFakeTimers()
  // push 一个 type='ocr' status='done' 的任务 → advanceTimersByTime(4999) → 仍在
  // → +2 → 已移除
  vi.useRealTimers()
})
it('index 类型的 done 任务不走 5 秒过期(由 idle 对账负责)', async () => { /* … */ })
it('迟到的重复 done 事件不二次 toast', async () => { /* … */ })
```

- [ ] **Step 2–4: 运行确认失败 → 实现 → 确认通过**

- [ ] **Step 5: 变异验证 + Commit**

```bash
git add src/photos/util/httpErrors.ts src/photos/util/__tests__/httpErrors.test.ts \
        src/views/PhotosPeople.vue src/views/PhotosPersonDetail.vue
git commit -m "fix(photos): 杂项收口(P8a-T10)

isConflict 加词边界与 isNotFound 对齐(live 调用点回源实证只有 1 处,非 3 处)
photosPersonMergedToast 两处空名兜底补齐
P1 挂账:非 index 类型 done 任务 5s 过期清理 + 迟到 done 事件去重"
```

---

