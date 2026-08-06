# P5e Task 7 独立评审 —— `SearchView.vue` 下半(结果卡 + 两个子组件接线 + 文件字节流)

评审者:sonnet(双重降级刀:T7 由 sonnet 实现,评审也是 sonnet,与 T3 同类,协调者 brief 已知情）。
被审提交:`cafceea`(父 `39dac27`）。改动文件:`src/ai/knowledge/views/SearchView.vue`(续写）·
`SearchView.test.ts`(续写）+ 台账报告。

## 0. 起点核验

```
$ git log --oneline -3
a069602 docs(p5e): 裁定 R27/R28 …
cafceea feat(p5e-T7): SearchView.vue lower half …
39dac27 docs(p5e): T6 评审 …
$ git status --porcelain   → (空)
$ git diff 39dac27 cafceea --name-only
.superpowers/sdd/p5e-task-7-report.md
src/ai/knowledge/views/SearchView.test.ts
src/ai/knowledge/views/SearchView.vue
```
只改 3 个文件(2 产品 + 1 报告)。`.vue` 总数 `find src -iname "*.vue" | wc -l` = **185**(与 T6 起点一致，零新建）。
`color-guard.test.ts` 独立复跑：**187 passed (187)**。均与 T7 自报一致。

## 1. 模板/脚本逐字对蓝本（自读 `git show 7a6ee6b7:src/views/AI/Knowledge/SearchView.vue`）

- `:121-156` 结果卡列表、`:158-172` error 态+两子组件挂载、`:186-190` 两个 ext 常量集、
  `:341-398` script 尾段 —— 逐行比对，New-UI 模板与蓝本**逐字一致**（含 `k-match-pill` 两个不同键、
  `k-more-hint` 的 `chunks.length - 1`、`r.chunks[0] && r.chunks[0].snippet` 空数组兜底、
  `fetchBlobUrl`/`openOriginal`/`downloadFile`/`onDrawerToast` 的分支结构）。
- `openOriginal`/`downloadFile` 的 `((e && e.message) || e)` → `String((err && err.message) || e)`
  是 TS `unknown` 类型下的等价包裹，运行时输出不变，已核实。

## 2. K50/方案 A 四条判据 —— 独立复现（cp 副本 + 行首锚定注入 + 先证落盘 + md5 复核）

起点 md5：`189df8a9d6397286672d99921387d2c0`（与报告一致）。

| # | 判据 | 我的操作 | 结果 |
|---|---|---|---|
| ① | `responseType:'blob'` | `sed` 改成 `'arraybuffer'`（md5 变为 `891b73…`，确认落盘）| ✅ 报红：`1 failed \| 69 passed (70)`，失败项精确是判据①用例。还原后 md5 复核一致，70/70 转绿 |
| ② 🔴 | `window.open` 打开 blob:，不含 `token=` | 把 `fetchBlobUrl(...)` 那行替换成直接 `service.file.fileUrl(file.fullPath) + '&inline=1'`（md5 变为 `9083a3…`）| ✅ **报红**：判据②③④ + `openOriginal` 抛错用例共 **4 条**同时失败。这是计划书点名"用错 API 三门全绿、只在真机上错"最怕出现的一类——**这次它真的有牙**。还原后 md5 复核一致 |
| ③ | `withVersion()` 证据（不写测试）| 亲读 `.sp8/NimoOS-Service/src/http.ts:6-10`：`/^\/v[1-9]/.test(url)` 对 `/v3/file?...` 成立（`3`∈`[1-9]`），原样放行；亲读 `SearchView.test.ts:80-83` 确认 `getHttp` 整体被 `vi.mock` 替换成 `() => ({ get: httpGet })` | ✅ **独立确认**：`withVersion` 在这个 mock 边界下确实不可能被真实执行到，写断言只能测 mock 本身 = 安慰剂。R28 成立 |
| ④ | `inline` 参数两条 | 把 `(opts.inline ? '&inline=1' : '')` 改成恒定 `'&inline=1'`（md5 变为 `43d825…`）| ✅ 报红：判据④用例单独失败（`1 failed \| 69 passed`）。还原 md5 复核一致 |

**结论：四条判据全部独立复现成立，尤其判据②反向断言（`window.open` 参数不含 `token=`）确认有真实判别力。**

## 3. `downloadFile` 的 `removeChild` / `revokeObjectURL` —— 独立 RED 探针

- 删除 `document.body.removeChild(a)` 那一行（md5 变为 `af8204…`）→ **报红**（`downloadFile` 成功用例失败）。还原 md5 复核一致。
- 删除 `setTimeout(() => URL.revokeObjectURL(url), 60000)` 那一行（md5 变为 `7922db…`）→ **报红**（同一用例失败，覆盖 revoke 断言）。还原 md5 复核一致。

两者均**真有断言**，非摆设。

## 4. T6 自建的自动上膛守卫 —— 两种偏态独立复现

- **偏态①（只写 markup，删掉全部四个监听）**：删除 `SearchView.vue:560-563` 四行监听（保留 `<FileDetailDrawer>` 标签本身，md5 变为 `29d75d…`）→ **7 条用例同时报红**，含守卫本体 + T7 范围自证 + 4 条监听用例 + N41 同挂载用例。还原 md5 复核一致。
- **偏态②（接三漏一，且不限于 `@toast`）**：只删除 `@open`（保留 `@close`/`@download`/`@toast`，md5 变为 `04b751…`）→ **3 条报红**（守卫本体 + 范围自证 + `@open` 用例）。还原 md5 复核一致。
- 另核：T6 原写的守卫断言主体（`for (const ev of [...]) expect(src.includes(ev)).toBe(true)`）与 T7 提交后**逐字比对未变**——变的只是 describe/it 的**文案**（惰性通过 → 上膛已满足，符合裁定 R25 预期的状态翻转），核心循环断言未被放宽。

## 5. R27 / R28 —— 独立确认

- **R27**（`store.toast(...)` 追认）：`grep -rn "store\.toast(" src/ai/knowledge/*.vue` 命中 `KnowledgeLayout.vue`/`QueueView.vue`(11次)/`IndexedFilesView.vue`(3次)/`SettingsView.vue`(9次)/`SearchView.vue`(6次) —— **既有 6 页确实全走 `store.toast(...)`**。亲读 `knowledgeStore.ts:312-314`：`function toast(msg){ useToast().show(msg, 2400) }`。亲读 `src/stores/toast.ts:21`：全局 `show()` 默认 `1500`。⇒ **若直调 `useToast().show(msg)` 确实会丢 2400ms**。**R27 独立确认成立。**
- **R28**（判据③不写测试正确）：见上表 §2 判据③行，独立确认 `getHttp` 在测试里整体被 mock，`withVersion` 不可达。**R28 独立确认成立。**

## 6. N41（同时挂载两个子组件 Esc 同关）

`grep -rn "stopPropagation" src/ai/knowledge/` **零命中生产代码**（仅 2 处注释提及"不加 stopPropagation"）。
`FileDetailDrawer.vue:186-189` 与 `KFileViewer.vue:68-71` 各自独立在 `window` 上注册/注销 `keydown Escape` 监听，
互不知晓对方存在——照抄蓝本既有行为，未"修好"。测试 `SearchView.test.ts:1415-1432` 同时把 `openFile`/`viewerFile` 设非空，
派发一次全局 `Escape`，断言两者都被清空——真实覆盖了这个场景。

## 7. 结果卡字段 / K49 / 空数组兜底 / k-more-hint —— 独立 RED 探针

| 探针 | 操作 | 结果 |
|---|---|---|
| K49 组件层注入 | 把 `<div class="k-rcard-snippet" v-html="highlight(...)" />` 改成 `{{ highlight(...) }}`（文本插值，不再解析 HTML）| ✅ 报红（`<mark>` 断言失败，证明测试确实依赖 v-html 渲染路径，非摆设）|
| k-more-hint 文案 | `chunks.length - 1` → `chunks.length` | ✅ 报红 |
| 空 chunk 兜底 | `r.chunks[0] && r.chunks[0].snippet` → `r.chunks[0].snippet` | ✅ 报红（挂载抛异常）|

三条独立复现，均有牙。还原后 md5 全部复核一致。

## 8. 其它交叉核验

- `knowledgeStore.ts:550-561` `runSearch` 直接 `return service.ai.searchText(body)`，**零归一化**——mock 层次方向确认正确。
- `FileDetailDrawer.vue:108` `if (!c || c.chunkNo == null) { ...; return }` —— 证实 `makeFileVM` 默认 `chunks:[]` 能安全绕开 `loadChunkContext` 网络调用（`fetchFull` 早退），§7.1 设计理由成立。
- E-57 剩 4 处：`SearchView.vue:508/539/541/542` 逐行核对，均为 `var(--text-quaternary)`/`var(--success)`，**零色字面量**，与报告结论一致。
- K44：`grep -n "^\s*<style" SearchView.vue` 零命中（仅注释提及字样）。
- 测试标题级 diff（`39dac27` vs `cafceea`，仅比对 `describe(`/`it(` 行）：T6 原 34 条用例**逐字保留**（除两处已知预期的状态翻转描述外），T7 新增 36 条，共 70 条，与自报吻合，**未发现既有断言被削弱或删除**。

## 9. 三门复跑（现测，非采信）

```
pnpm test          → Test Files 335 passed (335) / Tests 4251 passed (4251)  exit 0
pnpm exec vue-tsc --noEmit → exit 0
pnpm build         → exit 0（含正常的 chunk 体积警告，非错误）
```

与 T7 自报数字（335/4251）逐字一致。

## 10. 探针清单 + 还原确认

全部通过 `cp` 副本 → `sed`/行删注入 → 立即 `md5sum`（证明注入已落盘且与原件不同）→ 跑测试确认报红 →
`cp` 副本覆盖还原 → `md5sum` 与原始 `189df8a9d6397286672d99921387d2c0` 逐字节一致。**全程零 `git checkout/restore/stash`。**

探针列表（共 9 组）：① responseType→arraybuffer、② window.open 直开 fileUrl()、③ inline 恒定拼接、
④ 全删四监听、⑤ 只删 `@open`、⑥ 删 removeChild、⑦ 删 revokeObjectURL setTimeout、
⑧ v-html→文本插值、⑨ k-more-hint 文案改错、⑩ 空数组兜底删 `&&`。

最终确认：
```
$ git status --porcelain   → (空)
$ git stash list           → 仍是两条与 P5e 无关的历史条目（07-18/07-06），未碰
```

## 11. 结论

**Critical：0 / Important：0 / Minor：0。**

K50/方案 A 四条判据、`downloadFile` 两个资源清理断言、T6 自动上膛守卫的两种偏态、R27/R28 两条裁定，
经本评审逐条独立复现（非采信报告），**全部成立、全部有真实判别力**。模板/脚本逐字对蓝本，
mock 层次方向正确，N41/K49/E-57 等既定纪律项均核实照抄无误，既有 34 条 T6 用例未被削弱。

**T7 可以关账进 T8。**
