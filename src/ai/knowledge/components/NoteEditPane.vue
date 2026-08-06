<!--
  SP8-P5d Task 7 —— `NoteEditPane.vue` **上半**(顶栏 + 草稿横幅 + 主列编辑器)。
  1:1 移植自 Vue2 蓝本 `NimoOS-UI`(main@7a6ee6b7)
  `src/views/AI/Knowledge/NoteEditPane.vue`(338 行,`git show 7a6ee6b7:` 读取)。

  🔴 【范围边界 —— 计划书 §T7/§T8,T8 已落地】T7(本节以上)写了:顶栏(:7-22)·
  草稿横幅(:25-32)· 主列(:35-71:标题/描述输入 + kn-editor 工具栏 + rich/md
  双模式 + 状态栏)。**T8(本次提交)补齐了侧栏 5 卡(:74-144)与冲突弹窗
  (:148-180)**,规格见文件尾新增的「═══ T8 ═══」大节。
  T8 在 `.kn-edit` 关闭标签前插入了 `<div class="kn-edit-aside">`;冲突弹窗
  (转 reka `DialogRoot`,见下方 T8 节)**逐字保持蓝本 `:148` 的原始嵌套**——
  是 `.k-scroll` 内、`.k-scroll-inner` **之后**的兄弟节点(蓝本 `:146-147`
  两处收窄标签之间),不是模板的第二个根。`DialogPortal to=".knowledge-app"`
  会把渲染结果**运行时**传送到别处,但这是 reka 的行为、不改变**源码**里的
  嵌套关系,本文件全程只有一个 `<template>` 根 `.k-scroll`。

  结构对照(蓝本行区间 → 本文件):
    :7-22    顶栏(返回列表 / 状态徽标 / 保存提示 / 保存按钮)
    :25-32   草稿横幅(N26 三段式拼接)
    :35-71   主列(标题/描述输入 · kn-editor 工具栏 8 个 kn-tb-btn · k-seg 双模式切换 ·
              rich(NotesMarkdownEditor)/md(textarea)· 状态栏字数统计)
    对应 script:props/data/isNew/status/wordCount/created()/onEditorReady/tbActive/
    cmd/save/curateInPlace,以及为 save() 成立而必须实现的 addTag()/openConflict()
    (见下方"任务切分判断"一节)。

  ═══ K41 类型收窄(治理 §3 / 本刀 DoD 1,登记「包侧类型 → 本仓收窄 + 字段依据」)═══
  包 `NimoOS-Service/src/notes.ts:21-34` 的 `Note` 接口:
    - `tags: unknown[]` → 消费侧一次性 `as string[]`(蓝本 `:215` 读
      `[...this.note.tags]` 直接当字符串数组展开,本仓 `loadNote()` 同样位置收窄)。
    - `body?: unknown` → 消费侧一次性 `as string | undefined`(蓝本 `:214` 读
      `this.note.body || ''`,同位置收窄)。
    - `revision?: number` / `status?: string` / `type?: string` 是 optional。
      本刀两处用**非空断言 `!`**(K34 同族,T6 `deleting.value!.id` 先例)而非新增
      默认值/防御分支 —— 断言零运行时行为,只在编译期消音,与 Vue2 未做任何校验的
      隐式假设逐字等价:
        · `loadNote()` 里 `form.type = n.type!`(蓝本 `:214` `type: this.note.type`
          没有任何兜底,直接赋值,undefined 时 Vue2 也会把 `undefined` 塞进
          `form.type`——非空断言不改变这个事实,只是让 TS 不再因为
          `string | undefined` 赋给 `string` 报错)。
        · `save()` 的 update 分支 `expectedRevision: note.value.revision!`
          (蓝本 `:285` `expectedRevision: this.note.revision`)——此分支只在
          `!isNew` 时执行,而 `note` 此刻必然是 `loadNote()` 里 `service.notes.get()`
          真实回包过的对象,`revision` 运行时必有值。
      🔴 禁 `as any`;上面两处都是**类型层**动作,零运行时校验、零行为改变,符合
      K41「若需要运行时校验才安全,那就不是 K41」的边界(这两处不需要运行时校验,
      故仍归 K41)。
      ⚠️ `status` 只经 `computed` 读出(不被赋值到更严格的类型),不需要断言。
      ⚠️ `sourceRefs`/`backlinks` 的类型收窄(`SourceRef`/`Backlink` 本地接口)是
      K41 的**另一半**,T7 提交时尚未建、**T8(本次提交)已补齐** —— 见文件尾
      新增「═══ T8 · K41 另一半 ═══」大节,字段依据引蓝本 `:128`/`:131`/`:132`/
      `:139`/`:141`。

  ═══ N29(本刀最容易被"顺手清理"的一行,不许删)═══
  `tbActive()` 里 `tbTick.value >= 0 &&` 是**故意的假依赖**(蓝本 `:228` 注释原文
  "tbTick makes this computed-on-demand check re-run on every transaction")——
  Vue3 的渲染 effect 会在求值时真正读到 `tbTick.value`,从而把这个 ref 记进依赖,
  `@transaction="tbTick++"` 每次触发都会让本方法重新求值,工具栏 `data-on` 高亮
  才会跟着编辑器的选区/格式状态刷新。删掉这半条,工具栏在切换粗体/标题等操作后
  永远不会更新高亮态。
  🔴 **裁定 R5**:附录 D §D.6.1 的 tiptap 可测性探针**没有挂载父组件**(只挂了
  `NotesMarkdownEditor` 这个编辑器 SFC 本身),因此"删掉 tbTick.value >= 0 && 会
  让工具栏 data-on 不刷新"这条因果链在 T0 阶段**没有被实证过**,本刀不许引 §D.6.1
  当已证,必须自己挂载 `NoteEditPane`(含真实 `NotesMarkdownEditor`)并附变异证据 ——
  见 `NoteEditPane.test.ts` 对应 describe 块与任务报告 §变异证据。

  ═══ K5/K30(不回显后端 e.message)═══
  蓝本全部 6 处 catch(`created`/`copyPath`/`curateInPlace`/`save`/`openConflict`/
  `copyMine`,后两个 copy* 归 T8)都是 `$t('Operation failed') + ': ' + (e.message
  || e)`。本仓按既定模具(P2a/P2b/P5b K19/P5c K30/P5d T6 K5)只弹固定文案
  `aiKbOpFailed`,不回显后端消息 —— **这是有意偏离,显式申报**。断言用排除式:
  toast 文本必须**不含**任何后端错误串。

  ═══ N27(四档三元嵌套,照抄不改)═══
  蓝本 `:17` 的四档三元嵌套(`saving ? Saving… : dirty ? Unsaved changes :
  isNew ? Not saved yet : Saved · rev {n}`)直接写在模板里,不抽成 computed 映射表
  (那会把"看哪个分支命中"的判定逻辑从一条可读的三元链变成一次对象查找,属于
  N17/N27 明令禁止的无关重构)。四档都有对应用例。

  ═══ N26(三段式拼接,照抄不改)═══
  蓝本 `:28` 的草稿横幅是三个独立键 + 中间加粗(`aiKbNeDraftBar1` <b>`aiKbNeDraftBar2`
  </b>`aiKbNeDraftBar3`),不合成一个带 HTML 的键(那要 v-html)、不用 i18n slot
  语法(蓝本没有)。

  ═══ N28(wordCount 正则,照抄不改)═══
  蓝本 `:207` 的 `/[#|\-*`>\s]/g` 照抄,把 `#`/`|`/`-`/`*`/反引号/`>`/空白全部剥掉
  再数长度 —— 不是真正的"字数",不"修正"成 markdown 感知的计数。

  ═══ 属性态 String() 照抄(P5b E-9 裁定,不改写)═══
  `data-on`(8 个 kn-tb-btn + k-seg 2 个按钮)与 `data-dirty` 全部套 `String(...)`
  (蓝本 `:15/43/44/45/47/48/50/51/52/55/56`)——套不套渲染一致,改写= 无关重构。
  测试断言 `toBe('true')`/`toBe('false')`,不用 `toBeUndefined()`。

  ═══ §5.2 过期守卫(K15 同族,本刀第 9 次)═══
  `loadNote()`(蓝本 created() 的等效)发两个请求(`get` + `backlinks`),用组件本地
  (非模块级!)的 `let loadEpoch` 判断"我还是最新那一发吗"。`:key="editingId"`
  (父组件 NotesView.vue:290)会在切换笔记时重建整个 NoteEditPane 实例,使"两实例
  交错"这个场景在本组件里格外真实(旧实例还在收尾迟到响应的同时,新实例已经
  发出了自己的首发请求)。判据:把 `loadEpoch` 挪到模块顶层,"两实例交错"用例
  必须报红。

  ═══ 任务切分判断(需要申报的两处,brief §"需要你自己判断并申报的地方")═══
  ① `addTag()`(蓝本 `:238-243`)—— brief 明确点名:`save()` 开头调用它
     (蓝本 `:273`),UI(标签输入框/焦点/删除)归 T8,但 brief 要求"你需要一个
     最小可用的 addTag(够 save() 的行为成立)"。**本刀选择:实现 addTag() 本体
     (非最小占位),因为它是纯逻辑(读 tagInput ref、写 form.tags 数组、
     parseTags 去重),不依赖任何 T8 才存在的 DOM ref 或方法。T8 只需要在
     侧栏补标签输入框的模板(:120-121,`v-model="tagInput"` /
     `@blur="addTag"`),不需要改动这个函数本体。**
  ② `openConflict()`(蓝本 `:302-309`)—— brief §3 的"不写"清单把它归进 T8 的
     script 列表,但计划书 T7 DoD 第 9 条明确要求 `save()` 的 catch 分岔
     "conflictMessage(e) && !isNew → openConflict()……本刀只到「conflict state
     被设上」"。这两句字面对不上:若 `openConflict` 完全不存在,`save()` 就无法
     达成"conflict state 被设上"这个可观察结果。**本刀判断:`openConflict()`
     与 `addTag()` 同族 —— 它是纯数据获取 + 状态设置(重新 `get()` 一次笔记、
     把 `conflict` ref 设为 `{latest, baseRevision}`),没有任何 DOM/UI 依赖,
     与"backlinks 的取数是本刀的事、卡片渲染才是 T8 的事"(治理 §4.1 明文)是
     完全相同的模式。本刀因此完整实现 openConflict(),T8 只需要在冲突弹窗模板里
     消费已经存在的 `conflict` 状态并接线三个按钮(adoptDisk/keepMine/copyMine,
     T8 DoD 5)。若协调者认为这个判断错了,`openConflict()` 的搬动/删除是一处
     T8 可以低成本调整的边界(它没有被 T7 自己的断言依赖,只被 save() 的一条
     "冲突态被设上"用例覆盖,后者断言的是 `conflict` 的值而不是这个函数名本身)。**

  ═══ 数据契约(mock 层次,治理 §4.1 / p5d-fixtures/README.md §2)═══
  `service.notes.get(id)` 返回**已归一化的单个 Note**(camelCase)。
  `service.notes.backlinks(id)` 返回**数组**,空时 `[]`(不是 `{backlinks:[]}` 信封,
  `notes.ts:247-250`)——T7 的 `loadNote()` 发它并存进 `backlinks` ref(维持包
  原始的 `unknown[]`,**T8 本刀零改动该 ref 声明**)。T8 在文件尾新增只读
  computed `sourceRefs`/`backlinkList` 做 K41 另一半的类型收窄消费,不改写
  `backlinks` 本身、不新增运行时校验。
  `service.notes.create`/`update`/`curate` 返回**单个 Note**(camelCase)。

  ═══ 缺口③(模板零裸色)═══
  T7 模板段(:7-71)零内联色字面量。**唯一一处内联色在蓝本 `:152`(冲突弹窗
  头图标底色,附录 B §B.4 第 35 行是权威映射)——T8(本次提交)已换成
  `var(--warning-soft)`**,见文件尾冲突弹窗模板。`components/NoteEditPane.vue`
  已在 T7 时加进 `../../styles/knowledgeStyles.test.ts` 的 `KNOWLEDGE_VUE_FILES`
  集合(该文件的"守卫缺口③′"贪婪抽取整个 <template> 块做文本级正则扫描,天然
  覆盖 T8 新增的这段模板),不需要再补重复的定向断言。

  ═══ 定位器策略(brief §4,T8 会在这个文件里插入内容,定位器要钉死)═══
  本刀所有测试定位器一律基于**结构唯一的 class 组合或父子链**,不依赖
  "文件里现在只有一个 X"这种隐含前提:
    · `.kn-edit-top` / `.kn-draftbar` / `.kn-edit-main` 三个顶层区块类名各自
      唯一(T8 插入的 `.kn-edit-aside` 是第四个同级兄弟,不会与前三者的选择器
      产生歧义);
    · 工具栏按钮统一用 `.kn-editor-toolbar .kn-tb-btn`(限定在工具栏容器内,
      不裸用 `.kn-tb-btn`,防止 T8 未来在别处引入同类名元素时误命中);
    · `.k-seg` 双模式切换按钮用 `.kn-editor-toolbar .k-seg button`(同一限定);
    · rich/md 容器分别用 `.kn-editor-body-wrap`(rich)与 `.kn-editor-src`
      (md,textarea 自身类名唯一)——两者 v-if/v-else 互斥,不会同时存在;
    · 顶栏保存按钮用 `.kn-edit-top .k-btn.primary`(限定在顶栏内,冲突弹窗
      的 `.k-btn.primary`——T8 新增——在 DOM 树的完全不同分支,不会被这个
      限定选择器命中)。
  这样即使 T8 往 `.kn-edit` 里插入 `.kn-edit-aside`(内含自己的 `.k-btn`/
  `.kn-aside-*` 等)、往模板根后追加冲突弹窗,本刀的定位器都不会被指向错误
  的元素,T8 不需要动本刀写的任何一条断言。

  ═══════════════════════════════════════════════════════════════════════
  ═══ T8 —— 下半(侧栏 5 卡 + 标签编辑 + 冲突弹窗),brief/计划书 §T8 ═══
  ═══════════════════════════════════════════════════════════════════════

  结构对照(蓝本行区间 → 本文件,本节新增):
    :74-90    状态卡(isNew:提示语;!isNew:三态徽标 + 来源 + 最后修改)
    :91-108   磁盘文件卡(isNew:提示语;!isNew:路径 + 提示 + 文件管理器/复制路径)
    :110-123  属性卡(类型下拉 + 标签编辑:chip / 删除 / 键盘事件 / 失焦提交)
    :125-135  来源卡(v-if !isNew && sourceRefs.length)
    :137-143  被引用卡(v-if !isNew && backlinkList.length)
    :148-180  冲突弹窗(转 reka DialogRoot,见下方 K36 一节)
  对应 script(本刀新增):`sourceRefs`/`backlinkList`(K41 另一半)/
  `focusTagInput`/`removeTag`/`onTagKey`/`refLabel`/`openRef`/`openSessionRef`/
  `revealFile`/`copyPath`/`copyMine`/`adoptDisk`/`keepMine`/`onConflictOpenChange`。
  🔴 **`addTag()`/`openConflict()` 已在 T7 落地(协调者裁定 R16 追认,brief §2),
  本刀不重复实现** —— 只在模板里接线(标签输入框 `@blur="addTag"`;冲突弹窗
  三个按钮消费既有的 `conflict` 状态)。

  ═══ K41 另一半(DoD-1,禁 `as any`)═══
  `Note.sourceRefs`(`NimoOS-Service/src/notes.ts:28`)与
  `service.notes.backlinks()`(`:247-250`)的返回值都是 `unknown[]`。本地接口:
    interface SourceRef { path?: string; session_id?: string; label?: string }
    interface Backlink { id: string; title: string }
  字段依据(逐条引蓝本行):`:128` 读 `r.path` · `:131` 读 `r.session_id` ·
  `:132` 经 `refLabel(r)` 读 `r.label` · `:139` 读 `b.id`(`:key="b.id"`)·
  `:141` 读 `b.title`。
  消费手法:`sourceRefs` 是新增 computed
  (`(note.value.sourceRefs as SourceRef[] | undefined) || []`——蓝本 `:206`
  自己的计算属性也是 `this.note.sourceRefs || []`,`|| []` 是 1:1 保留的蓝本
  防御写法,不是本刀新增的运行时校验);`backlinkList` 是新增 computed
  (`backlinks.value as Backlink[]`,**T7 的 `backlinks` ref 声明一字不改**)。
  两处都是类型层的一次性重断言,零运行时校验、零行为改变,符合 K41 边界
  (「若需要运行时校验才安全,那就不是 K41」不适用于这两处)。

  ═══ refLabel(r)(DoD-9,三种输入都要用例)═══
  蓝本 `:255`:`r.label || String(r.session_id || '').slice(0, 8)`——三档:
  ① 有 `label` 直接用;② 无 `label` 但有 `session_id`,取前 8 位;
  ③ 两者都没有,`String(undefined || '').slice(0, 8)` = `''`。

  ═══ 冲突弹窗三个动作(DoD-5,`dirty` 的值全部要断言)═══
  蓝本 `:316-323`(`adoptDisk`)/`:324-331`(`keepMine`)/`:310-315`(`copyMine`)
  逐字照抄语义:
    · `adoptDisk()`:`note = latest` + `form.body = latest.body || ''`(K41
      同族的 `unknown → string` 收窄写法,与 `loadNote()` 同一手法)+
      `conflict = null` + **`dirty = true`**。
    · `keepMine()`:蓝本 `:325` 注释原文「Rebase onto the disk revision so the
      next save overwrites it」——**只 rebase revision**
      (`note = {...note, revision: rev}`),**body 不动**,`conflict = null`,
      **`dirty = true`**,toast 带 `{n: rev}`。
    · `copyMine()`:`navigator.clipboard.writeText(form.body || '')`,成功
      toast `aiKbNeDraftCopied`。
  三者内部访问 `conflict.value!` 用非空断言(K34 同族,T6/T7 先例)——它们只在
  冲突弹窗渲染期间(`v-if="conflict"`)才可能被点击,`conflict.value` 此刻
  必然非空,与蓝本 `this.conflict.latest` 零防御的隐式假设逐字等价。

  ═══ 🔴 `navigator.clipboard` 在 HTTP-IP 下不存在(治理 §9.9,记忆
      `newui-clipboard-insecure-reka`)═══
  `copyPath()`/`copyMine()` 的 `navigator.clipboard.writeText(...)` 在本仓
  HTTP-IP 真机访问下 `navigator.clipboard` 是 `undefined`,调用同步抛
  `TypeError`,落进各自 `catch` 弹 `aiKbOpFailed`。**这是蓝本行为**(蓝本
  `:259-264`/`:310-315` 也只有裸 try/catch,零 `execCommand` 兜底)——按 N
  系列照抄,**不许**顺手加本仓 Files 区那套 `execCommand` 兜底(那是文件区的
  既有增强,不是笔记区蓝本行为)。**前端票(登记,交 P5e/P5f)**:「笔记区
  `copyPath`/`copyMine` 应复用本仓 Files 区既有的 `execCommand` 兜底,让 HTTP
  访问下也能真正复制成功,而不是弹『操作失败』」。验收清单需显式写明:「这
  两个按钮在 HTTP 访问下弹『操作失败』= 预期,不是缺陷」。

  ═══ 🔴 冲突弹窗转 reka(DoD-7,K7/K29/K36 同族,对齐 `SettingsView.vue`
      而非 `QueueView.vue`)═══
  蓝本 `:149` 是裸 `.k-modal-bg` + `@click`/`@click.stop`。T6 的删除确认弹窗
  (`NotesView.vue:418-452`)已转并核准跟 `SettingsView.vue:349-624` 的先例——
  **本弹窗蓝本 `:155` 本来就有可见标题 `.k-modal-title`**,K36 的既定选择是
  `<DialogTitle as-child>` 直接套在那个 div 上,不额外插入 `VisuallyHidden`
  隐藏节点(那是 `IndexedFilesView.vue` 无可见标题时的另一套先例,本弹窗不
  适用)。`DialogPortal to=".knowledge-app" defer`,结构照 `NotesView.vue:418-
  452` 抄:`DialogRoot :open="!!conflict" @update:open="onConflictOpenChange"`,
  `onConflictOpenChange(v) { if (!v) conflict.value = null }`(K29 同族——蓝本
  只有「点遮罩」「点 × 」两条关闭路径,没有独立的「取消」按钮,都收敛成这
  一句)。K36 a11y 常驻断言(`aria-labelledby` 与 `.k-modal-title` 的 `id`
  同值同元素 + 弹窗内恰好一个带 `id` 的元素)见 `NoteEditPane.test.ts`,变异
  证据见任务报告。

  ═══ §9.9 可点性(DoD-8,每个条件两侧都要用例)═══
  来源卡 `v-if="!isNew && sourceRefs.length"`;被引用卡
  `v-if="!isNew && backlinkList.length"`;磁盘文件卡的 `<template v-else>`
  (即 `!isNew`)。🔴 **fixtures 实测(README §4)**:本机 23 条笔记
  `source_refs` 每条都非空(`pipeline` 来源都带 `[{session_id}]`)→ 来源卡
  真机**会**渲染(治理原猜"手写笔记通常零 source_refs"对本机不成立);
  `backlinks` 端点本机恒 `[]` → 被引用卡真机**不**渲染,该条件的「有」那侧
  只能靠 mock 断言。

  ═══ 定位器加固(DoD-11,T7 评审预警的隐性脆弱点)═══
  T7 评审已指出:`.kn-badge[data-s="draft"]`/`[data-s="archived"]` 两条既有
  断言,在本刀插入状态卡(蓝本 `:82-84`,与顶栏 `:12-13` 同构同文案)后,
  `.find()` 会从「唯一命中」退化成「命中两个、`.find()` 巧合仍取到文档序
  第一个即顶栏那个」——测试仍绿但判别力已从「断言到确定元素」退化成「断言到
  文档序第一个且巧合同值的元素」。这两条断言按 brief §3 的要求**加固**(钉
  `.kn-edit-top` 祖先,不再依赖文档序),属于「被迫改动」,记在任务报告的
  「除 N 处外 T7 一字未动」一节,附加固前/后对照证据。除这 2 处外,
  `NoteEditPane.test.ts` 里 T7 写的其余全部断言本刀一字未动(本刀只新增
  describe 块,零删除、零修改既有 describe 内部)。
-->
<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { DialogRoot, DialogPortal, DialogOverlay, DialogContent, DialogTitle } from 'reka-ui'
import type { Editor } from '@tiptap/vue-3'
import { service } from '@nimotech/nimoos-service'
import type { Note } from '@nimotech/nimoos-service'
import { useKnowledgeStore } from '../stores/knowledgeStore'
import { useToast } from '../../../stores/toast'
import KIcon from '../components/KIcon.vue'
import NotesMarkdownEditor from './NotesMarkdownEditor.vue'
import { parseTags, conflictMessage } from '../util/noteEditHelpers'
import { NOTE_TYPES, noteSourceMeta, relativeTime } from '../util/notesViewHelpers'
import { openFileInNewTab, openAgentSessionInNewTab } from '../../services/openInApp'

const props = defineProps<{ noteId: string }>()

const { t } = useI18n()
const router = useRouter()
const store = useKnowledgeStore()

/** 蓝本 `methods: { sourceMeta: noteSourceMeta, timeAgo: relativeTime }`
 * (`:224-225`)——别名手法与 `NotesView.vue:108-109` 同一模具,模板里保持
 * 蓝本的调用名 `sourceMeta(...)`/`timeAgo(...)`。 */
const sourceMeta = noteSourceMeta
const timeAgo = relativeTime

const isNew = computed<boolean>(() => props.noteId === 'new')

/**
 * 蓝本 `data() { note: {} }`(:198)—— 初始为空对象而不是 `null`,与 Vue2 属性
 * 访问在字段缺失时返回 `undefined`(不抛错)完全对齐;用 `null` 反而要求全文
 * 到处加可选链,是本刀不做的无关改写。`isNew` 时永远不读它,`!isNew` 分支
 * 在 `loadNote()` 里被真实数据覆盖前不会被展示层依赖。
 */
const note = ref<Note>({} as Note)
/** K41 —— `service.notes.backlinks()` 返回 `unknown[]`(治理 §4.1)。T7 只在
 * `loadNote()` 里把它取回来存好,ref 声明本身**零改动**;T8 新增下方的
 * `backlinkList` computed 做 K41 另一半的类型收窄消费(卡片渲染),不改写
 * 这个 ref。 */
const backlinks = ref<unknown[]>([])

const saving = ref(false)
const tagInput = ref('')
/** 蓝本 `ref="tagInput"`(`:120`)—— Vue3 模板 ref,`focusTagInput()` 消费
 * (蓝本 `:237` `this.$refs.tagInput`)。 */
const tagInputEl = ref<HTMLInputElement | null>(null)
const mode = ref<'rich' | 'md'>('rich')
const dirty = ref(false)
/** 冲突态(蓝本 `:199` `conflict: null`,`:304-305` 赋值形状)。`baseRevision`
 * 保持与 `Note.revision` 一致的 `number | undefined`(K41:revision 本身就是
 * optional),渲染冲突弹窗时的兜底显示是 T8 的事,本刀不额外收窄。 */
const conflict = ref<{ latest: Note; baseRevision: number | undefined } | null>(null)
const editor = ref<Editor>()
const tbTick = ref(0)

const form = reactive({
  title: '',
  description: '',
  type: 'note',
  body: '',
  tags: [] as string[],
})

const status = computed<string | null | undefined>(() => (isNew.value ? null : note.value.status))

/** N28 —— 蓝本 `:207` 正则照抄,不"修正"成 markdown 感知的计数。 */
const wordCount = computed<number>(() => (form.body || '').replace(/[#|\-*`>\s]/g, '').length)

/**
 * K41 另一半(文件头「═══ T8 ═══」大节有完整登记)。字段依据:蓝本 `:128`
 * 读 `r.path`、`:131` 读 `r.session_id`、`:132` 经 `refLabel(r)` 读 `r.label`。
 */
interface SourceRef {
  path?: string
  session_id?: string
  label?: string
}
/** 蓝本 `:206` `sourceRefs() { return this.note.sourceRefs || [] }` 逐字照抄
 * (含 `|| []` 防御,note 初始为 `{}` 时 `sourceRefs` 运行时确为 `undefined`,
 * 尽管 `Note.sourceRefs` 的包类型是必有的 `unknown[]`)。 */
const sourceRefs = computed<SourceRef[]>(() => (note.value.sourceRefs as SourceRef[] | undefined) || [])

/**
 * K41 另一半。字段依据:蓝本 `:139` 读 `b.id`(`:key="b.id"`)、`:141` 读
 * `b.title`。`backlinks` ref 本身维持 T7 声明的 `unknown[]`,这里只做消费侧
 * 的一次性重断言,不改写 ref。
 */
interface Backlink {
  id: string
  title: string
}
const backlinkList = computed<Backlink[]>(() => backlinks.value as Backlink[])

function onEditorReady(ed: Editor): void {
  editor.value = ed
}

/**
 * N29 —— `tbTick.value >= 0 &&` 是故意的假依赖,不许删(见文件头注释)。
 * `!!(...)` 只是把最终返回值收窄成严格 `boolean`(TS 的函数签名要求),不改变
 * 短路顺序,也不改变任何可观察行为(蓝本原式在 `editor` 为空时求值到 `null`,
 * 经 `String(null)` 会是 `"null"`;但这一状态只存在于 `onEditorReady` 触发前的
 * 那一次同步渲染里,在任何等待过 `nextTick`/`flushPromises` 的观察点都已被
 * 之后的响应式重渲染覆盖成真实布尔值,与 Vue2 的实际可观察行为等价)。
 */
function tbActive(name: string, attrs?: Record<string, unknown>): boolean {
  return !!(tbTick.value >= 0 && editor.value && editor.value.isActive(name, attrs))
}

/**
 * 蓝本 `:231-236`:`chain[name](arg).run()` 按字符串动态派发到
 * `ChainedCommands` 的某个方法。`@tiptap/core` 的 `ChainedCommands` 接口没有
 * 索引签名,直接用字符串下标访问在 `strict` 模式下不成立 —— 用
 * `as unknown as Record<...>` 做一次结构性重断言(不是 `as any`),只影响这一次
 * 动态调用的类型可见性,不改变运行时行为。
 */
function cmd(name: string, arg?: Record<string, unknown>): void {
  if (!editor.value) return
  const chain = editor.value.chain().focus() as unknown as Record<
    string,
    (a?: Record<string, unknown>) => { run: () => void }
  >
  chain[name](arg).run()
  dirty.value = true
}

/**
 * 蓝本 `:238-243`。本刀实现本体(见文件头"任务切分判断"①)——`save()` 开头
 * 调用它(蓝本 `:273`),行为要成立:去重后追加到 `form.tags`,只有真的追加了
 * 才置 `dirty = true`。UI(标签输入框/删除按钮/键盘事件)归 T8。
 */
function addTag(): void {
  const parsed = parseTags(tagInput.value)
  const fresh = parsed.filter((tg) => !form.tags.includes(tg))
  if (fresh.length) {
    form.tags.push(...fresh)
    dirty.value = true
  }
  tagInput.value = ''
}

/** 蓝本 `:237`:`if (this.$refs.tagInput) this.$refs.tagInput.focus()`
 * ——Vue3 模板 ref 是 `HTMLInputElement | null`,可选链等价改写。 */
function focusTagInput(): void {
  tagInputEl.value?.focus()
}

/** 蓝本 `:244-247`。 */
function removeTag(tg: string): void {
  form.tags = form.tags.filter((x) => x !== tg)
  dirty.value = true
}

/**
 * 蓝本 `:248-254`(DoD-3,三条分支 + 一条反例):`Enter`/`,` → 阻止默认行为 +
 * `addTag()`;`Backspace` **且输入框为空且已有标签** → 弹掉最后一个 +
 * `dirty = true`。`Backspace` 但输入框非空 → 两条分支都不成立,什么都不做
 * (反例,不弹标签)。
 */
function onTagKey(e: KeyboardEvent): void {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault()
    addTag()
  }
  if (e.key === 'Backspace' && !tagInput.value && form.tags.length) {
    form.tags = form.tags.slice(0, -1)
    dirty.value = true
  }
}

/** 蓝本 `:255`(DoD-9,三种输入都要用例)。 */
function refLabel(r: SourceRef): string {
  return r.label || String(r.session_id || '').slice(0, 8)
}

/** 蓝本 `:256`。 */
function openRef(s: SourceRef): void {
  if (s.path) openFileInNewTab(s.path)
}

/** 蓝本 `:257`。 */
function openSessionRef(r: SourceRef): void {
  openAgentSessionInNewTab(r.session_id)
}

/** 蓝本 `:258`。 */
function revealFile(): void {
  if (note.value.path) openFileInNewTab(note.value.path)
}

/**
 * 蓝本 `:259-264`。🔴 `navigator.clipboard` 在 HTTP-IP 下不存在(见文件头
 * 「═══ T8 ═══」大节的 clipboard 一条)——真机会走 catch,按 N 系列照抄。
 */
async function copyPath(): Promise<void> {
  try {
    await navigator.clipboard.writeText(note.value.path || '')
    useToast().show(t('aiKbNePathCopied'), 2400)
  } catch {
    useToast().show(t('aiKbOpFailed'), 2400)
  }
}

/**
 * 蓝本 `:265-271`。K5:不回显 `e.message`,统一 `aiKbOpFailed`。
 */
async function curateInPlace(): Promise<void> {
  try {
    note.value = await service.notes.curate(props.noteId)
    useToast().show(t('aiKbNoteConfirmed'), 2400)
    store.refreshNotesDraftCount()
  } catch {
    useToast().show(t('aiKbOpFailed'), 2400)
  }
}

/**
 * 蓝本 `:302-309`。见文件头"任务切分判断"②:本刀实现本体,让 `save()` 的
 * catch 分岔能达成"conflict state 被设上"这个可观察结果。纯数据获取 +
 * 状态设置,零 UI 依赖。
 */
async function openConflict(): Promise<void> {
  try {
    const latest = await service.notes.get(props.noteId)
    conflict.value = { latest, baseRevision: note.value.revision }
  } catch {
    useToast().show(t('aiKbOpFailed'), 2400)
  }
}

/**
 * 蓝本 `:310-315`。🔴 clipboard 见文件头「═══ T8 ═══」大节,HTTP-IP 下真机
 * 会走 catch,按 N 系列照抄。
 */
async function copyMine(): Promise<void> {
  try {
    await navigator.clipboard.writeText(form.body || '')
    useToast().show(t('aiKbNeDraftCopied'), 2400)
  } catch {
    useToast().show(t('aiKbOpFailed'), 2400)
  }
}

/**
 * 蓝本 `:316-323`。只在冲突弹窗渲染期间(`v-if="conflict"`)可被点击,
 * `conflict.value!` 非空断言与蓝本 `this.conflict.latest` 零防御逐字等价
 * (K34 同族)。`form.body` 的 `unknown → string` 收窄手法与 `loadNote()` 同。
 */
function adoptDisk(): void {
  const latest = conflict.value!.latest
  note.value = latest
  form.body = (latest.body as string | undefined) || ''
  conflict.value = null
  dirty.value = true
  useToast().show(t('aiKbNeAdoptedDisk'), 2400)
}

/**
 * 蓝本 `:324-331`,注释原文「Rebase onto the disk revision so the next save
 * overwrites it」——只 rebase revision,**body 不动**。
 */
function keepMine(): void {
  const rev = conflict.value!.latest.revision
  note.value = { ...note.value, revision: rev }
  conflict.value = null
  dirty.value = true
  useToast().show(t('aiKbNeKeptMine', { n: rev }), 2400)
}

/** K29 同族(`NotesView.vue` 删除弹窗 / `SettingsView.vue:349-355` 既定手法)——
 * reka `DialogRoot` 的 `@update:open` 表达「弹窗被关掉了」,蓝本两条关闭路径
 * (点 × / 点遮罩,蓝本没有独立的「取消」按钮)都收敛成 `conflict = null`。 */
function onConflictOpenChange(v: boolean): void {
  if (!v) conflict.value = null
}

/**
 * 蓝本 `:272-301`。两条路:`isNew` → `create` + 路由带 `?id=`;否则 → `update`
 * (`expectedRevision` 用 K41 非空断言,见文件头)。catch 分岔:409 且非新建 →
 * `openConflict()`;否则 K5 固定文案。`addTag()` 在最开头被调用(蓝本 `:273`)——
 * 输入框里未提交的标签会被一并带上再保存。
 */
async function save(): Promise<void> {
  addTag()
  saving.value = true
  try {
    if (isNew.value) {
      const n = await service.notes.create({
        title: form.title,
        content: form.body,
        noteType: form.type,
        tags: form.tags,
        description: form.description,
      })
      dirty.value = false
      router.push('/ai/knowledge/notes?id=' + n.id)
    } else {
      note.value = await service.notes.update(props.noteId, {
        expectedRevision: note.value.revision!,
        content: form.body,
        title: form.title,
        tags: form.tags,
        description: form.description,
      })
      dirty.value = false
    }
    useToast().show(t('aiKbNeSaved'), 2400)
  } catch (e) {
    if (conflictMessage(e as Parameters<typeof conflictMessage>[0]) && !isNew.value) {
      await openConflict()
    } else {
      useToast().show(t('aiKbOpFailed'), 2400)
    }
  } finally {
    saving.value = false
  }
}

/**
 * 蓝本 `created()`(:209-222)的等效 —— §5.2 过期守卫(本刀第 9 次),
 * `loadEpoch` 声明在 `<script setup>` 函数体作用域内(组件实例级,非模块级),
 * 判据:挪到模块顶层后"两实例交错"用例必须报红(见 NoteEditPane.test.ts)。
 * 两发请求(`get` + `backlinks`)包在同一个 try 里,与蓝本一致 —— 若
 * `backlinks()` 失败,即使 `get()` 已成功也会落进同一个 catch(蓝本行为,不拆
 * 成两个独立 try)。
 */
let loadEpoch = 0

async function loadNote(): Promise<void> {
  const epoch = ++loadEpoch
  try {
    const n = await service.notes.get(props.noteId)
    if (epoch !== loadEpoch) return
    note.value = n
    form.title = n.title
    form.description = n.description
    form.type = n.type!
    form.body = ((n.body as string | undefined) || '')
    form.tags = [...(n.tags as string[])]

    const bl = await service.notes.backlinks(props.noteId)
    if (epoch !== loadEpoch) return
    backlinks.value = bl
  } catch {
    if (epoch !== loadEpoch) return
    useToast().show(t('aiKbOpFailed'), 2400)
    router.push('/ai/knowledge/notes')
  }
}

if (!isNew.value) loadNote()
</script>

<template>
  <div class="k-scroll">
    <div class="k-scroll-inner">
      <div class="kn-edit">
        <!-- top bar -->
        <div class="kn-edit-top">
          <button class="k-btn outline" @click="router.push('/ai/knowledge/notes')">
            <span style="transform: scaleX(-1); display: inline-flex"><KIcon name="chev" :size="12" /></span>
            {{ t('aiKbNeBackToList') }}
          </button>
          <span v-if="status === 'draft'" class="kn-badge" data-s="draft"><KIcon name="sparkle" :size="9" /> {{ t('aiKbAiDraft') }}</span>
          <span v-else-if="status === 'archived'" class="kn-badge" data-s="archived">{{ t('aiKbArchived') }}</span>
          <span class="spacer" />
          <span class="kn-savehint" :data-dirty="String(dirty)">
            <span class="dot" />
            {{ saving ? t('aiKbNeSaving') : dirty ? t('aiKbNeUnsaved') : isNew ? t('aiKbNeNotSavedYet') : t('aiKbNeSavedRev', { n: note.revision }) }}
          </span>
          <button class="k-btn primary" :disabled="saving || (isNew && !form.title.trim())" @click="save">
            <KIcon name="check" :size="12" /> {{ saving ? t('aiKbNeSaving') : t('aiKbNeSave') }}
          </button>
        </div>

        <!-- draft banner: confirm in place -->
        <div v-if="status === 'draft'" class="kn-draftbar">
          <KIcon name="sparkle" :size="16" color="var(--warning)" />
          <div class="kn-draftbar-txt">
            {{ t('aiKbNeDraftBar1') }} <b>{{ t('aiKbNeDraftBar2') }}</b>{{ t('aiKbNeDraftBar3') }}
            <div class="kn-draftbar-sub">{{ t('aiKbNeDraftBarSub') }}</div>
          </div>
          <button class="k-btn primary" @click="curateInPlace"><KIcon name="check" :size="12" /> {{ t('aiKbNeConfirmAsCurated') }}</button>
        </div>

        <!-- main column -->
        <div class="kn-edit-main">
          <div>
            <input class="kn-title-input" v-model="form.title" :placeholder="t('aiKbNeTitlePlaceholder')" @input="dirty = true" />
            <input class="kn-desc-input" v-model="form.description" :placeholder="t('aiKbNeDescPlaceholder')" @input="dirty = true" />
          </div>

          <div class="kn-editor">
            <div class="kn-editor-toolbar">
              <button class="kn-tb-btn" :disabled="mode !== 'rich'" :data-on="String(tbActive('bold'))" :title="t('aiKbNeBold')" @click="cmd('toggleBold')"><b>B</b></button>
              <button class="kn-tb-btn" :disabled="mode !== 'rich'" :data-on="String(tbActive('italic'))" :title="t('aiKbNeItalic')" @click="cmd('toggleItalic')"><i style="font-family: serif">I</i></button>
              <button class="kn-tb-btn" :disabled="mode !== 'rich'" :data-on="String(tbActive('strike'))" :title="t('aiKbNeStrike')" @click="cmd('toggleStrike')"><s>S</s></button>
              <span class="kn-tb-sep" />
              <button class="kn-tb-btn wide" :disabled="mode !== 'rich'" :data-on="String(tbActive('heading', { level: 2 }))" :title="t('aiKbNeH2')" @click="cmd('toggleHeading', { level: 2 })">H2</button>
              <button class="kn-tb-btn wide" :disabled="mode !== 'rich'" :data-on="String(tbActive('heading', { level: 3 }))" :title="t('aiKbNeH3')" @click="cmd('toggleHeading', { level: 3 })">H3</button>
              <span class="kn-tb-sep" />
              <button class="kn-tb-btn" :disabled="mode !== 'rich'" :data-on="String(tbActive('bulletList'))" :title="t('aiKbNeBulletList')" @click="cmd('toggleBulletList')"><KIcon name="layers" :size="13" /></button>
              <button class="kn-tb-btn" :disabled="mode !== 'rich'" :data-on="String(tbActive('blockquote'))" :title="t('aiKbNeQuote')" @click="cmd('toggleBlockquote')"><KIcon name="chev" :size="13" /></button>
              <button class="kn-tb-btn" :disabled="mode !== 'rich'" :data-on="String(tbActive('codeBlock'))" :title="t('aiKbNeCodeBlock')" @click="cmd('toggleCodeBlock')"><KIcon name="code" :size="13" /></button>
              <span style="flex: 1" />
              <div class="k-seg" style="margin-left: 6px">
                <button :data-on="String(mode === 'rich')" @click="mode = 'rich'">{{ t('aiKbNeRichText') }}</button>
                <button :data-on="String(mode === 'md')" @click="mode = 'md'">Markdown</button>
              </div>
            </div>
            <div v-if="mode === 'rich'" class="kn-editor-body-wrap">
              <NotesMarkdownEditor v-model="form.body" @input="dirty = true" @ready="onEditorReady" @transaction="tbTick++" />
            </div>
            <textarea v-else class="kn-editor-src" v-model="form.body" :placeholder="t('aiKbNeMdPlaceholder')" @input="dirty = true" />
            <div class="kn-editor-status">
              <span>{{ t('aiKbNeNChars', { n: wordCount }) }}</span>
              <span class="spacer" />
              <span style="font-family: var(--font-mono)">{{ mode === 'rich' ? 'WYSIWYG' : '.md source' }}</span>
            </div>
          </div>
        </div>

        <!-- aside (T8) -->
        <div class="kn-edit-aside">
          <div class="kn-aside-card">
            <div class="kn-aside-title">{{ t('aiKbStatus') }}</div>
            <div v-if="isNew" class="kn-kv">
              <KIcon name="edit" :size="13" color="var(--text-tertiary)" />{{ t('aiKbNeNewStatusHint') }}
            </div>
            <template v-else>
              <div class="kn-kv">
                <span v-if="status === 'draft'" class="kn-badge" data-s="draft"><KIcon name="sparkle" :size="9" /> {{ t('aiKbAiDraft') }}</span>
                <span v-else-if="status === 'archived'" class="kn-badge" data-s="archived">{{ t('aiKbArchived') }}</span>
                <span v-else class="kn-badge" data-s="curated"><KIcon name="check" :size="9" /> {{ t('aiKbCurated') }}</span>
              </div>
              <div class="kn-kv"><KIcon :name="sourceMeta(note.createdBy).icon" :size="13" color="var(--text-tertiary)" />{{ t('aiKbNeSource') }}: <b>{{ t(sourceMeta(note.createdBy).labelKey) }}</b></div>
              <div class="kn-kv"><KIcon name="clock" :size="13" color="var(--text-tertiary)" />{{ t('aiKbNeLastModified') }}: <b>{{ timeAgo(note.updatedAt) }}</b></div>
            </template>
          </div>

          <div class="kn-aside-card">
            <div class="kn-aside-title">{{ t('aiKbNeFileOnDisk') }}</div>
            <div v-if="isNew" class="kn-kv" style="font-size: 12px">
              <KIcon name="file" :size="13" color="var(--text-tertiary)" />{{ t('aiKbNeNewFileHint') }}
            </div>
            <template v-else>
              <div class="kn-filepath">{{ note.path }}</div>
              <div class="kn-kv" style="font-size: 11.5px; color: var(--text-tertiary)">{{ t('aiKbNeEditDirectHint') }}</div>
              <div class="kn-file-acts">
                <button class="k-btn outline" style="font-size: 12px; padding: 5px 10px" @click="revealFile">
                  <KIcon name="folder" :size="12" /> {{ t('aiKbNeFileManager') }}
                </button>
                <button class="k-btn ghost" style="font-size: 12px; padding: 5px 10px" @click="copyPath">
                  <KIcon name="copy" :size="12" /> {{ t('aiKbNeCopyPath') }}
                </button>
              </div>
            </template>
          </div>

          <div class="kn-aside-card">
            <div class="kn-aside-title">{{ t('aiKbNeProperties') }}</div>
            <select class="kn-aside-select" v-model="form.type" @change="dirty = true">
              <option v-for="(m, k) in NOTE_TYPES" :key="k" :value="k">{{ t(m.labelKey) }}</option>
            </select>
            <div class="kn-tagedit" @click="focusTagInput">
              <span v-for="tg in form.tags" :key="tg" class="kn-tagchip">
                {{ tg }}
                <button :title="t('aiKbNeRemoveTag')" @click.stop="removeTag(tg)"><KIcon name="x" :size="9" /></button>
              </span>
              <input
                ref="tagInputEl"
                :placeholder="form.tags.length ? '' : t('aiKbNeTagsPlaceholder')"
                v-model="tagInput"
                @keydown="onTagKey"
                @blur="addTag"
              />
            </div>
          </div>

          <div v-if="!isNew && sourceRefs.length" class="kn-aside-card">
            <div class="kn-aside-title">{{ t('aiKbNeSources') }}</div>
            <template v-for="(r, i) in sourceRefs" :key="i">
              <button v-if="r.path" class="kn-refbtn" :title="t('aiKbNeRevealFile')" @click="openRef(r)">
                <KIcon name="file" :size="13" /><span class="mono">{{ r.path }}</span><KIcon name="chev" :size="11" />
              </button>
              <button v-else-if="r.session_id" class="kn-refbtn" :title="t('aiKbNeOpenConversation')" @click="openSessionRef(r)">
                <KIcon name="bot" :size="13" /><span class="lbl">{{ t('aiKbNeSourceConversation') }} · {{ refLabel(r) }}</span><KIcon name="chev" :size="11" />
              </button>
            </template>
          </div>

          <div v-if="!isNew && backlinkList.length" class="kn-aside-card">
            <div class="kn-aside-title">{{ t('aiKbNeReferencedBy') }}</div>
            <button v-for="b in backlinkList" :key="b.id" class="kn-refbtn" @click="router.push('/ai/knowledge/notes?id=' + b.id)">
              <KIcon name="paperclip" :size="13" /><span class="lbl">{{ b.title }}</span><KIcon name="chev" :size="11" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 409 conflict: someone saved first (T8, reka Dialog 原语,见文件头「═══ T8 ═══」大节) -->
    <DialogRoot :open="!!conflict" @update:open="onConflictOpenChange">
      <DialogPortal to=".knowledge-app" defer>
        <DialogOverlay class="k-modal-bg">
          <DialogContent v-if="conflict" class="k-modal" style="width: min(560px, 100%)" :aria-describedby="undefined">
            <div class="k-modal-head">
              <span style="width: 30px; height: 30px; border-radius: 9px; background: var(--warning-soft); color: var(--warning); display: grid; place-items: center">
                <KIcon name="danger" :size="16" />
              </span>
              <DialogTitle as-child>
                <div class="k-modal-title">{{ t('aiKbNeConflictTitle') }}</div>
              </DialogTitle>
              <button class="k-modal-x" @click="conflict = null"><KIcon name="x" :size="13" /></button>
            </div>
            <div class="k-modal-body">
              <div style="font-size: 12.5px; color: var(--text-secondary); line-height: 1.6">
                {{ t('aiKbNeConflictBody') }}
              </div>
              <div class="kn-diff" style="margin-top: 10px">
                <div class="kn-diff-pane" data-side="theirs">
                  <div class="kn-diff-pane-head"><KIcon name="drive" :size="11" /> {{ t('aiKbNeConflictTheirs') }} · rev {{ conflict.latest.revision }}</div>
                  <div class="kn-diff-body">{{ conflict.latest.body }}</div>
                </div>
                <div class="kn-diff-pane" data-side="mine">
                  <div class="kn-diff-pane-head"><KIcon name="edit" :size="11" /> {{ t('aiKbNeConflictMine') }} · {{ t('aiKbNeBasedOnRev', { n: conflict.baseRevision }) }}</div>
                  <div class="kn-diff-body">{{ form.body }}</div>
                </div>
              </div>
            </div>
            <div class="k-modal-foot">
              <button class="k-btn text" @click="copyMine"><KIcon name="copy" :size="12" /> {{ t('aiKbNeCopyMyBody') }}</button>
              <span style="flex: 1" />
              <button class="k-btn outline" @click="adoptDisk">{{ t('aiKbNeUseDisk') }}</button>
              <button class="k-btn primary" @click="keepMine">{{ t('aiKbNeKeepMine') }}</button>
            </div>
          </DialogContent>
        </DialogOverlay>
      </DialogPortal>
    </DialogRoot>
  </div>
</template>
