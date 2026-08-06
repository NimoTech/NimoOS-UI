# P5d · T8 报告 —— `NoteEditPane.vue` 下半(侧栏 5 卡 + 标签编辑 + 冲突弹窗)

状态:**DONE**。起点 `sp8-ai@76dcd8b`(T0–T7 八刀已关账)。本刀改 2 文件:
`src/ai/knowledge/components/NoteEditPane.vue`(+410/-21)·
`src/ai/knowledge/components/NoteEditPane.test.ts`(+412/-2,含 2 处对既有断言的被迫改动)。
零新建文件,文件数仍 **331**。

## 0. R16/R16 遗留边界核实(brief §2)

`addTag()` 与 `openConflict()`(状态设置部分)已在 T7 落地(裁定 R16 追认),**本刀未重新实现**——
`git diff` 逐字确认这两个函数体一字未动。本刀只在模板里接线:标签输入框
`@blur="addTag"`;冲突弹窗三按钮消费既有 `conflict` 状态。
🔴 DoD-4 要求的「输入已存在标签 → dirty 不变」用例,核实 T7 **未覆盖**(T7 只测过
「未提交的新标签」路径,见 `save()` 前置调用测试),本刀补齐该用例(不改实现)。

## 1. DoD 1–11 逐条

1. **K41 另一半**:本地 `interface SourceRef { path?; session_id?; label? }` /
   `interface Backlink { id: string; title: string }`,字段依据引蓝本 `:128`/`:131`/`:132`/`:139`/`:141`
   (文件头「═══ T8 · K41 另一半 ═══」段 + 各函数上方逐条注释)。零 `as any`(`grep -n '\bany\b'` 只命中
   3 处**声明禁止**的注释文字,零实际用法)。
2. `backlinks` 返回数组、`backlinkList` computed 直接 `as Backlink[]`,不包一层信封;**T7 的 `backlinks`
   ref 声明一字未改**。
3. `onTagKey` 三分支 + 反例:4 条用例(Enter / `,` / Backspace-空-有标签 / Backspace-非空反例)。
4. `addTag()` 去重:新增 1 条用例(输入已存在标签 → `tags`/`dirty` 均不变),核实非重复实现。
5. 冲突弹窗三动作:`adoptDisk`(`note=latest`+`form.body=latest.body`+`dirty=true`+toast)·
   `keepMine`(只 rebase revision,body 不动,`dirty=true`,toast 带 `{n}`)·`copyMine`
   (`writeText(form.body)`)。三条各 1 用例,`dirty` 值均断言。
6. clipboard HTTP-IP:`copyPath`/`copyMine` 各 2 条用例(成功路径显式 `Object.defineProperty` 注入
   `navigator.clipboard`;catch 路径显式设为 `undefined`,与 jsdom/真机默认行为一致)。**未加
   `execCommand` 兜底**。前端票原文(已写入文件头「═══ T8 ═══」段):
   > 笔记区 `copyPath`/`copyMine` 应复用本仓 Files 区既有的 `execCommand` 兜底,让 HTTP 访问下也能真正
   > 复制成功,而不是弹『操作失败』。
7. 冲突弹窗转 reka:`DialogRoot`/`DialogPortal to=".knowledge-app" defer`/`DialogOverlay`/`DialogContent`/
   `DialogTitle as-child`(对齐 `SettingsView.vue:349-624` / `NotesView.vue:418-452` 先例,非
   `QueueView.vue` 无标题那套)。K36 a11y 常驻断言 + RED 变异证据见 §3。
8. §9.9 可点性两侧:状态卡(isNew/三态)、磁盘文件卡(isNew/!isNew)、来源卡(空/非空/isNew)、
   被引用卡(空/非空/isNew)——共 11 条相关用例。
9. `refLabel` 三档:直接 `wrapper.vm` 调用验证 3 种输入(有 label / 仅 session_id / 都没有),
   另有集成用例验证 session_id 分支的渲染文案。
10. 缺口③:蓝本 `:152` → `var(--warning-soft)`(附录 B §B.4 行 35),RED 探针见 §4。
11. 定位器加固:见 §2。

## 2. DoD-11 ——「除 2 处外 T7 一字未动」自证 + 加固对照

`git diff` 里对 T7 既有断言的**全部**改动只有以下 2 处(逐行贴 `-`/`+`):

```diff
-    expect(w.find('.kn-badge[data-s="draft"]').exists()).toBe(true)
+    expect(w.find('.kn-edit-top .kn-badge[data-s="draft"]').exists()).toBe(true)
```
```diff
-    expect(w.find('.kn-badge[data-s="archived"]').text()).toBe('已归档')
+    expect(w.find('.kn-edit-top .kn-badge[data-s="archived"]').text()).toBe('已归档')
```

**加固而非改弱对照**:加固前,`.kn-badge[data-s="draft"]` 在插入侧栏状态卡后会命中 2 个元素,
`.find()` 巧合返回文档序第一个(顶栏)、文案又相同,断言"仍绿但判别力已退化成'文档序第一个'"。
加固后钉 `.kn-edit-top` 祖先,新增的两条用例(`定位器加固(DoD-11)`describe 块)用程序化事实
**证明**加固前的隐患真实存在:

```ts
expect(w.findAll('.kn-badge[data-s="draft"]')).toHaveLength(2)               // 裸选择器确实命中 2 个
expect(w.findAll('.kn-edit-top .kn-badge[data-s="draft"]')).toHaveLength(1)  // 加固后精确命中顶栏那个
expect(w.findAll('.kn-edit-aside .kn-badge[data-s="draft"]')).toHaveLength(1)
```
archived 同理(`toHaveLength(2)` → 加固后 `toHaveLength(1)`)。除这 2 处 + 上述新增 describe 块外,
`NoteEditPane.test.ts` 里 T7 写的其余全部断言(30 条原始用例)本刀零删除、零修改,只在文件尾追加
新 describe 块(`git diff` 的其余 hunk 全部是纯新增)。

## 3. K36 a11y 变异证据(RED→GREEN,md5 逐字节自证,禁 `git checkout`)

- 备份 md5:`173b677139d9656a29c77e0fe13e6314`
- 注入:`<DialogTitle as-child>` → `<DialogTitle>`(去掉 `as-child`),python3 行首锚定替换,
  注入后 md5 `595867cf833fa354ef1831fd8ce21118`(证真落盘)
- 复跑 `-t "K36 a11y"`:
  ```
  AssertionError: expected '' to be 'reka-dialog-title-v-0'
  Tests 1 failed | 64 skipped (65)
  ```
  reka 的默认 `DialogTitle`(未 `as-child`)会渲染自己的元素并把 `id` 打在**那个**元素上,
  `.k-modal-title` div 变成子节点、自身无 `id` → `titleEl.id` 为空串,与 `aria-labelledby` 不同值。
- 还原:`cp` 备份覆盖,md5 复核 = `173b677139d9656a29c77e0fe13e6314`(与备份逐字节一致),
  复跑同一用例转绿,`git status --porcelain -- .../NoteEditPane.vue` 仍是预期的 `M`(无残留污染)。

## 4. 缺口③ RED 探针(蓝本 `:152` 内联色 → token)

- 备份 md5(第二次,还原后再次核实基线一致):`173b677139d9656a29c77e0fe13e6314`
- 注入:冲突弹窗头图标 `background: var(--warning-soft)` → `background: rgba(255,149,0,.14)`,
  注入后 md5 `f490b632465c21cffac01f95e5700326`
- 复跑 `knowledgeStyles.test.ts -t "零 hex"`:
  ```
  × components/NoteEditPane.vue —— 模板内(剥离 var()/color-mix() 后)零 hex / rgb / hsl 字面量
  AssertionError: 模板里有 rgb()/hsl() 函数色
  Tests 1 failed | 95 passed | 198 skipped (294)
  ```
  精确指名该文件,证明「守卫缺口③′」的贪婪模板扫描确实覆盖到 T8 新增的模板段(不只是 T7 段)。
- 还原:md5 复核 = `173b677139d9656a29c77e0fe13e6314`,复跑 `knowledgeStyles.test.ts` 全量
  `294 passed (294)`。

R17(`<script>` 块注释零色字面量)守卫本刀不需要新变异证据——T7 已对同一守卫做过完整 RED/GREEN
（NotesMarkdownEditor.vue 注入案例），本刀新增的全部文件头/函数级注释复跑该守卫仍 **13/13 全绿**
（`pnpm exec vitest run src/ai/styles/knowledgeStyles.test.ts -t "块注释"` → `13 passed | 281 skipped`），
证明本刀新写的申报注释（引蓝本 `:152` + 附录 B §B.4 第 35 行，不写色值）确实不触发该守卫。

## 5. mock 层次 / fixture 出处

- `NOTE_FIXTURE`:沿用 T7 已抄自 `notes-get-one.json` 的常量,零改动。
- `sourceRefs`/`backlinks` 的**非空**分支:README §4 记录本机 pipeline 笔记 `source_refs` 恒为
  `[{session_id}]` 形态(无 `path` 形态样本)、`backlinks` 端点恒 `[]`(无非空样本)。这两处按
  **K41 接口定义**(`SourceRef.path?` 依据蓝本 `:128`;`Backlink{id,title}` 依据蓝本 `:139`/`:141`)
  构造最小示例,测试注释里逐条声明「本机无真实抓取样本,不算手编信封」,信封层次仍是
  `service.notes.backlinks()` 已归一化数组(不是 `{backlinks:[]}`)。
- `service.notes.update` 409 冲突体沿用 T7 既有做法(`{response:{status:409,data:{current_revision}}}`)。

## 6. K/N 命中申报

**K41**(本刀完成另一半,§1 逐条)· **K34 同族**(`conflict.value!` 非空断言,冲突弹窗渲染期间必非空)·
**K29 同族**(`onConflictOpenChange`,对齐 `NotesView.vue`/`SettingsView.vue` 既定手法)·
**K36**(`DialogTitle as-child`,零 `VisuallyHidden`,对齐 `SettingsView.vue` 而非 `QueueView.vue`)·
**K7**(弹窗 portal 到 `.knowledge-app`,测试 `withHost()`)。
**N 系列纪律**(§9.9,非编号条目):`navigator.clipboard` HTTP-IP 下不存在按蓝本 `:259-264`/`:310-315`
裸 try/catch 照抄,不加本仓 Files 区的 `execCommand` 兜底。

## 7. 三门与算式

```
Test Files  331 passed (331)
     Tests  3958 passed (3958)
vue-tsc --noEmit  exit=0
vite build        exit=0
```
- 文件数:**331**(零新建,承 T7 收官值)。
- 用例数:**3923(T7 收官)+ 35(本刀新增)= 3958**。`NoteEditPane.test.ts` 由 30 → 65(单独复跑核实
  `65 passed (65)`)。
- `.vue` 计数、color-guard 计数**均不变**(本刀零新建 `.vue`)。

## 8. 提交前自查

```
$ git status --porcelain
 M src/ai/knowledge/components/NoteEditPane.test.ts
 M src/ai/knowledge/components/NoteEditPane.vue
```
与预期逐一对应,无多余改动。
