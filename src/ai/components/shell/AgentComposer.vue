<!--
  SP8-P1c1 Task 9 —— AgentComposer 骨架:chips + textarea + 工具栏 + 发送/停止。
  1:1 移植自 Vue2 src/views/AI/Agent/shell/AgentComposer.vue(830 行)。本任务只做
  骨架:可见资源 chips(Vue2 5-17)、自增高 textarea(45-54)、工具栏行(56-113)、
  caption(127-129)。**不做**(留给 Task 10/11,接线处见下方注释):
    - 附件 chips(Vue2 18-42)、上传/删除管线(onFilesPicked/removeAttachment,
      Vue2 506-611)——`attachments` 数组在本任务里恒为空数组。
    - @mention 面板(MentionPopover)与 `/init` 斜杠面板(P1c1 补丁 Task 3 起为
      SlashPopover;初版移植的 SlashMenu 已被用户否掉并退役)——onInput 的
      mention 扫描(Vue2 306-334)、drillIn/pickItem/popSegment、onInit 均未接入。
    - Vue2 的 BrowserModal(浏览 NAS 弹窗)——本期用户决定延后,Browse 按钮改为
      toast 占位提示。
    - `activeSessionId` watcher(Vue2 275-281)——Vue2 里这个 watcher 同时做两件事
      (关闭 mention 面板 + 清空待附件列表),两者都属于下一任务范围,若本任务加上
      一个空 watcher 体只会是死代码,故整体挪到 Task 10。

  SP8-P1c1 Task 10 —— 附件管线(选择/上传/进度/文档错误/删除/清空)。
  1:1 移植自 Vue2 同文件:附件 chips 模板(18-42)、`attachments` data 形状
  (220-225)、`onFilesPicked`(506-602)、`removeAttachment`(604-611)、
  `chipTitle`/`docOkLabel`(488-504)、`attachmentHint`(234-244)、`submit()` 的
  附件半段(438-452)、`activeSessionId` watcher(275-281,本任务只清附件,
  `closeMention()` 调用点留给 Task 11 —— 见下方 watch 内注释)。

  SP8-P1c1 Task 11 —— @提及 + 斜杠命令接线 + gitignore 409 确认。
  1:1 移植自 Vue2 同文件:`onInput` 的斜杠/@ 扫描(300-335,纯文本数学已在
  Task 5 的 `composerText.ts` 里备好:`scanMention`/`buildDrillText`/
  `buildPopText`/`stripMentionToken`)、`onBlur`(343-346)、`closeMention`
  (347-352)、`drillIn`/`pickItem`/`popSegment`(355-428)、`onInit`
  (613-617)、`activeSessionId` watcher 的 `closeMention()` 调用点(275-281,
  Task 10 留的座)。MentionPopover 挂载(115-124)、SlashMenu 挂载(131-136)。
  **不移植** BrowserModal 挂载(138-142)——本期延后,Browse 按钮仍是占位 toast。

  SP8-P1c1 验收补丁 Task 3(2026-07-27,用户验收第 1 轮否掉全屏 SlashMenu)——
  退役上面 Task 11 挂的 `SlashMenu`(全屏遮罩+居中卡片+单选列表),换成
  `SlashPopover.vue`(与 MentionPopover 同款外壳,内联/锚定/↑↓/Enter/Tab/Esc/
  Backspace,两阶段 command→target)。这不是缺陷修复,是用户重新拍板的交互
  设计,故本期直接删除上一期自己写的组件(不受"删除一律推迟到 SP10"约束——那条
  铁律只管 Vue2 老仓,不管本期自己刚写、又被否掉的返工)。
  状态机(取代 Task 11 里 onInput 307-310 那条"整串只有一个 `/`"规则):
  `slashOpen`/`slashStage`/`slashQuery` 三个 ref 逐次 onInput(以及 Task 1 的
  focus/click 同步路径)重新推导——见 `deriveSlashState()`。新增
  `slashDismissedText`:记住上一次 Esc 关闭时的文本,避免 focus/click 把用户刚
  用 Esc 关掉的面板重新弹出来(只有文本变成不同的值才重开,见
  `onSlashPopClose()`)。`@`/`/` 两个面板互斥,由 `syncPanelsFromText()` 统一
  收口——斜杠推导赢的时候强制关掉提及面板,反之才走原有的 `syncMentionFromCaret()`。
  `onKeydown` 补一行 `if (slashOpen.value) return`(紧跟既有的
  `if (mentionOpen.value) return`,两者互斥所以顺序其实不敏感,但都必须在 Enter
  发送逻辑之前)。三个 emit(`pick-command`/`pick-target`/`back`,以及原生的
  `close`)分别对应 `onSlashPickCommand`/`onSlashPickTarget`/`onSlashBack`/
  `onSlashPopClose`,逐条对齐 brief「状态机」一节;`activeSessionId` watcher
  里追加清斜杠面板(回 command 阶段 + 清 dismiss 记忆),与已有的 `closeMention()`
  并列。

  Vue2 缺陷修复(项目 2026-07-27 移植纪律:逻辑跟正确性,不跟字面 1:1):
  (a) Vue2 onBlur 的 setTimeout 句柄从未存储/清理,组件卸载后仍可能触发—— 这里
      存进 `blurTimer` 并在 onBeforeUnmount 里 clearTimeout。
  (b) 见下方 pickItem 内注释——gitignore 409 确认框的 pending 状态用独立的
      open/target 两个 ref,而不是字面按 brief 描述"合并成一个 ref、在
      update:open 里清空"——原因见 pickItem 旁注释。
  (c) P1c1 验收补丁 Task 1(2026-07-27,用户验收反馈):Vue2 同文件 45-53 的
      textarea 没有 `@focus` 处理器——onBlur(343-346)180ms 后关闭面板,但没有
      任何路径在重新聚焦时重开它,于是切标签页/点别处再切回来,面板永久消失。
      这里新增 onFocus(先清挂起的 blurTimer 再按光标重开)+ onClick(点击移动
      光标进出 @ 词也要跟着开/关),两者共用新抽出的 syncMentionFromCaret()
      (原 onInput 里的扫描逻辑,一字未改,只是抽出复用)。见各自声明处注释。
  (d) P1c1 验收补丁 task 4(2026-07-27,用户复验第 2 轮,@ 仍未修好):Vue2
      shell/AgentComposer.vue:331(以及上面 (c) 抽出的 syncMentionFromCaret)
      靠 `scanMention` 从光标往前扫文字反推提及词,一遇空白就 `break` 判定
      `{open:false}`。NimoOS 挂载点显示名 `System (/DATA)` 既含空格又含斜杠,
      钻进去之后文本变成 `@System (/DATA)/.system_data/`——只要再触发一次这个
      扫描(下一次按键、blur→focus,甚至 drillIn 自己 nextTick 里 el.focus()
      顺带触发的 onFocus),往前扫到空格就直接放弃,面板从此再也开不回来。
      改法:`composerText.ts` 新增 `mentionPrefix`/`parseActiveMention` 两个纯
      函数(纯切片比较,不逐字符扫描);`syncMentionFromCaret` 改两级判定——已
      钻取过至少一层(`mentionSegs.length>0`)时优先信任记录的 segments/start,
      只有还没钻取时才继续用 `scanMention` 发现新词。同时把原来的
      `closeMention()` 拆成 `hideMentionPanel()`(只隐藏,onBlur 用)与
      `resetMention()`(全量重置,Esc/选中/发送/切会话/清空文本各处用)——失焦
      不再销毁已钻取的层级,真正结束时才重置。逐条改动理由见
      `syncMentionFromCaret`/`hideMentionPanel`/`resetMention` 声明处注释,以及
      `.superpowers/sdd/p1c1-patch-task-4-brief.md`。

  gitignore 409 确认(本期唯一有意的交互偏离):Vue2 用阻塞的 `window.confirm`
  (Vue2 398、630),这里改用仓库的 reka-ui `AlertDialog`。注意 AlertDialog 走
  `DialogPortal`,渲染在 `.agent-app` 子树之外,`.agent-app` 的 token 不对它生效
  ——这是既有约定(AgentSidebar 的删除确认已是同样处境),不是本任务引入的新问题。

  P1c1 补丁验收第 2 轮 Task 5(2026-07-27,评审第 2 轮 Item A + Item B)——

  Item A:@ 面板缺一层 Esc 关闭记忆,与斜杠面板的 `slashDismissedText`/
  `openSlashIfNotDismissed` 不对称。缺陷复现:type '@doc' → MentionPopover 的
  Esc(`close`)关闭面板 → 点回 textarea → onFocus → syncMentionFromCaret →
  scanMention 重新发现同一个 `@doc` token → 面板不请自开。之前看起来"已经修好"
  只是因为已有测试恰好用了含空格的挂载点名(`scanMention` 遇空格必然发现失败,
  与这层记忆无关,纯属巧合掩盖)。修法:新增 `mentionDismissedText` ref + 新增
  `openMentionIfNotDismissed()` 助手,逐字镜像斜杠那一套的形状/命名。写入点是
  `onMentionPopClose()`(替换原来直接绑 `resetMention` 的 `@close`);读取点是
  `syncMentionFromCaret()` 的两个分支(状态优先的 parseActiveMention、发现式的
  scanMention)都要过这一关;清空点收口在 `resetMention()` 里(select/submit/
  session-switch/清空文本各处全量重置路径统一清掉,保证这层记忆绝不会永久卡死
  面板)。**Vue2 同文件没有这层机制**——Vue2 从来没有过这个"Esc 后 focus 不复活"
  的行为,这是本仓库自己发现并修的缺陷,不是移植缺项。项目 2026-07-27 移植纪律:
  UI 与 Vue2 1:1,但逻辑跟正确性,不跟字面一致。逐条改动理由见
  `mentionDismissedText`/`openMentionIfNotDismissed`/`onMentionPopClose` 声明处
  注释。

  Item B(评审提出的疑点,已用组件测试验证并钉住,非臆测):`drillIn()` 的
  `nextTick(() => { el.focus(); el.setSelectionRange(caretPos, caretPos); grow() })`
  原来的顺序在 token 后面还跟着别的文字时(例如 `@Dr tail` 钻成
  `@Drive1/ tail`)是不安全的——`el.focus()` 会同步再入 `onFocus` →
  `syncMentionFromCaret`,而此时 `setSelectionRange` 还没执行,读到的
  `el.selectionStart` 是 textarea `.value` 刚被整体替换后浏览器原生落在的
  字符串末尾,于是把尾部文字当成了 mentionQuery。改法:调换成先
  `setSelectionRange` 再 `focus()`——前者不要求元素已经 focus,后者也不会重置
  已经存在的 selection,顺序调换即可修好,见 `drillIn` 声明处注释。
-->
<script setup lang="ts">
import { ref, reactive, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import AgentIcon from '../icons/AgentIcon.vue'
import KindIcon from './KindIcon.vue'
import ContextUsageBar from '../blocks/ContextUsageBar.vue'
import MentionPopover from './MentionPopover.vue'
import SlashPopover from './SlashPopover.vue'
import AlertDialog from '../../../components/ui/AlertDialog.vue'
import { useProvidedAgentStore } from '../../composables/useProvidedAgentStore'
import { useToast } from '../../../stores/toast'
import {
  getExt, basename, dirname, scanMention, buildDrillText, buildPopText, stripMentionToken,
  parseActiveMention,
} from '../../util/composerText'
import { ACCEPT_TYPES, MAX_ATTACHMENT_BYTES, TEXT_EXTS, docErrorKey, docErrorShortKey } from '../../util/attachmentMeta'

const props = withDefaults(
  defineProps<{ busy?: boolean; ctxUsage?: { tokens: number; window: number; pct: number } | null }>(),
  { busy: false, ctxUsage: null },
)

/** Task 10 Interfaces 段:submit() 的 attachmentRefs 单项形状(逐字取自 brief)。 */
interface AttachmentRef {
  id: string
  filename: string
  kind?: string
  mime?: string
  url: string
}

// 三个 emit 名与 payload 形状是 Task 12 接线契约,不可改
// (p1c1-task-9-brief.md Interfaces 段)。`send-init` 本任务无调用方
// (SlashMenu/onInit 是 Task 11 的事),这里先声明接口占位。
const emit = defineEmits<{
  send: [payload: { text: string; attachmentIds: string[]; attachmentRefs: AttachmentRef[] }]
  stop: []
  'send-init': [target: string]
}>()

const { t } = useI18n()
const store = useProvidedAgentStore()
const toast = useToast()

/**
 * Task 10 Interfaces 段:本地 pending 附件列表项形状(仅组件内部,不外泄)。
 * Vue2 220-225 `attachments` data 的逐字对齐:
 *   docError: kind=document 时 backend 的 extract_error 码;成功时 undefined。
 *   docMeta:  document 成功抽取时的 { extractor, pages, truncated }。
 */
interface PendingAttachment {
  tmpId: string
  file: File
  status: 'uploading' | 'uploaded' | 'failed'
  progress: number
  aid?: string
  kind?: string
  mime?: string
  error?: string
  docError?: string
  docMeta?: { extractor?: string; pages?: number; truncated?: boolean }
}

const text = ref('')
const composerEl = ref<HTMLElement | null>(null)
const ta = ref<HTMLTextAreaElement | null>(null)
const attachFileInput = ref<HTMLInputElement | null>(null)
// Vue2 295-299 anchorRect: 供 MentionPopover 定位,面板本身留 Task 11,这里先把
// 计算+resize 联动的骨架搭好,不留半截状态。
const anchorRect = ref<DOMRect | null>(null)
// Vue2 219-225 attachments data —— 本地 pending 附件列表(浏览器已选、正在/已
// 上传的文件),与 store.attachments(右侧面板的服务端列表)是两回事,互不干扰。
const attachments = ref<PendingAttachment[]>([])

// Vue2 210-216 mention picker / slash menu data。
const mentionOpen = ref(false)
const mentionStart = ref(-1)
const mentionSegs = ref<string[]>([])
const mentionQuery = ref('')
// P1c1 补丁 Task 3 —— SlashPopover 驱动状态(取代 Task 11 那个只会整串一个 '/'
// 就弹、敲第二个字就失效的 slashOpen 单变量)。见文件头「SP8-P1c1 验收补丁
// Task 3」一节的状态机总述,以及 deriveSlashState() 声明处的逐条注释。
const slashOpen = ref(false)
const slashStage = ref<'command' | 'target'>('command')
const slashQuery = ref('')
// Esc(command 阶段的 close 事件)关闭时记下当时的文本;只要文本没变,
// focus/click 的重新同步都不应把面板复活——见 deriveSlashState() 里
// openSlashIfNotDismissed() 的用法。文本被清空或首字符不再是 '/' 时清掉。
const slashDismissedText = ref<string | null>(null)
// P1c1 补丁验收第 2 轮 Task 5 Item A(2026-07-27)—— @ 面板的对称记忆,镜像上面
// `slashDismissedText`/`openSlashIfNotDismissed` 的写法。缺陷复现:type '@doc' →
// MentionPopover 的 Esc(`close`)关闭面板 → 点回 textarea → onFocus →
// syncMentionFromCaret → scanMention 重新发现同一个 `@doc` token → 面板不请自开。
// 斜杠面板早有这层记忆,@ 面板一直没有——本来就该对称,属于遗漏而非有意不做。
// 写入点:`onMentionPopClose()`(MentionPopover `@close`,即 Esc)。
// 读取点:`openMentionIfNotDismissed()`,`syncMentionFromCaret()` 的两个分支
// (状态优先的 parseActiveMention 分支、以及发现式的 scanMention 分支)都要过这一关
// ——见 `openMentionIfNotDismissed` 声明处注释,为什么两个分支都要挡。
// 清空点:`resetMention()`(select/submit/session-switch/清空文本各处收口的地方)
// 统一清掉,保证这层记忆绝不会永久卡死面板;`onMentionPopClose()`自己也调用
// `resetMention()`,所以要在调用之后再写入记忆(否则前脚清、后脚被自己清空)。
// Vue2 同文件没有这层记忆(Vue2 从来没修过这个 bug,这是本仓库自己发现的缺陷)——
// 项目 2026-07-27 移植纪律:UI 与 Vue2 1:1,但逻辑跟正确性,不跟字面一致。
const mentionDismissedText = ref<string | null>(null)
// Vue2 缺陷修复 (a)(见文件头注释):onBlur 的 setTimeout 句柄要能在
// onBeforeUnmount 里清掉,Vue2 从未存储这个句柄。
const blurTimer = ref<ReturnType<typeof setTimeout> | null>(null)

/**
 * gitignore 409 确认框的 pending 状态。**没有**按 brief 字面描述合并成单个
 * `ref<{path,kind}|null>` 并在 `update:open===false` 里清空——那样做会撞上
 * 本仓库已经踩过、并在 AgentSidebar.vue/SourcesPage.vue 里明确写了注释的 reka
 * 时序坑:`AlertDialogAction` 点击时,`update:open(false)` 先于我们自己的
 * `@confirm` 处理器派发,如果 pending 数据被 update:open 的回调清空,
 * onGitignoreConfirm 读到的就已经是 null。这里照搬那两处的既有写法——open 用
 * 独立的 bool,pending 数据只在 confirm 处理器里读完之后才清,cancel/Escape
 * 路径下 pending 短暂过期不刷新也无害(下次 pickItem 命中 409 会整体覆盖)。
 */
const gitignoreOpen = ref(false)
const gitignoreTarget = ref<{ path: string; kind: string } | null>(null)

const placeholder = computed(() => t('aiComposerPlaceholder'))
const acceptTypes = ACCEPT_TYPES

/**
 * Vue2 234-244 attachmentHint()。**有意偏离**:Vue2 用 Buefy `<b-tooltip
 * multilined>` 展示这 7 行提示;本仓库无 Buefy,改用原生 `title` 属性 + `\n`
 * 拼接七行(见模板里 attach 按钮的 title 绑定)。
 */
const attachmentHint = computed(() =>
  [
    t('aiAttachHint1'),
    t('aiAttachHint2'),
    t('aiAttachHint3'),
    t('aiAttachHint4'),
    '· ' + t('aiAttachHint5') + ' ' + TEXT_EXTS.join(' '),
    t('aiAttachHint6'),
    t('aiAttachHint7'),
  ].join('\n'),
)

/** Vue2 289-294 grow() —— 逐字对齐(min(scrollHeight, 220))。 */
function grow() {
  const el = ta.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 220) + 'px'
}

/** Vue2 295-299 updateAnchor()。 */
function updateAnchor() {
  if (composerEl.value) anchorRect.value = composerEl.value.getBoundingClientRect()
}

/**
 * P1c1 验收补丁 task 4(2026-07-27,用户复验第 2 轮):把 @ 提及词从"每次都从
 * 文字反推"改成"状态优先,文字只用来发现新词/取筛选词"。
 *
 * 根因(见 p1c1-patch-task-4-brief.md「根因」一节,读代码定死非猜测):
 * `scanMention`(composerText.ts:48-67,对应 Vue2 shell/AgentComposer.vue:331 的
 * 同款注释"mention 路径不含空格")是从光标往前扫的发现式算法,一遇空白就
 * `break` 判定 `{open:false}`。NimoOS 的挂载点显示名 `System (/DATA)` 既含空格
 * 又含斜杠——钻进去之后文本变成 `@System (/DATA)/.system_data/`,只要再触发一次
 * 这个函数(下一次按键、blur→focus,甚至 drillIn 自己 nextTick 里 `el.focus()`
 * 顺带触发的 onFocus——用真实交互写组件测试时意外证实了这一点),往前扫到空格
 * 就直接放弃,面板从此再也开不回来。
 *
 * 修法:`mentionSegs`(层级)由 `drillIn`/`popSegment` 写入,是权威值,永不从文字
 * 反推。只要已经钻过至少一层(`mentionSegs.value.length > 0`),就用
 * `parseActiveMention` 按"记录的前缀是否仍是当前文本这一段"做一次纯切片比较
 * (不逐字符扫描,天然不受嵌入的空格/斜杠影响),命中就直接复用/更新
 * `mentionQuery`,**不再跑 `scanMention`**。
 *
 * 没有 gate 在 `mentionSegs.value.length > 0` 上不行:`mentionPrefix([])` 只是
 * 裸的 `'@'`,如果对"尚未钻取过、只是刚敲了 `@xxx` 还没选任何层级"的状态也无条件
 * 信任 `parseActiveMention`,那么这个前缀会对任何后续文本都判定"仍然成立"
 * (只要 caret 在 `@` 之后),包括用户敲空格结束这次提及的场景——这会让
 * `AgentComposer @提及 / 斜杠`(Task 11)"输入空格后关闭"那条既有用例失败。
 * 尚未钻取时"逐字符发现"本来就是安全的(还没有可能包含空格的挂载点名混进
 * 状态),所以这条路径继续交给 `scanMention` 重新发现——两段判定合起来才是
 * brief「组件改造」步骤 2 说的"两级判定"。
 */
/**
 * P1c1 补丁验收第 2 轮 Task 5 Item A —— 镜像 `openSlashIfNotDismissed()`:只有
 * 当前文本与 `mentionDismissedText`(上一次 Esc 关闭时的文本)不同,才真的打开;
 * 否则保持关闭。`syncMentionFromCaret()` 的两个分支(状态优先的
 * parseActiveMention、发现式的 scanMention)都经过这里,不会各写一份判断而漂移
 * ——两个分支都要挡是因为：即使 `resetMention()`(Esc 关闭路径的一部分)已经把
 * `mentionSegs` 清空、下一次几乎总是落进 scanMention 分支重新发现同一个 token,
 * 但这条记忆检查本身不依赖"哪个分支发现的",两个分支都可能在文本不变时重新算出
 * 同一个 start/segments/query,必须在两处都拦，不能只信任其中一条调用路径。
 */
function openMentionIfNotDismissed(v: string, start: number, segs: string[], query: string) {
  if (mentionDismissedText.value !== null && mentionDismissedText.value === v) {
    mentionOpen.value = false
    return
  }
  mentionStart.value = start
  mentionSegs.value = segs
  mentionQuery.value = query
  mentionOpen.value = true
  updateAnchor()
}

function syncMentionFromCaret() {
  const v = text.value
  const el = ta.value
  const caret = el ? (el.selectionStart ?? v.length) : v.length

  if (mentionSegs.value.length > 0) {
    const parsed = parseActiveMention(v, mentionStart.value, mentionSegs.value, caret)
    if (parsed.active) {
      openMentionIfNotDismissed(v, mentionStart.value, mentionSegs.value, parsed.query)
      return
    }
  }

  const scan = scanMention(v, caret)
  if (scan.open) {
    openMentionIfNotDismissed(v, scan.start, scan.segments, scan.query)
    return
  }
  resetMention()
}

/**
 * P1c1 补丁 Task 3 —— SlashPopover 的开合助手:只有当当前文本与
 * `slashDismissedText`(上一次 Esc 关闭时的文本)不同,才真的打开;否则保持
 * 关闭。这是"关掉后不自动重开、文本变了才重开"规则的唯一落地点——`onInput`/
 * `onFocus`/`onClick` 三条路径都经过这里,不会各写一份判断而漂移。
 */
function openSlashIfNotDismissed(v: string) {
  if (slashDismissedText.value !== null && slashDismissedText.value === v) {
    slashOpen.value = false
    return
  }
  slashOpen.value = true
  updateAnchor()
}

/**
 * P1c1 补丁 Task 3 —— 取代 Task 11 里 onInput 307-310 那条"整串正好是 '/'
 * 才弹、敲第二个字就失效"的规则。每次调用都是从当前 `text.value` 和当前
 * `slashStage` 纯推导(不依赖上一次调用的历史),所以 onInput/onFocus/onClick
 * 共用同一份逻辑不会漂移。见文件头「SP8-P1c1 验收补丁 Task 3」一节。
 *
 * - 首字符不是 `/`(或文本已清空):强制关闭、退回 command 阶段、清空
 *   query,并清掉 `slashDismissedText`(brief:"文本被清空或首字符不再是 `/`
 *   时清掉这个记忆值")。
 * - target 阶段:文本仍以 `/init `(命令名+一个空格)开头才继续停留在 target,
 *   query = 该前缀之后的剩余文本(用来按目录 path 筛选);否则退回 command
 *   阶段,落到下面的 command 分支重新推导(例如用户把 "/init " 删成
 *   "/in",应该回到 command 阶段列表并筛到 "in")。
 * - command 阶段:`/` 之后不含任何空白字符才打开,query = `/` 之后的剩余
 *   文本;一旦出现空白(用户敲了空格)就关闭(仍停留在 command 阶段——这与
 *   Vue2 的两阶段编排一致:进入 target 阶段是 `pick-command` 事件驱动的,
 *   不是靠打空格)。
 */
function deriveSlashState() {
  const v = text.value
  if (v.length === 0 || v[0] !== '/') {
    slashOpen.value = false
    slashStage.value = 'command'
    slashQuery.value = ''
    slashDismissedText.value = null
    return
  }

  if (slashStage.value === 'target') {
    const prefix = '/init ' // 目前只有一个命令;多命令时这里要按当前命令名拼前缀。
    if (v.startsWith(prefix)) {
      slashQuery.value = v.slice(prefix.length)
      openSlashIfNotDismissed(v)
      return
    }
    // 文本不再以 "/init " 开头(用户删掉了空格或命令名)——退回 command 阶段,
    // 落到下面重新按 command 规则推导。
    slashStage.value = 'command'
  }

  const rest = v.slice(1)
  if (/\s/.test(rest)) {
    slashOpen.value = false
    slashQuery.value = ''
    return
  }
  slashQuery.value = rest
  openSlashIfNotDismissed(v)
}

/**
 * P1c1 补丁 Task 3 —— `@` 与 `/` 互斥的唯一收口点:先推导斜杠状态,斜杠赢了
 * (`slashOpen` 为真)就强制关掉提及面板、不再推导提及;否则走原有的
 * `syncMentionFromCaret()`。两个面板永不同时 open——无论从哪个方向切换
 * (斜杠→提及,或反过来),都在这一个函数里判定,不会漂移成两份逻辑。
 *
 * P1c1 补丁 task 4:这里必须是 `resetMention()`(全量重置),不能只
 * `hideMentionPanel()`——斜杠面板赢了之后,提及的 `mentionSegs`/`mentionStart`
 * 若还留着,下一次斜杠面板关闭、文本又变回一个"仍然匹配已记录前缀"的样子时,
 * `syncMentionFromCaret` 会把提及面板诈尸重开(见 brief「组件改造」步骤 3 最后
 * 一条)。
 */
function syncPanelsFromText() {
  deriveSlashState()
  if (slashOpen.value) {
    if (mentionOpen.value) resetMention()
    return
  }
  syncMentionFromCaret()
}

/**
 * Vue2 300-335 onInput()。顺序不可打乱:先 grow(),再 `syncPanelsFromText()`
 * ——取代 Task 11 里"斜杠触发 + syncMentionFromCaret()"的手写分支(见上面两个
 * 函数的注释)。
 */
function onInput() {
  grow()
  syncPanelsFromText()
}

/**
 * P1c1 验收补丁 Task 1 —— 修 Vue2 缺陷 (c):Vue2 `shell/AgentComposer.vue`
 * 的 textarea(45-53)只绑了 `@input`/`@keydown`/`@blur`,没有 `@focus`。
 * `onBlur`(343-346)会在 180ms 后调 `closeMention()`,而唯一能重开面板的路径
 * 是 `onInput` 里的扫描——于是切标签页/点页面别处再切回来,面板永久消失,直到
 * 用户再敲一个字符。这不是 UI 差异,是逻辑缺陷;按项目 2026-07-27 移植纪律
 * (界面照 Vue2、逻辑按正确的来)在此修:重新聚焦时,
 *   1) 先清掉挂起的 blur 关闭定时器——否则"点面板条目→输入框重获焦点"这个
 *      既有交互会被自己刚排的 180ms 定时器紧接着关掉;
 *   2) 再用 syncMentionFromCaret() 按光标位置决定面板开/关——层级/查询词由
 *      scanMention 从文本本身还原,天然保持已钻入的层级,不需要额外状态。
 * P1c1 补丁 Task 3 更新:原来这里只调 `syncMentionFromCaret()`;现在改调
 * `syncPanelsFromText()`,同时按当前文本重新推导斜杠面板——brief 明确要求
 * "每次 onInput 里(以及 Task 1 新增的 focus/click 同步路径中)重新推导"斜杠
 * 状态。`slashDismissedText` 机制保证这条路径不会把用户刚用 Esc 关掉、且文本
 * 没变化的面板复活。
 */
function onFocus() {
  if (blurTimer.value !== null) {
    clearTimeout(blurTimer.value)
    blurTimer.value = null
  }
  syncPanelsFromText()
}

/**
 * P1c1 验收补丁 Task 1 续,同一缺陷 (c) 的另一半:用户可能在已有文本里点一下,
 * 把光标移进/移出一个 `@` 词,面板要跟着开/关(而不是只在打字时响应)。与
 * onFocus 调用同一个幂等函数——P1c1 补丁 Task 3 起改为 `syncPanelsFromText()`
 * (同时覆盖斜杠状态推导,理由同 onFocus 处注释)。
 */
function onClick() {
  syncPanelsFromText()
}

/**
 * Vue2 336-342 onKeydown()。**补回** Task 9 去掉的 `if (this.mentionOpen)
 * return` 守卫(336 行)——那时 mention 面板还没接入,守卫是死代码;本任务把
 * MentionPopover 接上之后,守卫恢复效力:面板打开时键盘交给面板处理(方向键/
 * Tab/Enter/Esc/Backspace,见 MentionPopover.vue 的 onKey),composer 自己不再
 * 抢 Enter 发送。IME 双重守卫逐字保留(`e.isComposing || keyCode === 229`,
 * 后者是历史上部分浏览器/输入法不设置 isComposing 时的兜底,两个都要留)。
 *
 * P1c1 补丁 Task 3:补上 `if (slashOpen.value) return`,让 SlashPopover 的
 * capture 阶段 window keydown 监听独占 ↑↓/Enter/Tab/Esc/Backspace(见
 * SlashPopover.vue 的 onKey)。两个面板互斥(syncPanelsFromText() 保证),所以
 * 这两行 return 谁先谁后不影响行为,但都必须在 Enter 发送逻辑之前。
 */
function onKeydown(e: KeyboardEvent) {
  if (mentionOpen.value) return // popover handles keys
  if (slashOpen.value) return // SlashPopover handles keys
  if (e.key !== 'Enter' || e.shiftKey) return
  if (e.isComposing || (e as unknown as { keyCode?: number }).keyCode === 229) return
  e.preventDefault()
  submit()
}

/**
 * Vue2 245-250 canSend()。三段式:无就绪附件也无文本→不可发;否则只要没有
 * 正在上传中的附件就可发(已就绪的附件允许纯附件、空文本发送)。
 */
const canSend = computed(() => {
  const hasReady = attachments.value.some((a) => a.status === 'uploaded' && a.aid)
  const hasText = text.value.trim().length > 0
  if (!hasReady && !hasText) return false
  return !attachments.value.some((a) => a.status === 'uploading')
})

/** Vue2 260-272 chips()——用 Task 5 composerText.ts 的 basename/dirname/getExt。 */
const chips = computed(() =>
  store.visibleResources.map((r) => {
    const isFile = r.kind === 'file'
    return {
      id: r.id,
      path: r.path,
      name: basename(r.path),
      parent: dirname(r.path),
      kind: r.kind,
      ext: isFile ? getExt(r.path) : '',
    }
  }),
)

/** Vue2 654-657 toastError()——removeChip/pickItem/onBrowserPick 三处共用的通用
 *  错误提示,对应 Vue2 的 `$t('Authorization failed: {msg}')`,本任务用
 *  `aiAuthFailed` 键接住;removeChip 是本任务唯一接入的调用点,否则移除资源失败
 *  会被静默吞掉。 */
function toastError(e: unknown) {
  const err = e as { response?: { data?: { detail?: string } }; message?: string } | null
  const msg = err?.response?.data?.detail || err?.message || 'unknown'
  toast.show(t('aiAuthFailed', { msg }), 5000)
}

/**
 * Vue2 430-434 removeChip()。
 *
 * P1c2 debt 1(1c-1 final review, 2026-07-27, paid off here): chips the agent
 * itself authorizes mid-run arrive with no `id` — Vue2 agentStream.js:539-542
 * and this repo's dispatchEvent.ts (`case 'visible_resource_added'`, ~line
 * 310-315) both forward the stream event to `appendVisibleResource` with only
 * `{path, kind}`, never an id (see the same observation in agentStore.ts:35).
 * Vue2 has no guard here at all — it calls `removeVisibleResource(undefined)`
 * unconditionally, which hits `/visible-resources/undefined` and fails, but
 * the failure surfaces through Vue2's existing `catch { toastError(e) }` —
 * broken, but at least visible to the user. 1c-1's port instead added an
 * `id === undefined` guard that no-ops silently: clicking × on such a chip
 * did nothing and gave no feedback at all, strictly worse than Vue2.
 *
 * Fix: route id-less chips through `store.removeVisibleResourceByPath(c.path)`
 * (agentStore.ts), which refreshes the server-side list first (it always
 * carries real ids) and either deletes by the now-known id, or — if the
 * server has already forgotten the path — cleans up the local entry only.
 * Both branches still funnel failures through the same `toastError` as the
 * id path below, so behaviour stays consistent between the two.
 */
async function removeChip(c: { id?: string | number; path: string }) {
  try {
    if (c.id !== undefined) {
      await store.removeVisibleResource(c.id)
    } else {
      await store.removeVisibleResourceByPath(c.path)
    }
  } catch (e) {
    toastError(e)
  }
}

/** Vue2 257-259 visibleFolders() —— SlashPopover 的 `folders` prop 喂料(P1c1
 *  补丁 Task 3 起;此前是已退役的 SlashMenu)。 */
const visibleFolders = computed(() => store.visibleResources.filter((r) => r.kind === 'folder'))

/**
 * P1c1 补丁 task 4 —— 拆分"隐藏"与"重置"(brief「组件改造」步骤 1):
 *
 * - `hideMentionPanel()`:只把面板收起来(`mentionOpen=false`),**保留**
 *   `mentionStart`/`mentionSegs`/`mentionQuery`——用在 `onBlur` 的延迟关闭上,
 *   这样重新聚焦时 `syncMentionFromCaret` 还能用 `parseActiveMention` 认出
 *   "这仍是刚才那个提及词"并把面板复原到原来的层级(不受挂载点名里的空格/斜杠
 *   影响,这正是本补丁要修的缺陷)。
 * - `resetMention()`:全量清空,即原来 `closeMention()` 的语义——用在"提及真正
 *   结束"的各个终点:Esc 关闭面板、选中条目、发送、切会话、斜杠面板互斥抢占、
 *   清空输入框的路径。逐个调用点见各自声明处的注释。
 */
function hideMentionPanel() {
  mentionOpen.value = false
}

function resetMention() {
  mentionOpen.value = false
  mentionStart.value = -1
  mentionSegs.value = []
  mentionQuery.value = ''
  // P1c1 补丁验收第 2 轮 Task 5 Item A —— 每一条全量重置路径都顺带清掉 Esc 记忆,
  // 这样它绝不会永久卡死面板(brief 要求"select/submit/session-switch/文本清空
  // 各处清掉")。`onMentionPopClose()`(Esc 本身)必须在调用这个函数*之后*再写入
  // `mentionDismissedText`,否则前脚记、后脚被这里清空。
  mentionDismissedText.value = null
}

/**
 * P1c1 补丁验收第 2 轮 Task 5 Item A —— MentionPopover `@close`(Esc)的处理器。
 * 取代原来直接绑的 `resetMention`:先整体重置(语义不变——提及真正结束),再把
 * "关闭时的文本"记进 `mentionDismissedText`,供 `openMentionIfNotDismissed()`
 * 在文本不变期间拒绝重开。**不清空文本**——用户可能想继续编辑，这与
 * `onSlashPopClose()` 的语义一致。
 */
function onMentionPopClose() {
  resetMention()
  mentionDismissedText.value = text.value
}

/**
 * Vue2 343-346 onBlur()。180ms 延迟关闭,好让点击面板内条目的 click 先于
 * blur 关闭生效。**修 Vue2 缺陷 (a)**(见文件头注释):把 timer 句柄存进
 * `blurTimer`,onBeforeUnmount 里 clearTimeout——Vue2 从未存这个句柄,组件卸载
 * 后这个 setTimeout 仍可能触发(此时 this 已经是死组件实例)。
 *
 * Final-review fix (2026-07-27): storing only the *latest* handle was still
 * incomplete — a blur→focus→blur sequence overwrote `blurTimer` with the
 * second timer's handle without ever clearing the first one, so the first
 * timer kept running and could fire `closeMention()` after the user had
 * already refocused and reopened the popover. Clear any pending handle
 * before scheduling a new one so at most one blur-close timer is ever live.
 *
 * P1c1 补丁 task 4(关键修复):延迟回调改调 `hideMentionPanel()`,不再调
 * `resetMention()`。原来的 `closeMention()` 是全量重置——一旦失焦关闭,
 * `mentionSegs`/`mentionStart` 就被清空,重新聚焦时只能靠 `scanMention` 从文字
 * 重新反推,而挂载点名里的空格会让这次反推必然失败(brief「根因」)。改成只隐藏
 * 之后,状态原样保留,重新聚焦时 `syncMentionFromCaret` 才有东西可以拿去跟
 * `parseActiveMention` 核对。
 */
function onBlur() {
  if (blurTimer.value !== null) clearTimeout(blurTimer.value)
  blurTimer.value = setTimeout(() => {
    hideMentionPanel()
    blurTimer.value = null
  }, 180)
}

/**
 * Vue2 355-371 drillIn() —— 钻进一层文件夹/挂载点,把 "<name>/" 写回 @token
 * 末尾。用 Task 5 composerText.ts 的 buildDrillText 做文本+光标数学。
 *
 * P1c1 补丁验收第 2 轮 Task 5 Item B(2026-07-27,评审提出的时序问题,已用组件
 * 测试钉住)—— `el.setSelectionRange` **必须排在 `el.focus()` 之前**:
 * `el.focus()` 会同步再入 `onFocus()`(见其声明处注释——这不是猜测,已有先例证实),
 * 而 `onFocus` 转手就调 `syncMentionFromCaret()`,后者读的是"当前"
 * `el.selectionStart`。textarea 的 `.value` 刚被这次钻取整体替换过(Vue 的
 * v-model patch 在这个 nextTick 回调运行前已经落地),原生行为是把光标重置到新
 * 字符串末尾——如果 token 后面还跟着别的文字(例如 `@Dr tail` 钻成
 * `@Drive1/ tail`),focus 触发的这次重新同步会在 `setSelectionRange` 还没来得及
 * 把光标挪回 token 末尾之前,把光标读成整串末尾,导致 `mentionQuery` 被尾部文字
 * (` tail`)污染。先设光标位置、再 focus,能避免这次重入用错误的位置读值——
 * 设置 selectionRange 不要求元素已经 focus,而 focus() 本身不会重置已经存在的
 * selection,所以调换顺序是安全的。
 */
function drillIn(item: { name: string }) {
  const el = ta.value
  const caret = el ? (el.selectionStart ?? text.value.length) : text.value.length
  const result = buildDrillText(text.value, mentionStart.value, caret, mentionSegs.value, item.name)
  text.value = result.text
  mentionSegs.value = result.segments
  mentionQuery.value = ''
  nextTick(() => {
    el?.setSelectionRange(result.caretPos, result.caretPos)
    el?.focus()
    grow()
  })
}

/** Vue2 374-410 pickItem() —— 拾取叶子节点(文件,或回车选中的文件夹):删掉
 *  @token、创建可见资源。用 Task 5 composerText.ts 的 stripMentionToken 做
 *  文本+光标数学。 */
async function pickItem(item: { kind: string; resolvedPath: string }) {
  const el = ta.value
  const caret = el ? (el.selectionStart ?? text.value.length) : text.value.length
  const result = stripMentionToken(text.value, mentionStart.value, caret)
  text.value = result.text

  const kind = item.kind === 'file' ? 'file' : 'folder'
  const path = item.resolvedPath
  // P1c1 补丁 task 4:选中之后提及真正结束,须 resetMention()(而非只 hide)——
  // 见 brief「组件改造」步骤 3「pickItem 选中后」。
  resetMention()
  nextTick(() => {
    el?.focus()
    el?.setSelectionRange(result.caretPos, result.caretPos)
    grow()
  })

  try {
    await store.addVisibleResource(path, kind, false)
  } catch (e) {
    const err = e as { response?: { status?: number; data?: { detail?: string } } } | null
    const status = err?.response?.status
    const detail = err?.response?.data?.detail
    if (status === 409 && /gitignore/i.test(detail || '')) {
      // Approved deviation from Vue2 398/630 (window.confirm) — see file-header
      // comment and the gitignoreOpen/gitignoreTarget declaration above for why
      // pending state is kept in two separate refs instead of one that gets
      // cleared from an `update:open` handler.
      gitignoreTarget.value = { path, kind }
      gitignoreOpen.value = true
    } else {
      toastError(e)
    }
  }
}

/** Vue2 412-428 popSegment() —— 弹掉最后一段。**Vue2 特意不 focus()**(与
 *  drillIn/pickItem 不同),这里逐字保留这个不对称。用 Task 5 composerText.ts
 *  的 buildPopText 做文本+光标数学。 */
function popSegment() {
  if (mentionSegs.value.length === 0) return
  const el = ta.value
  const caret = el ? (el.selectionStart ?? text.value.length) : text.value.length
  const result = buildPopText(text.value, mentionStart.value, caret, mentionSegs.value)
  text.value = result.text
  mentionSegs.value = result.segments
  mentionQuery.value = ''
  nextTick(() => {
    el?.setSelectionRange(result.caretPos, result.caretPos)
    grow()
  })
}

/**
 * P1c1 补丁 Task 3 —— SlashPopover `pick-command(name)`。目前只有 'init' 一个
 * 命令。规范化文本为 `` `/${name} ` ``(命令名 + 一个空格)、切到 target 阶段、
 * 清空 query(target 阶段的候选是全部已授权目录,不需要预筛)。**不**在这一步
 * 发任何请求——请求要等用户在 target 阶段选完目录(见 onSlashPickTarget)。
 */
function onSlashPickCommand(name: string) {
  text.value = `/${name} `
  slashStage.value = 'target'
  slashQuery.value = ''
  nextTick(() => {
    const el = ta.value
    el?.focus()
    el?.setSelectionRange(text.value.length, text.value.length)
    grow()
  })
}

/**
 * P1c1 补丁 Task 3 —— SlashPopover `pick-target(path)`。等价于 Vue2 `onInit`
 * (613-617)"关菜单 + 清输入 + 发 send-init":清空输入、关闭面板并回到 command
 * 阶段、`nextTick(grow)`,再把目标目录上抛给 AgentPage(`store.sendInit` 接线
 * 在那一侧,这里不改)。
 *
 * P1c1 补丁 task 4:补上 `resetMention()`——这里把输入框整个清空,提及词(若有)
 * 也该跟着结束,不能让 mentionStart/mentionSegs 悬空指向一段已经不存在的文本。
 * 见 brief「组件改造」步骤 3「onSlashPickTarget 等清空文本的路径」。
 */
function onSlashPickTarget(path: string) {
  text.value = ''
  resetMention()
  slashOpen.value = false
  slashStage.value = 'command'
  slashQuery.value = ''
  slashDismissedText.value = null
  nextTick(grow)
  emit('send-init', path)
}

/**
 * P1c1 补丁 Task 3 —— SlashPopover `back()`(target 阶段按 Esc/Backspace 触发)。
 * 退回 command 阶段,把文本从 `` `/${cmd} <query>` `` 收回成 `` `/${cmd}` ``
 * (去掉命令名之后的一切,包括那个空格),再用 `deriveSlashState()` 按新文本
 * 重新推导 —— 这样 command 阶段的列表会自然高亮/筛到刚才那个命令(brief 的
 * "据此重新推导 slashQuery"要求),不需要单独再写一遍筛选逻辑。
 */
function onSlashBack() {
  const v = text.value
  const spaceIdx = v.indexOf(' ')
  const cmdName = spaceIdx === -1 ? v.slice(1) : v.slice(1, spaceIdx)
  text.value = `/${cmdName}`
  slashStage.value = 'command'
  deriveSlashState()
  nextTick(() => {
    const el = ta.value
    el?.setSelectionRange(text.value.length, text.value.length)
    // 退层会缩短文本(去掉 target 阶段敲的筛选词),不重算高度的话 textarea
    // 会僵在之前撑开的高度上,直到下一次按键才回缩。
    grow()
  })
}

/**
 * P1c1 补丁 Task 3 —— SlashPopover `close()`(command 阶段按 Esc 触发)。关闭
 * 面板、回 command 阶段,并记下当时的文本到 `slashDismissedText`——这是
 * "Esc 关闭后不要立刻自动重开"规则的写入点(读取点在 `openSlashIfNotDismissed`)。
 * **不清空文本**:用户可能想继续编辑,这与 `closeMention()` 的语义一致。
 */
function onSlashPopClose() {
  slashDismissedText.value = text.value
  slashOpen.value = false
  slashStage.value = 'command'
}

/** gitignore 409 确认框的 `@confirm` 处理器 —— 读完 pending 之后才清空(见
 *  gitignoreOpen/gitignoreTarget 声明处注释),force=true 重试
 *  addVisibleResource;失败走通用 toastError(Vue2 401-403 同款兜底)。 */
function onGitignoreConfirm() {
  const pending = gitignoreTarget.value
  gitignoreOpen.value = false
  gitignoreTarget.value = null
  if (!pending) return
  store.addVisibleResource(pending.path, pending.kind, true).catch((e2) => toastError(e2))
}

/**
 * Vue2 460-472 docErrorLabel()。Codes 来自 attachmentMeta.ts 的 docErrorKey
 * (与 backend agent/attachments/extract.py 的 extract_error 码对齐);未知码走
 * 'aiDocErrGeneric' 通用兜底,携带 code 参数(与 Vue2 `{code}` 插值对齐)。
 */
function docErrorLabel(code: string): string {
  const { key, params } = docErrorKey(code)
  return t(key, params ?? {})
}

/** Vue2 474-486 docErrorShort()。 */
function docErrorShort(code: string): string {
  return t(docErrorShortKey(code))
}

/** Vue2 488-494 docOkLabel()。 */
function docOkLabel(entry: PendingAttachment): string {
  if (!entry.docMeta) return t('aiDocOkExtracted')
  const parts = [t('aiDocOkExtracted')]
  if (entry.docMeta.pages) parts.push(t('aiDocPages', { n: entry.docMeta.pages }))
  if (entry.docMeta.truncated) parts.push(t('aiDocTruncated'))
  return parts.join(' · ')
}

/** Vue2 496-504 chipTitle()。 */
function chipTitle(entry: PendingAttachment): string {
  if (entry.docError) {
    return `${entry.file.name} — ${docErrorLabel(entry.docError)}`
  }
  if (entry.kind === 'document' && entry.status === 'uploaded') {
    return `${entry.file.name} — ${docOkLabel(entry)}`
  }
  return entry.file.name
}

/**
 * Vue2 506-602 onFilesPicked() —— 逐字移植的上传管线,顺序不可打乱:
 * 1) 复位 input.value(允许重选同一文件)、空选择直接 return。
 * 2) 无会话时懒建会话(517-527)——失败给 danger toast 并 return。
 * 3) 逐文件**串行** for-of(不是 Promise.all):500MB 门 → 生成 tmpId → 用
 *    `reactive()` 建 entry(见下方 entry 声明处注释,这是 Vue3 端口特有的
 *    坑,不是 Vue2 没有的东西)→ **先 push entry 再 await 上传**(545,让 chip
 *    立刻可见)→ onProgress 直接改 entry → 成功写 aid/kind/mime/status →
 *    document 抽取失败给 7000ms 警告 toast、binary+not_installed+文档扩展名
 *    同款 toast → 失败写 status/error 并给 danger toast。
 */
async function onFilesPicked(e: Event) {
  const target = e.target as HTMLInputElement
  const files = Array.from(target.files || [])
  target.value = '' // 允许之后重选同一文件
  if (!files.length) return

  // 附件按钮不再受 sessionId 门控——刚打开页面还没有 activeSession,这里懒建
  // 一个,好让"发消息之前先附件"这个操作能用。必须在 OS 文件选择器返回之后
  // 才建(不能在 .click() 之前),否则用户手势上下文会丢失。
  if (!store.activeSessionId) {
    try {
      await store.createSession()
    } catch (err) {
      const msg = (err as Error)?.message || String(err)
      toast.show(t('aiAttachSessionFailed', { err: msg }), 5000)
      return
    }
  }
  if (!store.activeSessionId) return
  const sid = store.activeSessionId // narrow once: TS re-widens the ref across awaits below

  for (const file of files) {
    if (file.size > MAX_ATTACHMENT_BYTES) {
      toast.show(t('aiAttachTooLarge', { name: file.name }), 5000)
      continue
    }
    const tmpId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    // reactive(), not a plain object: onProgress/success/failure below mutate
    // `entry` directly (Vue2 relied on Vue2's auto-reactive `data()` array
    // items for this — a plain object pushed into a Vue3 ref<T[]> array is
    // NOT itself the reactive proxy the template reads back out of the array,
    // so in-place field writes on a plain `entry` would silently not trigger
    // a re-render. Wrapping with reactive() up front makes `entry` itself the
    // canonical proxy Vue caches for this object, so writes through this same
    // reference correctly notify the template.
    const entry = reactive<PendingAttachment>({ tmpId, file, status: 'uploading', progress: 0 })
    attachments.value.push(entry)
    // Fix (review, 2026-07-27): Vue2 (AgentComposer.vue:547) reads `this.sessionId`
    // — a *computed* — fresh on every loop iteration, so a session switch mid-batch
    // just silently redirects the remaining uploads into whatever session happens
    // to be active now. That is wrong, not merely different: the `activeSessionId`
    // watcher above has already cleared every local chip for this batch (including
    // the one just pushed above, on the very next reactive flush), so the user has
    // no way to see or manage an attachment that lands in the new session — it's
    // an orphaned server-side draft. Per project rule (logic follows correctness,
    // not 1:1 UI parity), we re-read the session id here and stop the whole batch
    // the moment it no longer matches the id the batch started with, instead of
    // continuing to upload into it. Drop the entry we just pushed for this file
    // (it was never uploaded) before breaking, so no stale "uploading" chip can
    // flash before the watcher's clear takes effect.
    if (store.activeSessionId !== sid) {
      attachments.value = attachments.value.filter((a) => a.tmpId !== tmpId)
      break
    }
    try {
      const body = (await service.ai.uploadAttachment(sid, file, {
        onProgress: (p: number) => { entry.progress = p },
      })) as { id?: string; kind?: string; mime?: string; meta?: Record<string, unknown> }
      entry.aid = body.id
      entry.kind = body.kind
      entry.mime = body.mime
      entry.status = 'uploaded'
      // kind=document:extraction 可能在上传时(200)就已失败——上传本身仍然
      // 成功(模型仍能看到文件名+mime),但用户应该知道模型读不到内容。
      if (body.kind === 'document' && body.meta) {
        if (body.meta.extract_error) {
          entry.docError = body.meta.extract_error as string
          toast.show(`${file.name}:${docErrorLabel(entry.docError)}`, 7000)
        } else {
          entry.docMeta = {
            extractor: (body.meta.extractor as string) || undefined,
            pages: (body.meta.pages as number) || undefined,
            truncated: !!body.meta.truncated,
          }
        }
      }
      // kind=binary 且 extract_error=not_installed 是基础设施问题(服务端缺
      // 抽取库);文档扩展名匹配时仍要告知用户这份上传无法用于内容问答。
      if (
        body.kind === 'binary'
        && body.meta && body.meta.extract_error === 'not_installed'
        && /\.(pdf|docx|xlsx|xlsm|pptx)$/i.test(file.name)
      ) {
        toast.show(`${file.name}:${docErrorLabel('not_installed')}`, 7000)
      }
    } catch (err) {
      entry.status = 'failed'
      const errObj = err as { response?: { data?: { detail?: string } }; message?: string } | null
      entry.error = errObj?.response?.data?.detail || errObj?.message || 'upload failed'
      toast.show(`${file.name}: ${entry.error}`, 5000)
    }
  }
}

/** Vue2 604-611 removeAttachment()。已上传的先 best-effort 删服务端(失败也
 *  照样本地移除,不阻塞用户),再从本地列表过滤掉。 */
async function removeAttachment(entry: PendingAttachment) {
  const sid = store.activeSessionId
  if (entry.status === 'uploaded' && entry.aid && sid) {
    try {
      await service.ai.deleteAttachment(sid, entry.aid)
    } catch {
      /* best-effort */
    }
  }
  attachments.value = attachments.value.filter((a) => a.tmpId !== entry.tmpId)
}

/**
 * Vue2 436-454 submit()。附件半段:只把已上传且带 aid 的项算作就绪
 * (readyAttachments),据此派生 attachmentIds/attachmentRefs;仍在上传中的
 * 附件存在时二次拦截(与 canSend 的守卫重复,但 submit 也可能被 Enter 键直接
 * 调用,不经过 disabled 按钮态,所以这层守卫不可省)。
 *
 * Vue2 缺陷修复(final review, 2026-07-27,项目移植纪律:逻辑跟正确性):Vue2
 * AgentComposer.vue:436-454 的 submit() 无 busy 守卫,无条件清空 this.text/
 * this.attachments;但对应 store 的 send() 一开头就 `if (busy.value) return`
 * ——于是流式回复期间按 Enter,文本和已上传附件 chip 被原地清空,消息却根本没发
 * 出去,静默吞掉用户输入。这里在做任何清空/emit 之前先挡一道 busy。
 *
 * P1c1 补丁 task 4:清空 `text`/`attachments` 的同时补上 `resetMention()`——
 * 发送之后输入框是全新的一段文本,任何还挂着的提及层级/查询词都该跟着结束。
 * 见 brief「组件改造」步骤 3「submit() 发送后」。
 */
function submit() {
  if (props.busy) return
  const trimmed = text.value.trim()
  const readyAttachments = attachments.value.filter((a) => a.status === 'uploaded' && a.aid)
  const attachmentIds = readyAttachments.map((a) => a.aid as string)
  if (!trimmed && attachmentIds.length === 0) return
  if (attachments.value.some((a) => a.status === 'uploading')) return
  const attachmentRefs: AttachmentRef[] = readyAttachments.map((a) => ({
    id: a.aid as string,
    filename: a.file.name,
    kind: a.kind,
    mime: a.mime,
    url: service.ai.attachmentRawUrl(store.activeSessionId as string, a.aid as string),
  }))
  emit('send', { text: trimmed, attachmentIds, attachmentRefs })
  text.value = ''
  attachments.value = []
  resetMention()
  nextTick(grow)
}

/**
 * Vue2 643-650 openFilePicker()。**必须**挂在 `@mousedown.prevent`(模板里),
 * 不是 `@click`:mousedown 比 click 提前触发(用户还没松开按钮,OS 对话框已经
 * 开始打开),`preventDefault` 让 textarea 保持 focus,省掉一趟
 * blur→mention-面板关闭的往返(Vue2 644-647 注释逐字对齐)。
 */
function openFilePicker() {
  attachFileInput.value?.click()
}

/** Vue2 651-653 notSupported()(语音键)。Vue2 用 'is-warning' 类型,不是错误,
 *  用默认 toast 时长。 */
function notSupported() {
  toast.show(t('aiNotSupportedYet'))
}

/**
 * **本期有意偏离 Vue2**:Vue2 点击 Browse 直接打开 `<BrowserModal>`
 * (浏览 NAS 弹窗)。该弹窗本阶段不做(用户决定,见 Task 9 brief「Browse 按钮」
 * 一节),这里改为 toast 占位提示,不设 browserOpen 状态、不渲染
 * `data-active`(Vue2 59 行的 `:data-active="browserOpen"` 因此一并去掉)。
 */
function onBrowseClick() {
  toast.show(t('aiBrowseComingSoon'))
}

/**
 * Vue2 275-281 `activeSessionId` watcher。关闭 mention 面板(`resetMention()`)
 * + 清空待发附件列表。服务端附件仍归属旧会话,这里只是丢弃本地 chip 引用,
 * 不发任何请求。
 *
 * P1c1 补丁 task 4:原来这里调的是 `closeMention()`,现按 brief「组件改造」
 * 步骤 3「activeSessionId watcher」改名调 `resetMention()`——语义不变(这本来
 * 就是全量重置:切会话是全新上下文,不应该继承上一个会话的提及层级/查询词),
 * 只是与新拆出的 `hideMentionPanel()` 区分开,避免以后有人在这里误用只隐藏的
 * 那个函数。
 *
 * P1c1 补丁 Task 3:并列补上关闭斜杠面板——回 command 阶段并清掉
 * `slashDismissedText`(不是记一次 dismiss,是整体重置:新会话是全新上下文,
 * 不应该继承上一个会话里"这段文本刚被 Esc 关过"的记忆)。避免切会话后残留
 * 半截状态(例如卡在 target 阶段但目录列表已经是新会话的)。
 */
watch(
  () => store.activeSessionId,
  () => {
    resetMention()
    slashOpen.value = false
    slashStage.value = 'command'
    slashDismissedText.value = null
    attachments.value = []
  },
)

onMounted(() => window.addEventListener('resize', updateAnchor))
onBeforeUnmount(() => {
  window.removeEventListener('resize', updateAnchor)
  // Vue2 缺陷修复 (a) — 见文件头注释:Vue2 从不清理 onBlur 的 setTimeout 句柄。
  if (blurTimer.value !== null) clearTimeout(blurTimer.value)
})
</script>

<template>
  <div class="composer-wrap">
    <div class="composer" ref="composerEl">
      <div v-if="chips.length > 0 || attachments.length > 0" class="composer-chips">
        <div v-for="c in chips" :key="c.id" class="ctx-chip" :title="c.path">
          <KindIcon :kind="c.kind === 'file' ? 'file' : 'folder'" :ext="c.ext" :size="12" />
          <span class="ctx-chip-name">{{ c.name }}</span>
          <span class="ctx-chip-path">{{ c.parent || '/' }}</span>
          <button class="ctx-chip-x" @click="removeChip(c)">
            <AgentIcon name="x" :size="10" />
          </button>
        </div>
        <div
          v-for="a in attachments"
          :key="a.tmpId"
          class="ctx-chip ctx-chip-att"
          :class="{
            'is-uploading': a.status === 'uploading',
            'is-failed': a.status === 'failed',
            'is-doc-warn': a.docError,
          }"
          :title="chipTitle(a)"
        >
          <KindIcon
            :kind="a.kind === 'image' ? 'image' : 'file'"
            :ext="getExt(a.file.name)"
            :size="12"
          />
          <span class="ctx-chip-name">{{ a.file.name }}</span>
          <span v-if="a.status === 'uploading'" class="ctx-chip-prog">{{ a.progress }}%</span>
          <span v-else-if="a.status === 'failed'" class="ctx-chip-err">!</span>
          <span
            v-else-if="a.docError"
            class="ctx-chip-doc-warn"
          >⚠ {{ docErrorShort(a.docError) }}</span>
          <button class="ctx-chip-x" @click="removeAttachment(a)">
            <AgentIcon name="x" :size="10" />
          </button>
        </div>
      </div>

      <textarea
        ref="ta"
        class="composer-textarea"
        :placeholder="placeholder"
        rows="1"
        v-model="text"
        @input="onInput"
        @keydown="onKeydown"
        @blur="onBlur"
        @focus="onFocus"
        @click="onClick"
      />

      <div class="composer-row">
        <button
          class="composer-tool"
          :title="t('aiComposerBrowseTitle')"
          @click="onBrowseClick"
        >
          <AgentIcon name="folder" :size="14" /> {{ t('aiComposerBrowse') }}
        </button>
        <!-- Vue2 663-673: a display:none input does not fire a synthetic
             .click() in some browsers, hence position+opacity instead of
             hidden/display:none (kept in .attach-file-input below). -->
        <input
          type="file"
          ref="attachFileInput"
          :accept="acceptTypes"
          multiple
          class="attach-file-input"
          @change="onFilesPicked"
        />
        <!-- Vue2 73-86 wraps this button in a Buefy <b-tooltip multilined> to
             show attachmentHint; this repo has no Buefy equivalent, so the
             same 7-line hint is joined with \n into the native `title`
             attribute instead (approved deviation, see Task 10 brief). -->
        <button
          class="composer-tool"
          :title="attachmentHint"
          @mousedown.prevent="openFilePicker"
        >
          <AgentIcon name="paperclip" :size="14" />
        </button>
        <button class="composer-tool" :title="t('aiComposerVoice')" @click="notSupported">
          <AgentIcon name="mic" :size="14" />
        </button>
        <div class="composer-spacer" />
        <ContextUsageBar
          v-if="ctxUsage"
          :tokens="ctxUsage.tokens"
          :window="ctxUsage.window"
          :pct="ctxUsage.pct"
          class="composer-ctx-usage"
        />
        <button
          v-if="props.busy"
          class="send-btn busy"
          @click="emit('stop')"
        >
          <AgentIcon name="stop" :size="12" />
        </button>
        <button
          v-else
          class="send-btn"
          :disabled="!canSend"
          @click="submit"
        >
          <AgentIcon name="send" :size="14" />
        </button>
      </div>

      <!-- P1c1 补丁 task 4: `@close`(Esc)必须整体重置(不能只 hide)——否则用户
           按 Esc 关掉面板后,下一次 focus 会被 syncMentionFromCaret 的
           parseActiveMention 分支认成"提及词仍然有效"而立刻重开,Esc 就白按了。
           见 brief「组件改造」步骤 3「面板 close(Esc)」。
           P1c1 补丁验收第 2 轮 Task 5 Item A:光整体重置还不够——重置之后
           `mentionSegs` 清空,下一次 focus 会落进 scanMention 分支,从文本本身
           重新"发现"同一个 token 并弹回来(斜杠面板早年也踩过这个坑,这里补的是
           @ 面板的对称记忆)。改绑 `onMentionPopClose`:整体重置 + 记下关闭时的
           文本,交给 `openMentionIfNotDismissed()` 在文本不变期间拒绝重开。 -->
      <MentionPopover
        :open="mentionOpen"
        :query="mentionQuery"
        :segments="mentionSegs"
        :anchor-rect="anchorRect"
        @drill-in="drillIn"
        @pick="pickItem"
        @pop-segment="popSegment"
        @close="onMentionPopClose"
      />

      <!-- P1c1 补丁 Task 3 —— 退役全屏 SlashMenu,换成与 MentionPopover 同款的
           内联/锚定 SlashPopover(两阶段 command → target)。always-mounted
           (不用 v-if 包组件本身,只是它内部模板自己 v-if="open"),与
           MentionPopover 的挂载方式对齐——组件实例始终存在,:open 控制显隐。 -->
      <SlashPopover
        :open="slashOpen"
        :stage="slashStage"
        :query="slashQuery"
        :folders="visibleFolders"
        :anchor-rect="anchorRect"
        @pick-command="onSlashPickCommand"
        @pick-target="onSlashPickTarget"
        @back="onSlashBack"
        @close="onSlashPopClose"
      />
    </div>

    <div class="composer-caption">
      {{ t('aiComposerCaption') }}
    </div>

    <AlertDialog
      v-model:open="gitignoreOpen"
      :title="t('aiGitignoreBlockedTitle')"
      :message="t('aiGitignoreBlockedMsg', { path: gitignoreTarget?.path ?? '' })"
      :confirm-text="t('aiAllow')"
      :cancel-text="t('aiCancel')"
      @confirm="onGitignoreConfirm"
    />
  </div>
</template>

<style scoped>
/* agent-styles.scss:353-406 已经全局定了 .composer-wrap/.composer/
   .composer-textarea/.composer-row/.composer-tool/.send-btn 的布局(sticky 定位、
   pointer-events 开关、圆角/边框/阴影、focus-within 高亮、悬停态等)——这里只
   补它没有的部分,不重复布局规则。 */

.attach-file-input {
  /* Keep the input in the render tree so $refs.attachFileInput.click()
     always lands on a live element. `hidden` attribute also works but some
     browsers won't dispatch synthetic click events on display:none inputs.
     (Vue2 663-673, verbatim.) */
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
  overflow: hidden;
}

.composer-chips {
  display: flex; gap: 6px; flex-wrap: wrap;
  margin-bottom: 8px;
}
.ctx-chip {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 4px 4px 7px;
  background: var(--bg-chip);
  border: 1px solid var(--line);
  border-radius: var(--r-pill);
  font-size: 12px;
  color: var(--text-primary);
  max-width: 280px;
}
.ctx-chip-name { font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ctx-chip-path {
  font-family: var(--font-mono); font-size: 10.5px;
  color: var(--text-tertiary);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  max-width: 140px;
}
.ctx-chip-x {
  width: 18px; height: 18px;
  display: grid; place-items: center;
  border-radius: 50%;
  color: var(--text-tertiary);
  background: transparent; border: none; cursor: pointer;
  transition: all 120ms ease;
}
.ctx-chip-x:hover { background: var(--bg-elevated); color: var(--text-primary); }

/* Vue2 722-747 attachment chip states — colors ported to theme tokens
   (--danger/--warning/--warning-soft, defined in src/ai/styles/tokens.scss).
   Vue2's raw hex/rgba literal fallbacks on these declarations are dropped;
   the tokens above always have a value in both theme blocks. */
.ctx-chip-att.is-uploading {
  opacity: 0.7;
}
.ctx-chip-att.is-failed {
  border-color: var(--danger);
}
.ctx-chip-prog {
  font-size: 11px; color: var(--text-tertiary); margin-left: 4px;
}
.ctx-chip-err {
  font-size: 11px; color: var(--danger); margin-left: 4px;
}
.ctx-chip-att.is-doc-warn {
  border-color: var(--warning);
  max-width: 380px;
}
.ctx-chip-doc-warn {
  display: inline-flex; align-items: center; gap: 3px;
  font-size: 11px; font-weight: 500;
  color: var(--warning);
  background: var(--warning-soft);
  border-radius: 4px;
  padding: 1px 6px;
  margin-left: 4px;
  white-space: nowrap;
}

.composer-textarea::placeholder { color: var(--text-tertiary); }

.composer-spacer { flex: 1; }

.send-btn.busy {
  background: var(--bg-chip);
  color: var(--text-primary);
  box-shadow: none;
}

.composer-caption {
  text-align: center; margin-top: 8px;
  font-size: 11px; color: var(--text-quaternary);
}

.composer-ctx-usage {
  margin-right: 8px;
  flex-shrink: 0;
}
</style>
