# P5d · T7 独立评审 —— `NoteEditPane.vue` 上半

评审范围:`review-ec0b3a6..ad2d600.diff`(HEAD `ad2d600`)。评审方法:自读全部产品/测试代码,
自跑三门 + 自跑变异(不采信实现者报告任何断言)。全程只读 `cp`+行首锚定注入+md5 逐字节自证还原,
未使用 `git checkout`/`restore`。

## 结论

1. **规格符合(§T7 DoD 1–11)**:✅ **符合**。11 条逐条核对(K41 收窄+登记、N29 假依赖+变异证据、
   N27 四档、N26 三段式、N28 正则边界(已用 node 离线独立复算 0/0/24,非从实现反推)、
   `String()` 全套 + 8 个 `.kn-tb-btn`(M-3 已实测=8)、§5.2 过期守卫双件事、`save()` 两条路 +
   `addTag()` 前置调用、K5 排除式 + 显式申报、`:disabled` 三/四种组合、缺口③ 模板零裸色)—— 全部
   在源码与测试里实证到位,非空转断言。
2. **任务质量**:✅ **通过**(有两处 Important 级发现,不构成阻塞,见下)。

## 🔴 第一必查项 —— 4/5 处既有断言改前→改后判定:**未改弱**

`NotesView.test.ts` 实际改动落在 3 个 `it` 块共 5 处 `.kn-edit-pane-stub` 引用(不是字面「4 条」,
用词口径差异,不影响结论):

| 位置 | 改前 | 改后 | 判定 |
|---|---|---|---|
| N30「切到另一条笔记」el1/el2 | 读占位 `data-note-id` 属性精确匹配 id | `expect(notes.get).toHaveBeenCalledWith('note-a'/'note-b')` + `.kn-edit-top` 做 DOM 身份对比(`el2 !== el1`) | **等价或更强**——从"读一个傀儡属性"变成"验证真实数据请求参数",判别力不降反升 |
| N30「id 变空」 | `.kn-edit-pane-stub` not-exists | `.kn-edit-top` not-exists | **纯选择器换名,语义 1:1** |
| 深链「挂载后改地址栏」 | `.kn-edit-pane-stub` 不存在(初始)+ 之后读 `data-note-id` 精确匹配 | `.kn-edit-top` 不存在(初始)+ 之后 `.kn-edit-top` 存在 + `notes.get` 被以该 id 调用 | **等价或更强**——拆成"渲染"与"参数正确性"两条独立断言 |

`git diff --stat`(自跑,非采信):`NotesView.test.ts` **31/9**、`NotesView.vue` **7/27**、
`knowledgeStyles.test.ts` **1/0** —— 与报告逐字一致。`NotesView.vue` 的唯一一个 hunk 只含
①头注释文案替换 ②`import` 摘 `defineComponent,h`+加真 import ③占位块删除,**其余逐行未动**(自读全 diff 确认,无第 4 处)。
自动上膛守卫(`NotesView.test.ts:674-708`)现场读取:`existsSync`=true 分支下 `hasRealImport===true`
且 `hasLocalPlaceholder===false`,两个 `expect` 真实求值(非空转)。

## 🔴 第二必查项 —— `openConflict()`/`addTag()` 越界判定

- **`addTag()`**:纯逻辑(`tagInput`/`form.tags`/`parseTags`),与蓝本 `:238-243` 逐字一致(已 diff 核对),
  无 T8 专属 DOM 依赖。**判定:不越界。**
- **`openConflict()`**:与蓝本 `:302-309` 逐字一致(已 diff 核对),纯 `get()`+状态赋值,模板里**没有**
  `v-if="conflict"` 弹窗标记(已读全部 431 行模板确认)。**判定:功能实现无 UI 越界**,但存在一处
  程序纪律瑕疵(见下方 Important #1):brief §3 明文把 `openConflict` 列入 T8「不写」script 清单且**未**
  像 `addTag` 一样给出「最小实现/申报/`NEEDS_CONTEXT`」的例外话术;plan.md §T8 的范围段落也把
  `openConflict` 列在 T8 自己的 script 清单里——与 T7 DoD-9 的措辞（"本刀只到 conflict state 被设上"）
  构成一处未被察觉/未被停下问的 brief-vs-plan 内部张力。实现者做出了合理判断且**完整、显著地申报**
  (文件头+报告 §4,并提供了"若判断有误,搬回 T8 成本很低"的兜底),不隐藏、不误导，故不判 Critical。
- **T8 接手时已存在、不应重复实现**:`addTag()`、`openConflict()`(状态设置部分)。T8 只需:
  ①在侧栏模板里接标签输入框 UI 并调用既有 `addTag`/新增 `removeTag`/`onTagKey`；
  ②在冲突弹窗模板里消费已存在的 `conflict` ref 并接 `adoptDisk`/`keepMine`/`copyMine` 三个新函数。
  T7 自己的断言只依赖 `conflict` 的**值**,不依赖 `openConflict` 这个函数名,T8 改名/重构此函数
  不会破坏 T7 测试。

## 🔴 自己跑的变异结果(逐条,md5 全程自证)

| 变异 | 注入前 md5 | 注入后现象 | 结果 |
|---|---|---|---|
| N29:删 `tbTick.value >= 0 &&` | `614bd1...c872`(与报告基线逐字一致) | 注入后 md5 `a10109f9...`(与报告逐字一致) | `AssertionError: expected 'false' to be 'true'` ✅ **报红**,还原后 md5 复核一致,`git status` 干净 |
| §5.2 挪模块级(新增独立 `<script lang="ts">` 导出 `loadEpochShared`,三处引用改指向它) | 同上 | 独立复现(手法与报告不同但语义相同) | `AssertionError: expected '' to be 'Title A'` ✅ **报红**,还原后 md5 复核一致 |
| K5:`save()` catch 拼回 `e.message` | 同上 | `useToast().show(t('aiKbOpFailed') + ': ' + (e.message\|\|e))` | ✅ **报红**(命中第一条 `toContain('操作失败')` 严格相等断言;第二条排除式断言在此形状下未被触发到,但对"追加一条独立 leak toast"这类变体仍有效——两条断言互补,非冗余,判定为无缺陷) |
| 缺口③:模板末尾插入 `<div style="color: #ff0000">` | 同上 | 触发 `knowledgeStyles.test.ts` 的 `KNOWLEDGE_VUE_FILES` it.each | ✅ **报红**(`模板里有裸 hex 色`),确认「只登记文件名、不用补定向断言」的申报成立 |

四次变异全部真实报红,还原后 `git status --porcelain` 均为空、HEAD 仍 `ad2d600`。

## N29 用例是否真挂父组件 + 真 tiptap(R5)

✅ **真挂**。`NoteEditPane.test.ts` 只 `vi.mock('@nimotech/nimoos-service')`,**未 mock** `NotesMarkdownEditor`;
`mount(NoteEditPane, …)` 是默认深度挂载(无 `shallow`),子组件 `NotesMarkdownEditor` 内部的真实
`@tiptap/vue-3` `Editor` 会被真实创建。测试里 `(w.vm as unknown as {editor?:Editor}).editor` 直接拿到的是
真实 `Editor` 实例(`ed!.chain().focus().toggleBold().run()` 能跑通并触发真实 `transaction`),不是
mock 对象。**这条链路确实补齐了 T0 §D.6.1 承认的空白**,不是"引用已证"。

## 给 T8 的预警 —— 插入下半后哪些 T7 断言会命中错元素

已读蓝本 `:74-90`(侧栏「状态卡」)确认:该卡在 `!isNew` 分支会渲染**自己的一份**
`.kn-badge[data-s="draft"/"archived"/"curated"]`(蓝本 `:82-84`,与顶栏 `:12-13` 的徽标同构、同文案)。
T7 现有两条用例:
- `w.find('.kn-badge[data-s="draft"]')`(created 等效测试)
- `w.find('.kn-badge[data-s="archived"]').text()`(status===archived 测试)

T8 插入 `.kn-edit-aside` 后,这两个选择器在 DOM 里将**从「唯一命中」变成「命中两个,取第一个」**——
因为 `.kn-edit-aside` 是 `.kn-edit` 的**最后一个子元素**(brief 原文「直接在 `.kn-edit` 关闭标签前插入」),
顶栏徽标仍排在文档序最前,`w.find()` 返回第一个匹配,**恰好还是顶栏那个**,文案又与侧栏那份逐字相同,
故**这两条用例在 T8 之后大概率仍会通过**,但判别力已经从"断言到确定元素"退化成"断言到文档序第一个
且巧合同值的元素"——**这是需要 T8 意识到但不必现在处理的隐性脆弱点**(若 T8 或未来某期改变卡片渲染顺序
把状态卡挪到 main 列之前,这两条会静默失去意义而非报红)。其余全部定位器(`.kn-edit-top .k-btn.primary`、
`.kn-draftbar .k-btn.primary`、`.kn-editor-toolbar .kn-tb-btn`、`.kn-editor-toolbar .k-seg button`、
`.kn-editor-body-wrap`/`.kn-editor-src`、`.kn-title-input`/`.kn-desc-input`/`.kn-savehint`/
`.kn-editor-status span`)均被限定在 T8 不会触碰的容器内,或结构上天然唯一,**不会**命中错元素。

## 代码膨胀判定(431 行)

蓝本对应段(模板 65 行+对应 script,压缩的 Options API)。本文件:注释头 **150 行**(1–150)、
script **208 行**(151–358,其中注释 55/空行 19,实际代码 ~134 行)、模板 **72 行**(360–431,
比蓝本 65 行多出的 7 行是既有 `.k-scroll`/`.k-scroll-inner` 包装层,本仓既定惯例,非本刀新增模式)。
逐行抽查未发现无理由的重复逻辑/死代码/过度抽象——膨胀来源可归因为
①按治理要求登记的 K41/N29/K5/定位器策略等大段申报注释(体量最大,~150 行头注释里近半是这类强制登记)
②Vue3 Composition API + 显式 TS 类型标注天然比 Vue2 Options API 冗长
③既有页面级容器惯例。**未发现"顺手重构/无关抽象"类可疑行。**

## ⚠️ 发现

- **Important** `src/ai/knowledge/components/NoteEditPane.vue:128` —— 申报注释里写了字面量
  `` `background: rgba(255,149,0,.14)` ``,违反 §0.3「注释里也不许出现色字面量」的硬约束
  (且两条颜色扫描均不剥注释,本应被扫到但两条守卫的扫描范围都只覆盖 `<style>`/`<template>`,
  该行位于 `<script setup>` 之前的文件头 HTML 注释块内,不落在任一扫描范围 —— 这是「产品代码
  对(其实是文档对)、守卫为零」同族的一个新盲区)。**非 T7 独创**:同款写法已存在于
  `src/ai/knowledge/views/NotesView.vue:56`(T6 产出,已过评审),故本处是沿用既有(有缺陷的)
  先例而非新引入,建议一并登记债务、由后续任一刀订正为「只引蓝本 file:line/附录 B 行号,不写字面量」。
  取证:`grep -nE "rgba\(|rgb\(|#[0-9a-fA-F]{3,8}" src/ai/knowledge/components/NoteEditPane.vue src/ai/knowledge/views/NotesView.vue`。
- **Important** `NoteEditPane.vue:105-117`(`openConflict()` 越界判断)—— brief §3 对 `openConflict`
  没有给予与 `addTag` 相同的「最小实现或 NEEDS_CONTEXT」话术,而是明确列入 T8「不写」清单;
  plan.md §T8 也把它列进 T8 自己的 script 清单。这是 brief/plan 之间一处未被识别、本该停下问的
  内部张力,实现者未写 `NEEDS_CONTEXT` 而是自行拍板(虽已充分申报、影响面小、易于挪动)。
  不影响功能正确性,记为流程纪律瑕疵。
- **Minor** `NoteEditPane.test.ts:446-456`(K5 非 409 错误用例)—— 变异证据显示该用例在
  "拼回 e.message" 场景下是通过第一条 `toContain('操作失败')`(严格相等)报红,而非专门设计用来
  抓这个缺陷的第二条排除式断言;两条断言语义互补(各自能抓住不同形状的回归),非冗余,不构成缺陷,
  仅记录供归档。
- **Minor** N29 的 `!!(...)` 包装(`tbActive()`)与蓝本在 `editor` 为 null 的**单帧同步渲染**内
  存在 `String(null)`("null") vs `String(false)`("false") 的字面差异,已在文件头显式论证「无可观察行为
  差异(等待过 nextTick/flushPromises 的观察点都已覆盖)」,判断成立,记录存档不算缺陷。
- **Minor** `note.value.revision!`(`save()` update 分支,K41 非空断言)—— 理论上若用户在
  `loadNote()` 的 `get()` resolve 之前点击 Save(该按钮此刻并未被任何 loading 态禁用),
  会把 `expectedRevision: undefined` 发给后端。此为**蓝本同款行为**(Vue2 `this.note.revision`
  同样无守卫),非本刀引入的新回归,已在文件头正确论证为「与 Vue2 隐式假设逐字等价」,判定 K41
  归类无误,不升级为 Critical。

## ⚠️ 无法核验项

- 未做真机可点性验收(§9.9 清单由 T10 之后协调者统一出),本评审只核了单测/类型/构建三门与源码。
- `pnpm exec sass` 编译门(`exit=0`)已自跑确认,但未与 T2/T4/T5/T6 各自的 scss 段做逐段级联复核
  (本刀零 scss 改动,不在其 DoD 范围内)。
