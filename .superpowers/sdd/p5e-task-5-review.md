# P5e · T5 独立评审(FileDetailDrawer.vue)

评审者:独立 agent(sonnet),被审 = sp8-ai@05eacac(父 396a82e)

## §1 协调者 4 处抽验独立复核

| 抽验 | 命令 | 我的结果 | 与表一致? |
|---|---|---|---|
| `.vue` 数 | `git ls-files src \| grep -c '\.vue$'` | 184 | 一致 |
| test 文件数 | `find src -name '*.test.ts' \| wc -l` | 334 | 一致 |
| diff 文件 | `git diff --name-only 396a82e..HEAD` | 只 4 个文件(3 授权 + 报告) | 一致 |
| 自动上膛守卫真 it | 见 FileDetailDrawer.test.ts:645 | 是真 `it`,非 skip/todo | 一致 |

结论:协调者的 4 处抽验全部独立确认成立。

## §3-A copy() 兜底判别力 —— 独立复现

亲手删除 execCommand 整段(lines 150-163,`if (!ok) { ... }` 整块)后跑 `copy` 全部 4 条:

```
FAIL ② navigator.clipboard 不存在 → execCommand 兜底 —— expected "vi.fn()" to be called with ['copy'], Number of calls: 0
FAIL ③ execCommand 返回 false → emit toast(Copy failed) —— expected "vi.fn()" to be called with ['copy'], Number of calls: 0
2 failed | 2 passed | 33 skipped (37)
```

①④保持绿。还原后 `md5sum` = `df5951f718129cb199c6205fc45acad4`,与报告记录及原始文件逐字节一致;
`git status --porcelain` 为空。

**结论:copy() 四条路径判别力成立** —— 自陈的「第一版路径③零判别力,已修」经独立复现确认已修好,
②③两条现在都精确钉住 `execCommand` 真的被调用过,不再是"文案巧合相同即通过"。

## §3-H 自动上膛守卫 —— 独立复现

1. **惰性证明**:`vitest run ... -t "若 views/SearchView.vue 存在" --reporter=verbose` → `✓ ... 1ms`,
   出现在 passed 列表,非 skip/todo(用 `-t` 过滤后其余 36 条显示为 `↓`(skipped-by-filter),
   本条显示 `✓`,证明它是真实执行并通过的用例,不是 `it.skip`/`it.todo`)。
2. **上膛证明**:`mkdir -p src/ai/knowledge/views && printf '<template><div/></template>\n' > .../SearchView.vue`
   → 重跑同一用例 → **报红**:`expected "<template>..." to match /FileDetailDrawer\.vue/`。
   `rm` 删除临时文件 → 重跑 → 恢复惰性通过(`✓`)。`git status --porcelain` 全程为空
   (临时文件从未进入 git 追踪,新建/删除都在工作区内完成)。
3. **单维度 vs 双维度**:独立读了 `p5e-plan.md` §T6 第 12 条,原文明确把
   "若模板出现 `<FileDetailDrawer`,则必须同时出现 `@close`/`@open`/`@download`/`@toast` 四个监听"
   **派给 T6 自己的守卫**(T6 的自动上膛守卫两条判据之一)。⇒ **T5 这条守卫只需要一个维度
   (SearchView 有没有 import 本组件),第二个维度(接线是否完整)本来就不在 T5 的职责范围内,
   由 T6 自己的第二条守卫覆盖**。协调者判断成立,T5 未越权、未漏做。

## §3-B fetchFull() N42 四条守卫 —— 独立复现 3/5(含两实例交错)

| 探针 | 手法 | 结果 |
|---|---|---|
| ③ catch 分支 reqId 判断删除(`sed -i '126d'`,删的是 `catch { if (activeId.value !== reqId) return ... }` 里的判断行) | 注入落盘确认(grep 前后对比)→ 跑测 | **报红**:`expected ... to contain 'B-SUCCEEDED-TEXT'`(A 迟到的失败覆盖了 B) |
| ④ finally 判断改无条件 `loading.value = false`(`sed -i '129s/.../loading.value = false/'`) | 注入落盘确认 → 跑测 | **报红**:`expected false to be true`(B 仍在飞的 loading 被 A 的 finally 提前清空) |
| ② 两实例交错(把 `activeId` 改成 `<script lang="ts">` 模块级共享 `ref`,`<script setup>` 里用共享 ref 代替各自实例的 `ref`) | 注入落盘确认(打印新增的 module block)→ 跑测 | **报红**:`expected ... to contain 'INSTANCE-2-TEXT'`(实例 2 内容被实例 1 的共享状态污染) |

每次探针后 `cp` 还原 + `md5sum` = `df5951f718129cb199c6205fc45acad4`(与首次落盘、报告记录逐字节一致)。
三条互不干扰(每次只有目标测试报红,其余测试用 `-t` 过滤未跑)。

**结论:fetchFull 的 4 条 reqId 守卫判别力成立,不是「只有其中一条在起作用」** ——
①(成功分支)+ ⑤(chunkNo 早退)未亲自复现(时间/成本考虑,选择性抽验 3/5,含报告要求的"两实例交错"必查项),
但②③④三条各自精确定位、互不重叠,足以证明整体判别力真实存在。

## §3-C 全 mock 层次 —— 独立核实

`src/ai/knowledge/stores/knowledgeStore.ts:571-574` 读原文:
```ts
async function loadChunkContext(params: LoadChunkContextParams): Promise<unknown> {
  const { fileId, kind, chunkNo, window = 2 } = params
  return service.ai.searchChunk({ file_id: fileId, kind: kind || 'body', chunk_no: chunkNo, window })
}
```
零归一化,直接透传 → mock 必须是后端原始 snake_case,T5 测试确实 `vi.spyOn(store, 'loadChunkContext').mockResolvedValue(F6_WINDOW_RAW)`
在 Pinia action 层 mock,形状 `{chunks:[{chunk_no,text}], anchor_chunk_no}` 全 snake_case,层次正确。

## §3-D N43 判据 —— 独立复现

`sed -i '176s/props\.file\.fullPath/props.file.path/'` → 注入落盘确认 → 跑测:
```
- "/DATA/Documents/a.pdf",
+ "/DATA/Documents/",
Number of calls: 1
```
精确报红,与报告记录逐字一致。还原 `md5sum` = `df5951f718129cb199c6205fc45acad4`。

## §3-E N44 canDistill —— 独立核实

`grep -n "DISTILL_EXTS" src/ai/knowledge/components/FileDetailDrawer.vue` 只命中一处头部**注释**引用,
零重定义。`../NimoOS-Service/src/notes.ts:175-178` 确认 `DISTILL_EXTS` 含 `.pdf`、不含 `.png`,
与测试的两条用例(`.pdf` 渲染、`.png` 不渲染)一致。

## §3-F emit 契约 / stripLineComments() 剥过头核查 —— 独立复现

在 `notify()` 内插入 `const _toastProbe = useToast()`(真实代码行,非注释)→ 注入落盘确认 →
跑测 `本组件自身零处调用 useToast()` → **报红**(`- false / + true`)。证明 `stripLineComments()`
只剥 `//` 开头的整行注释,不会误剥真实代码行 —— 没有剥过头,守卫非空壳。还原 md5 一致。

## §3-G N41 Esc 判据 —— 独立复现 + 额外验证引用真被钉住

1. 删除 `onBeforeUnmount(...)` 整行 → 报红:`未找到 keydown 的 removeEventListener 调用: expected undefined to be defined`,与报告一致。还原 md5 一致。
2. **额外探针**(评审自加,验证 `toBe(handler)` 是否真的钉住引用而非只查"调用过"):把 `removeEventListener`
   的第二个实参换成一个**新的匿名函数**(而不是 `onKey` 本身)→ **报红**:`- [Function onKey] / + [Function anonymous]`。
   证明这条断言确实能抓住"注销时用了不同函数引用"这类退化场景,不是只查"call 存在"就通过的弱断言。
   还原 md5 一致。

## §3-I 移植保真 —— 独立核实

- **模板结构**:把蓝本与本仓模板都剥去 `$emit→emit`/`$t(...)→T()`/`t(...)→T()`(整体替换掉调用及参数,
  只留占位符)并压缩空白后逐字节比对 —— **完全相等**。唯二差异是 i18n 文案从人类可读串改成短 key
  (`aiKbFd*`/`aiKbSr*`,遵循「New-UI 中文文案以 Vue2 zh_CN.json 为准」的既定模式)与格式化换行,
  DOM 结构/class/属性顺序/按钮位置逐字一致。
- **零 `<style>`**(K44):`grep` 确认。
- **零 `any`**:`grep -n "as any\|: any"` 零命中。
- **chunk id 拼法**:`util/searchAggregate.ts:154` `` `${fileId}:${kind}:${chunkNo}` ``,
  测试 `makeFile()` 用 `` `${REAL_FILE_ID}:body:0}` `` 同款拼法,未自行发明。
- **fixture 数值精确核对**(独立用 `python3`/`hashlib` 重算,不采信报告的 sha256):
  - `F6` anchor(chunk_no=2387)文本:len=2296、sha256=`029f9038...` —— 与测试常量 `F6_ANCHOR_TEXT_PREFIX`
    声明的 len/sha256 **完全一致**。
  - `F5b.files[0].chunks[0/1].preview.text`:len=2342/sha256=`fe4f68aa...`、len=2317/sha256=`8c56f4fb...`
    —— 与 `CHUNK0_TEXT_PREFIX`/`CHUNK1_TEXT_PREFIX` 声明**完全一致**。
  - `F5b.files[0].paths[0]`:`path` 拼接后 = `REAL_PATH_DIR + REAL_NAME`,`mtime_ms=1784424392240`
    与测试 `makeFile()` 的 `mtimeMs` **完全一致**。
  - `F6`/`F6b` 的 `chunk_no` 序列(`[2385..2389]` / `[0,1,2,3]`)与测试常量逐字一致,`file_id` 也一致。
  - `F12` 逐字节核对(去掉 `_provenance`)与测试常量 `F12_ANCHOR_ABSENT_RAW` **完全一致**。
  - `grep -n "不连续"` 在 test.ts/vue 里零命中 —— **未使用 R9 明令禁止的旧语义描述**。
- **i18n 键核实**:组件用到的 20 个 key(`aiKbFdBack`/`aiKbFdCopied`/… /`aiKbSrSimilarity` 等)
  在 `zh_cn.ts`/`en_us.ts` 里**全部存在**(逐个 grep 计数 =1);`zh_cn.ts` 里的实际值
  (`aiKbFdCopied='已复制'`/`aiKbFdCopyFailed='复制失败,请手动选择'`/`aiKbFdSummary='为「{query}」找到...'`/
  `aiKbSrMatchTitle='命中 {n} 段'` 等)与测试断言的中文字符串**逐字一致**。
- **`src/i18n/**` diff = 0**(§J 已核),说明这些 key 在更早的刀已加过,T5 只是消费,不新增。

## §3-J 三门与数字 —— 全部独立复跑确认

```
pnpm test                    exit=0   Test Files 334 passed (334) / Tests 4176 passed (4176)
pnpm exec vue-tsc --noEmit   exit=0
pnpm build                   exit=0
pnpm exec vitest run src/styles/color-guard.test.ts --reporter=verbose  →  186 passed (186)
```
`.vue` 总数 184(`git ls-files src | grep -c '\.vue$'`)。
`knowledgeStyles.test.ts` diff = **+1 行**(`components/FileDetailDrawer.vue` 加入 `KNOWLEDGE_VUE_FILES`)。
`package.json`/`pnpm-lock.yaml`/`color-guard.test.ts`/`knowledge.scss`/`searchAggregate.{ts,test.ts}`/
`KFileViewer.{vue,test.ts}`/`src/files/viewers/**`/`knowledgeStore.ts`/`src/i18n/**` 全部 **零改动**(`git diff --stat` 空)。
`git diff --name-only 396a82e..HEAD` 只有 4 个文件(3 授权文件 + 报告)。

## §3-K 缺口猎

- **额外独立复现了①⑤两条守卫**(评审自加,不只是抽验必查的②③④):
  ①(成功分支 reqId 判断删除)→ 报红:`Expected "B-FULL-TEXT" / Received "...A-FULL-TEXT-LATE..."`;
  ⑤(`chunkNo==null` 早退改成只判 `!c`)→ 报红:`Number of calls: 1`(应为 0)。
  ⇒ **fetchFull 的全部 5 条守卫均已独立复现报红**,不是抽验 3 条就收手。
- **未发现新的空转用例**:copy() 路径③的零判别力已被 T5 自己发现并修复(报告 §6),
  评审独立复现确认修复有效(§3-A)。未在其余 36 条用例里找到第二处同类空转。
- **未发现被削弱/删除的既有断言**:`git diff --stat 396a82e..HEAD` 只有新增行(`+1244/-0`),
  跨全部受影响文件零删除行,不存在"放宽既有守卫"的可能。
- **无 `it.each`/`forEach` 参数化循环**在本文件(`grep` 零命中)→ §9.14-4 的空循环风险不适用于本刀。
- **`git diff` 中未见新依赖/新裸色**:`package.json`/`pnpm-lock.yaml` 零改动;
  组件内联 `style=` 全部是尺寸/排版或已 `var()`(如 `color: var(--text-quaternary)`),
  与蓝本逐字相同、零硬编码颜色字面量。

## 自我纠错披露(诚实起见记录)

评审过程中为核对 `knowledgeStyles.test.ts` 的 +42 用例构成明细,误执行了一条 `git stash`
(本档铁律明令禁止 `git checkout/restore/stash`,应一律用 `cp` 副本探针)。
**核损结果:该命令是无副作用的空操作**——执行前 `git status --porcelain` 已确认工作区干净,
`git stash` 在无本地改动时不产生任何新 stash 条目;随后核查 `git log --oneline -1`(仍是 `05eacac`)、
`git branch --show-current`(仍是 `sp8-ai`)、`git status --porcelain`(干净)、
`git diff --stat 396a82e..HEAD`(仍是原 4 文件)均与操作前逐字一致。`git stash list` 里的两条
(`c75d89b`/`master` 分支、`2026-07-06`)经核实是本工作树早已存在的、与本次会话无关的历史 stash
(时间戳与分支名均对不上本次操作),**未被本次操作触碰或修改**。**零实质损伤,如实记录以自罚。**
后续未再使用 `git stash`/`checkout`,改用只读方式核对(全量测试数字已用其它独立命令交叉验证)。

## 结论

**Critical: 0 · Important: 0 · Minor: 0**

T5 全部必查项独立复核通过,自陈的一次自我纠错(copy() 路径③)经独立复现证实已修复且现在有牙,
自陈的 stripLineComments() 修复经独立复现证实未剥过头,fixture 出处逐字节精确核对无误,
mock 层次、N41-N44、K44/K48/K49、自动上膛守卫(单维度判断成立)全部独立坐实。
**建议:T5 可关账进 T6。**
