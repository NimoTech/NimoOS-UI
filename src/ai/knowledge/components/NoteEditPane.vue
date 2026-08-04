<!--
  SP8-P5d Task 7 —— `NoteEditPane.vue` **上半**(顶栏 + 草稿横幅 + 主列编辑器)。
  1:1 移植自 Vue2 蓝本 `NimoOS-UI`(main@7a6ee6b7)
  `src/views/AI/Knowledge/NoteEditPane.vue`(338 行,`git show 7a6ee6b7:` 读取)。

  🔴 【范围边界 —— 计划书 §T7/§T8】本刀只写:顶栏(:7-22)· 草稿横幅(:25-32)·
  主列(:35-71:标题/描述输入 + kn-editor 工具栏 + rich/md 双模式 + 状态栏)。
  **侧栏 5 卡(:74-144)· 冲突弹窗(:148-180)及其渲染归 T8,本刀不写、不留占位符**——
  T8 会直接在 `.kn-edit` 关闭标签前插入 `<div class="kn-edit-aside">`,并在本文件
  模板根节点后追加冲突弹窗 `<div v-if="conflict" class="k-modal-bg">` 作为第二个
  fragment 根。本文件当前是合法的单根 `<div class="k-scroll">` 模板,T8 插入后会
  变成两根 fragment —— 这是刻意留的边界,不是缺陷。

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
      K41 的**另一半**,登记在 T8(计划书 §T8-1),本刀不建那两个接口 ——
      `backlinks` 在本刀里维持包原始的 `unknown[]`(见下方数据契约一节)。

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
  `notes.ts:247-250`)——本刀 `loadNote()` 会发它并存进 `backlinks` ref(维持包
  原始的 `unknown[]`,不在本刀声明 `Backlink` 接口,那是 T8 的 K41 另一半)。
  `service.notes.create`/`update`/`curate` 返回**单个 Note**(camelCase)。

  ═══ 缺口③(模板零裸色)═══
  本刀模板段(:7-71)零内联色字面量 —— 唯一一处内联色在蓝本 `:152`(冲突弹窗
  头图标底色,附录 B §B.4 第 35 行是权威映射),归 T8。本刀只需把
  `components/NoteEditPane.vue` 加进 `../../styles/knowledgeStyles.test.ts` 的
  `KNOWLEDGE_VUE_FILES` 集合(该文件的"守卫缺口③′"贪婪抽取整个 <template> 块
  做文本级正则扫描,天然覆盖本刀这段模板),不需要再补重复的定向断言。

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
-->
<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import type { Editor } from '@tiptap/vue-3'
import { service } from '@nimotech/nimoos-service'
import type { Note } from '@nimotech/nimoos-service'
import { useKnowledgeStore } from '../stores/knowledgeStore'
import { useToast } from '../../../stores/toast'
import KIcon from '../components/KIcon.vue'
import NotesMarkdownEditor from './NotesMarkdownEditor.vue'
import { parseTags, conflictMessage } from '../util/noteEditHelpers'

const props = defineProps<{ noteId: string }>()

const { t } = useI18n()
const router = useRouter()
const store = useKnowledgeStore()

const isNew = computed<boolean>(() => props.noteId === 'new')

/**
 * 蓝本 `data() { note: {} }`(:198)—— 初始为空对象而不是 `null`,与 Vue2 属性
 * 访问在字段缺失时返回 `undefined`(不抛错)完全对齐;用 `null` 反而要求全文
 * 到处加可选链,是本刀不做的无关改写。`isNew` 时永远不读它,`!isNew` 分支
 * 在 `loadNote()` 里被真实数据覆盖前不会被展示层依赖。
 */
const note = ref<Note>({} as Note)
/** K41 —— `service.notes.backlinks()` 返回 `unknown[]`(治理 §4.1 / K41 另一半
 * 归 T8),本刀只负责在 `loadNote()` 里把它取回来存好,不建 `Backlink` 接口、
 * 不在模板里消费(卡片渲染是 T8 的事)。 */
const backlinks = ref<unknown[]>([])

const saving = ref(false)
const tagInput = ref('')
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
      </div>
    </div>
  </div>
</template>
