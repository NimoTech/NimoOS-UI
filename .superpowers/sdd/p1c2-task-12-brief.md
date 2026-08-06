### Task 12: `ResourcesTab`(授权资源 / 附件 / 暂存区三段 + 三级回滚)

**Files:** Create `src/ai/util/stagedGroups.ts` + `.test.ts`、`src/ai/components/tabs/ResourcesTab.vue` + `.test.ts`;Modify `src/i18n/{zh_cn,en_us}.ts`

**纯模块**(先做,单测覆盖):
```ts
groupStagedChanges(groups: StagedGroup[]): Array<StagedGroup & {
  batches: Array<{ batchId: string|number; items: StagedItem[]; summary: { mkdir: number; rename: number; delete: number } }>
  looseItems: StagedItem[]
}>
badgeFor(op: string): 'MOD' | 'DEL' | 'MKD' | 'REN'
formatStagedPath(it: StagedItem): string      // rename 且有 dst_path → `a → b`
formatStagedSize(n?: number): string          // 无值 → '—';B/KB/MB 三档
relativeTime(unixSec: number): { key: string; params?: Record<string, unknown> }  // i18n 键 + 参数(刚刚/N 分钟前/N 小时前/N 天前)
attachmentKindIcon(kind?: string): string     // image/video/audio/text/binary 的 emoji,默认 📎
```
逐字港 Vue2 `ResourcesTab.vue:136-232`。关键不变量:分组用 `batch_id != null` 判定(**`0` 是合法 batch id**)、`Map` 的**插入顺序**要保留、`summary` 里 `delete_file`/`delete_dir` **都计入 `delete`**、`relativeTime` 入参是**秒**。

**组件**逐字港(279 行)三段:
1. **授权资源**:计数、空态(含 `<code>@</code>` 内联)、每行 `📁/📄` + path + `has_agent_md` 徽标 + `×`(`:disabled="busy"`)→ `emit('remove-resource', r.id)`。
2. **附件**:计数、空态、每行 kind emoji + 文件名 + 大小 + `sent`/`draft` 徽标 + 下载 `<a :href="rawUrl(a.id)" target="_blank">`(`service.ai.attachmentRawUrl`)+ 仅草稿可删。
3. **暂存区**(`v-if="stagedChanges.length > 0"`):总计数行 → 每轮 `.rt-turn`(相对时间 + 文件数 + 整轮回滚按钮,**任一项 `snapshot_missing` 则硬禁用**)→ 批次子组(`▾/▸` 折叠、`v-show` 保留 DOM、默认折叠、summary 行、批量回滚)→ 项行(op 徽标 + path + 大小 + `orphan` 徽标 + 单项回滚)→ 松散项(无单项回滚)→ 底部 `Commit All (N files)`(`:disabled="busy || committing"`)。
`reverting` 三种键读法必须照抄:`isReverting(runId)` 用裸 key、`isRevertingBatch(batchId)` 用裸 key、`isRevertingItem(stagedId)` 用 `'item:' + id`。
`$set` → 直接赋值(`expandedBatches` 用 `ref<Record<string|number, boolean>>`)。
裸色 8 处(Vue2 `:248-269`)→ token:`.rt-tag-draft` 背景/文字 → `--warning-soft`/`--warning`;`.badge-NEW`/`.badge-DEL`/`.badge-REN`/`.badge-MKD` 背景 → 对应 `--success-soft`/`--danger-soft`/`--teal-soft`(缺 `--teal-soft` 就加,两主题都给值);`.rt-orphan-tag` → `--danger-soft`;`.rt-commit` 的 `color: white` → `--text-on-accent`。
**移植 Vue2 的既有测试** `NimoOS-UI/tests/resourcesTabBatch.test.js`(164 行,DOM+emit 级 9 断言)到 `ResourcesTab.test.ts`(`propsData` → `props`、`w.destroy()` → `w.unmount()`、`$t` mock 换成真 `zh_cn` i18n),它钉住的行为一条都不许丢。
i18n:`aiResAuthorized`/`aiResAttachments`/`aiResPending` 三段标题、两个空态、`aiResSent`/`aiResDraft`/`aiResDownload`/`aiResRemoveAuth`/`aiResAgentRunning`/`aiResRevert`/`aiResReverting`/`aiResCommitAll`/`aiResCommitting`/`aiResOrphan`/`aiResSnapshotMissing`/`aiResTurn`/`aiResFilesInTurns`/`aiResCollapse`/`aiResExpand`/`aiResBatchSummary`(带 `{mkdir}{rename}{delete}` 参数,zh 照 Vue2 `zh_CN.json:970` 的现成文案)/`aiResRevertItem`/`aiResRevertBatch`/相对时间 4 键。

- [ ] **Step 1: 写失败测试** —— 纯模块 10 例(batch_id=0 归组 / 插入顺序 / delete_file+delete_dir 都计 delete / 松散项分离 / badgeFor 五映射 + 默认 / rename 路径箭头 / size 三档 + 无值 / relativeTime 四档);组件 = 移植的 9 条 + 新增 6 条(授权段 × 触发 emit 与 busy 禁用 / 附件 sent 不可删、draft 可删 / 下载链接 href 走 attachmentRawUrl / 整轮回滚在 snapshot_missing 时禁用 / commit 按钮禁用条件 / 三段空态)。
- [ ] **Step 2: 跑测试确认失败。**
- [ ] **Step 3: 实现。**
- [ ] **Step 4: 跑测试 + tsc + 零裸色 grep + parity 绿。**
- [ ] **Step 5: Commit** `SP8-P1c2: ResourcesTab (authorized / attachments / staged changes)`

---

