# P5d · T6 独立评审 —— `NotesView.vue`

评审者:T6 独立评审(只读)。范围 `f43f9ad..b89ff60`。全部探针本人亲自跑,详见下文。

## 0. 前置校验

- 三门独立复跑(不采信报告):`pnpm test` → `330 passed / 3874 passed`(exit 0,136s)· `vue-tsc --noEmit` → exit 0 ·
  `pnpm build` → exit 0。与报告称的数字**逐字一致**。
- 算式:329+1=330 文件 ✓;3839+35=3874 例 ✓(31 条 `NotesView.test.ts` + `color-guard`/`knowledgeStyles` 三个
  `it.each` 各 +1 = 35)。`.vue` 实测 **181** ✓。`knowledgeStyles.test.ts` diff 只加 1 行(`'views/NotesView.vue'`)✓。
  `grep ": any|<any>|as any"` 新文件零命中 ✓。收尾 `git status`/`HEAD` 干净,仍 `b89ff60` ✓。

## 1. 🔴 第一必查项 —— 产品代码里的临时占位子组件

1. **蓝本 vs 本刀**:蓝本 `:186` 静态 `import NoteEditPane from './NoteEditPane.vue'`;本刀在 `<script setup>`
   里用 `defineComponent + h()` 内联定义一个零逻辑占位组件顶替(`NotesView.vue:106-126`)。**这是偏离,已申报**——
   文件头注释(§「尚未存在 NoteEditPane.vue」)+ 内联块注释(`:106-119`)双重登记,符合"未申报即缺陷"的反面要求。
2. **🔴 T7 忘了替换会不会被发现:不会。** 全仓 `grep -rn "kn-edit-pane-stub|NoteEditPanePlaceholder|TODO(T7)"`
   除 `NotesView.vue`/`NotesView.test.ts` 外**零命中**——没有任何独立守卫/中央清单/机制钉子会在占位仍在时报红,
   也没有醒目的 `TODO(T7)` 标记(只有大段说明性注释,不是可被 grep 到的统一标记)。**判定:Important**——
   这正是本档反复出现的"产品代码对、守卫为零"家族,风险是"界面上编辑面板变成空白 div,三门全绿"。
3. **挂载点与 `:key` 1:1 核对**:`<NoteEditPane v-if="editingId" :key="editingId" :note-id="editingId" />`
   与蓝本 `:3` `<NoteEditPane v-if="editingId" :key="editingId" :note-id="editingId"/>` 逐字一致(属性顺序、条件均同)。✓
4. **占位组件本身零逻辑**:`setup(props){ return () => h('div',{class:'kn-edit-pane-stub','data-note-id':props.noteId}) }`
   ——只渲染一个打了 `data-note-id` 的 `div`,无状态、无副作用,确认零逻辑。✓

## 2. 我自己跑的探针(cp 备份 → 行首锚定注入 → md5 证落盘 → 运行 → cp 覆盖复原 → md5 比对,全程未用 `git checkout`)

| 探针 | 操作 | 结果 |
|---|---|---|
| §5.2-①(覆盖逻辑) | 删掉 `notes.value=list` 前的 `if(epoch!==reloadEpoch)return` | `① 交错` 用例精确报红(`expected [CURATED] to equal [DRAFT]`),`② 两实例交错` 仍绿(符合预期,该探针只测覆盖分支) |
| §5.2-②(模块级挪移) | 新增独立 `<script lang="ts">` 块 `export let reloadEpochShared=0`,setup 块内三处 `reloadEpoch`→`reloadEpochShared` | `② 两实例交错` 精确报红(`expected [] to equal [DRAFT]`,instance1 结果被 instance2 误判过期丢弃),`①` 仍绿 |
| 内联色(缺口③) | `NotesView.vue:374` token 换回 `'rgba(255,149,0,.14)'`(md5 `697610d8…`,与报告一致) | `knowledgeStyles.test.ts -t 模板内` 精确单独报红在 **`views/NotesView.vue`**(其余 12 个 `.vue` 全绿),证实该断言确实扫到 `:style` 对象字面量,不只是 `style="…"` 字符串 |
| 深链变异 | `editingId` 由 `computed` 改为 `ref`+`onMounted` 一次性读值 | `深链 ?id=` 用例精确报红(`Cannot call attributes on an empty DOMWrapper`——挂载后改路由不再驱动子组件出现),证明该用例有真实判别力 |

四次探针后逐一 `cp` 还原并 `md5sum` 核对(均恢复到 `b45f5007…`),收尾 `git status` 干净。

## 3. mock 形状 vs `p5d-fixtures/`

`NOTE_DRAFT`/`NOTE_CURATED`/`NOTE_ARCHIVED` 三条与 `notes-list-200.json` 里对应 id 的
`title/description/revision/updated_at/path/tags/source_refs` **逐字段核对一致**(本人用 `python3 -c json.load` 独立比对,
非采信报告)。仅 `status/type/created_by` 三字段被声明式手改(测试注释已注明,原因是真机 23 条全是 draft/insight/pipeline)。
`getSettings`/`remove` mock 形状与 `README §2`/`§3.1` 一致(`{notesRoot,autoExtract}` 两字段;`{status:'deleted',id}` 200)。
**结论:mock 逐字出自 fixtures,无手编裸信封。**

## 4. 代码膨胀判定(271 → 475,+204)

逐段来历核对(对照 `git -C NimoOS-UI show 7a6ee6b7:...NotesView.vue` 271 行原文):
- **+87**:文件头 HTML 注释(K1/K3/K5/K6/K15/K34/K41/N24/N25/N30/N31/占位声明/reka 申报)—— 全部是 K/N
  声明与蓝本行号引用,无自由发挥,**正当**。
- **+~21**:占位子组件(`:106-126`)—— 蓝本没有对应代码,**新增**,但已在 §1 单独判定为"已申报的偏离",不重复计缺陷。
- **+~10**:模板里 K7 reka Dialog 脚手架(`DialogRoot/DialogPortal/DialogOverlay/DialogContent/DialogTitle` 五层
  嵌套替换蓝本的裸 `<div class="k-modal-bg">`)—— 属既定 K7 家族增量,**正当**。
- **其余 +~86**:TS 类型标注(`ref<Note[]>`/`computed<Note[]>`/`Promise<void>`)+ Options→Composition 逐句改写
  (`data()`→`ref`、`methods`→函数)带来的样板增量,与 T1-T5 已确立的模式一致,**正当**。
- **未发现**蓝本没有的隐藏新逻辑、被"修正"的行为、或顺手抽的抽象。**判定:干净**,+204 全部可追溯。

## 5. §9.9 五条件覆盖

`drafts.length`(有/无)✓ · `notes.length`(空/非空)✓ · `filtered.length`(筛选空态/有结果)✓ ·
`n.status==='draft'`(draft 行有确认/curated·archived 行无)✓ · `n.status!=='archived'`(draft·curated 行有归档/
archived 行无,且 archived 行同时验两个条件都到反面)✓。**五条双侧全覆盖。**

## 6. 删除弹窗 reka 口径(供 T8 对齐)

`<DialogTitle as-child>` 直接套在蓝本自带的 `.k-modal-title` div 上、**不加 `VisuallyHidden`**——
本人核对 `SettingsView.vue`(有可见标题,同款 `as-child` 不加 VisuallyHidden)与 `QueueView.vue`
(蓝本无可见标题,用 `VisuallyHidden>DialogTitle` 另加隐藏节点)两个先例:**NotesView 属于"有可见标题"这一支,
用 `as-child` 是与 SettingsView 一致的正确选择**,不是与 QueueView 那支比较(那支场景不同)。结构
（`DialogPortal to=".knowledge-app"` + `DialogOverlay`/`DialogContent`）与两个先例一致。
**口径确立:T8 冲突弹窗若同样有可见标题,应照此(as-child,不加 VisuallyHidden)。**
⚠️ **唯一缺口**:`aria-labelledby` 与 `.k-modal-title` 的 `id` 同值同元素这条"K36 a11y 常驻断言"——
本刀**没有**补(只有 `IndexedFilesView.test.ts` 有此断言,`SettingsView.test.ts` 的同款缺口已由 T9 显式挂账)。
T6 的 DoD 1-11 未列出此项,不算越权缺失,但建议按 Minor 记录,免得又成第三个"该加没加"的账。

## 7. 缺口猎

未发现"只断言渲染成功不断言行为"的空壳用例;§5.2/深链两组用例均验证过判别力(见 §2 探针)。
未发现 Vue watch 去重坑——所有"变化触发/不触发"用例的前后值都确实不同(`''→'note-a'→'note-b'`、
`''→'some-note'→''` 等),不存在"回写同值导致 Object.is 前置去重"的隐患。

## 8. 两个独立判定

- **① 规格符合(§T6 DoD 1–11)**:✅ **符合**。K1 数据契约、§5.2 双判据、N30 两条、N24/N25/N31 照抄、
  K3/K6 静默兜底、深链响应式、§9.9 五条件、缺口③ token+断言,逐条核验通过。
- **② 任务质量**:**通过**,但挂 1 条 Important(见 §1-2)+ 1 条 Minor(见 §6)。

## 9. 缺陷清单

- **Important** —— `src/ai/knowledge/views/NotesView.vue:106-126`:T7 若忘记把本地占位组件换成真实
  `NoteEditPane.vue` import,**没有任何断言/中央清单会报红**(界面上编辑面板会静默变成空 `div`)。
  取证:`grep -rn "kn-edit-pane-stub|NoteEditPanePlaceholder|TODO(T7)" src/ | grep -v NotesView` → 零命中。
  建议:协调者在 T7 brief 里显式要求"删除本地占位组件定义 + 改真实 import"作为 DoD 一条,
  并让 `NotesView.test.ts`(或某中央清单)在占位组件类名仍被引用时报红。
- **Minor** —— `NotesView.vue:441-445` 删除弹窗缺 K36 a11y 常驻断言(`aria-labelledby` 与 `.k-modal-title`
  的 `id` 同值同元素),与 `IndexedFilesView.test.ts` 已有的同类断言不对齐;T6 DoD 未列出此项,不算超范围缺失,
  建议随 T9/T10 收尾一并补齐三个文件(SettingsView + NotesView + 若有的其它)。

## 10. 无法核验项

- 真机渲染效果(浏览器截图)未做——本刀只读评审禁止碰 dev server,已按指示只做 vitest/tsc/build 层面核验。
- reka `pointerDownOutside` 的 `setTimeout(0)` 时序依赖在 CI 环境的稳定性未做多次重跑验证(本人只跑了 1 次全绿)。
