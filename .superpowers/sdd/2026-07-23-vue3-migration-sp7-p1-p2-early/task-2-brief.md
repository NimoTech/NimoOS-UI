### Task 2: 纯函数移植——assetToPhoto / groupToMonth / hoverScrub / taskBusAdapter / taskDoneCoalescer

**Files:**
- Create: `src/photos/util/assetToPhoto.ts`、`src/photos/util/hoverScrub.ts`、`src/photos/util/taskBus.ts`、`src/photos/util/taskDoneCoalescer.ts`
- Test: `src/photos/util/__tests__/assetToPhoto.test.ts`、`hoverScrub.test.ts`、`taskBus.test.ts`、`taskDoneCoalescer.test.ts`

**Interfaces:**
- Consumes(逐字移植源,行为不得改):Vue2 `src/store/modules/photos.js:117-189`(assetToPhoto)、`:215-219`(groupToMonth,MONTH_NAMES 同文件顶部)、`src/views/Photos/hoverScrub.js`(全文 36 行)、`src/views/Photos/photosTaskBusAdapter.js`(unwrapTaskBusPayload `:9-39`)、`src/views/Photos/taskDoneCoalescer.js`(createTaskDoneCoalescer `:11-45`)。
- Produces(TS 签名,T3/T6/T7 消费):
  - `assetToPhoto(a: Record<string, unknown>): Photo`;`export interface Photo`(字段照 Vue2 映射输出:id/title/isVideo/duration/durationMs/fav/hasOcr/date/takenAt/… 全集,类型宽松 string|number|boolean|undefined)
  - `groupToMonth(g: { year: number; month: number; assets?: unknown[] }): Month`;`export interface Month { key: string; title: string; loc: string; photos: Photo[] }`
  - `computeFrameFromX(clientX: number, rectLeft: number, rectWidth: number, frameCount: number): number`;`computeWindowStyle(frameW: number, frameH: number)`;`computeStripStyle(frameCount: number, currentFrame: number)`(返回样式对象,shape 照 Vue2)
  - `unwrapTaskBusPayload(evt: unknown): TaskBusPayload | null`(字段 id/type/label/status/progress/current/total/added…,数字字段 Number() 转换,照 Vue2)
  - `createTaskDoneCoalescer(announce: (tasks: TaskBusPayload[]) => void, delayMs = 2600)`(返回 `{ push(task): void; flushNow(): void; dispose(): void }`——若 Vue2 返回面不同,以 Vue2 为准并在报告里注明)

- [ ] **Step 1: 写失败测试**(每模块至少覆盖:assetToPhoto 的 isVideo/duration 格式化/fav 默认 false/livePhoto 字段;groupToMonth 的 `month===0→'unknown'/'Unknown Date'` 与 `YYYY-MM` 补零;computeFrameFromX 的边界钳制 [0, frameCount-1];computeStripStyle 的 `translateX(-100*i/N%)`;unwrapTaskBusPayload 对 `{Properties:{...全 string}}` 信封的数字转换与非法输入返 null;coalescer 的 2600ms 去抖合并(vi.useFakeTimers)与 dispose 后不再触发)
- [ ] **Step 2: RED** — `pnpm vitest run src/photos/util` 失败(模块不存在)。
- [ ] **Step 3: 逐字移植为 TS**(逻辑零改动,只加类型;`MONTH_NAMES` 保持英文月名数组——title 是 UI 文案但 Vue2 也是英文+年,P1 保持一致,i18n 归后续打磨)。
- [ ] **Step 4: GREEN** — 单测过;`pnpm test` 全绿;`npx tsc --noEmit` 干净。
- [ ] **Step 5: Commit** — `feat(photos): 时间线纯函数移植(assetToPhoto/groupToMonth/hoverScrub/任务总线适配/完成合并器)`

---

