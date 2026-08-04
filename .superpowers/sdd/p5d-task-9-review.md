# P5d · Task 9 独立评审(T9 票1导航入口 + 票2注释债 + K36 a11y)

评审者:独立评审(未采信实现者报告任何断言,逐条自行复核)。BASE `71eab1f` → HEAD `19fa973`。

## 判定

1. **规格符合(计划书 §T9 1-7 条)**:✅ 全部符合。
2. **任务质量**:**通过**。

## 逐文件「有没有多改」

- `src/ai/views/SettingsPage.vue`(26+/13-):只含头注释订正(:26-34)、`onDetailsClick` 删除留注释(:183-190)、模板 button→router-link(:424-432)三处,其余字节级未动。✅ 无多改。
- `src/ai/views/SettingsPage.test.ts`(29+/9-):仅 import 加 `RouterLink`(纯增量)+ 用例 8 整段替换(旧断言体逐字保留为注释),其余 30 条用例未出现在 diff。✅ 无多改。
- `ParserStatus.test.ts`(6+/1-):仅 `:206` 一行注释替换成 6 行订正注释,非注释行 0 改动。✅
- `ParserTest.test.ts`(5+/1-):仅 `:180` 一行注释替换成 5 行订正注释,非注释行 0 改动。✅
- `SettingsView.test.ts`(4+/2-):两处合计,注释订正净 -1 行 + K36 断言净 +3 行,严格用满「3行+1行注释」预算,文件其余部分未出现在 diff。✅

## 有没有既有用例被悄悄删掉/改弱

**没有**。逐条核对:`SettingsPage.test.ts` 用例 8 是「反转」(旧断言体完整存档为注释,非删除);K36 是往已有用例(`SettingsView.test.ts` 迁移弹窗用例)**追加**3 行断言,不是新增/替换用例;票2三处只动注释。独立跑全量套件确认 **331 文件 / 3958 例全过**(与基线一致,无缩水信号)。

## 视觉零变化四条

1. `settings-styles.scss`:`git diff 71eab1f..19fa973 -- src/ai/styles/settings-styles.scss` **零输出**,确认零改动。
2. `src/i18n/**`:`git diff 71eab1f..19fa973 -- src/i18n/` **零输出**,确认零改动(文案键仍 `aiCfgDetails`)。
3. `.set-detail-link` 类名/内容物未动:模板 `{{ t('aiCfgDetails') }} <AgentIcon name="chev" :size="12" />` 逐字未动,确认是 `AgentIcon` 不是 `KIcon`。
4. `settings-styles.scss:73` 本来就含 `text-decoration: none;`(读源码确认,同行内联,非独立第74行)→ `<button>`→`<a>` 视觉一致的依据成立。

## 自跑两个探针 + K36 强度对比

- **票1 RED 探针**:自行 `cp` 备份→行首锚定改回 `<button @click="onDetailsClick">` + 恢复 handler→`grep` 确认落盘→独立跑 `vitest run SettingsPage.test.ts`,**复现报红**(`expect(link.exists()).toBe(true)` 失败,29 passed/1 failed,与报告输出一致,除 skip 计数因命令未加 `-t` 过滤而略有出入,不影响结论)→ `cp` 备份覆盖还原→`md5sum` 逐字节一致(`93b0f52e...`)→`git status`/`git diff --stat` 干净。
- **K36 变异**:自行 `cp` 备份 `SettingsView.vue`→行首锚定去掉 `DialogTitle` 的 `as-child`→`grep` 确认落盘(`587: <DialogTitle>`)→独立跑 `vitest run SettingsView.test.ts -t K29`,**复现报红**(`titleEl.id` 期望值与实际不符,与报告输出逐字一致)→ `md5sum` 还原一致(`b5f84730...`)→`git status` 干净、`HEAD` 仍 `19fa973`。
- **K36 强度对比**:实测代码是 `titleEl.id === modal.getAttribute('aria-labelledby')` + `modal.querySelectorAll('[id]')` 长度=1,读 `NoteEditPane.test.ts:856-866`(T8 冲突弹窗)与 `NotesView.test.ts:639`(T6 删除确认弹窗)确认两者用的正是同一模式(元素身份+计数守卫)→ **T9 与 T6/T8 强度齐平,成立**。计划书点名的先例 `IndexedFilesView.test.ts:1947-1951` 读源码确认**只比对字符串**(`labelId` 与 `host.querySelector('#'+labelId)` 的存在性+文本),**未验证该元素就是 `.k-modal-title` 本身、也无 `[id]` 计数守卫**→ **该先例确实较弱,值得登记**:治理点名的"先例"实际弱于本档后续刀(T6/T8/T9)确立的做法,建议后续收官文档更新先例指向 T6/T8 而非 `IndexedFilesView`。

## 导航路径核实

`/ai/knowledge` 现在能渲染:`knowledgeRoutes.ts` 确认 `''` 子路由 → 真 `DashboardView`(T12 已反转)。rail 第4项「笔记」**仍是占位**:`KnowledgeLayout.vue` 的 `NAV` 数组第4项是 `{id:'notes', labelKey:'aiKbNavNotes'}`,`knowledgeRoutes.ts` 的 `notes` 子路由仍映射 `KnowledgeDeferred`,归 T10 反转 —— **报告这一点写得准确,协调者写验收清单时可直接采信**:T9 之后能走到知识库仪表盘,但「笔记」那一屏要等 T10。

## 算式与收尾

`vue-tsc --noEmit` 0、`vite build` 0、全量 `pnpm test` 独立复跑 = **331 文件 / 3958 例全绿**(与报告一致)。新增注释扫描 `#hex`/`rgb`/`hsla` **零命中**,符合 R17。收尾 `git status` 干净、`HEAD` 仍 `19fa973568cc7bd068b2ba6f09a5b928768c34dd`。

## 发现

- Minor:报告的票1 RED 探针输出显示 `28 skipped`,而本评审无过滤条件独立复跑显示 `30 passed`(全量未 skip)——**只是调用参数差异(报告用了 `-t` 过滤)**,不影响探针结论本身,无需返工。取证命令:`pnpm exec vitest run src/ai/views/SettingsPage.test.ts`。
- Minor(治理文档层面,非本刀缺陷):计划书 §15.2 与先例文件点名的 `IndexedFilesView.test.ts:1947` 强度弱于 T6/T8/T9 实际做法,建议 P5e/P5f 或收官文档更新这条先例指向,避免后续刀误引弱先例。

## 无法核验项

- 未对全仓 331/766 文件的「文件数」统计口径做独立重新定义式核算(该计数为历次任务沿用的既有基线指标,本刀自身未新增/删除文件,已通过 diff 零新文件确认达标,但未逆向核实 331 这个绝对值本身的历史计算公式)。
