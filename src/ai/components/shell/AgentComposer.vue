<!--
  SP8-P1c1 Task 9 —— AgentComposer 骨架:chips + textarea + 工具栏 + 发送/停止。
  1:1 移植自 Vue2 src/views/AI/Agent/shell/AgentComposer.vue(830 行)。本任务只做
  骨架:可见资源 chips(Vue2 5-17)、自增高 textarea(45-54)、工具栏行(56-113)、
  caption(127-129)。**不做**(留给 Task 10/11,接线处见下方注释):
    - 附件 chips(Vue2 18-42)、上传/删除管线(onFilesPicked/removeAttachment,
      Vue2 506-611)——`attachments` 数组在本任务里恒为空数组。
    - @mention 面板(MentionPopover)与 `/init` 斜杠面板(SlashMenu)——onInput 的
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

  gitignore 409 确认(本期唯一有意的交互偏离):Vue2 用阻塞的 `window.confirm`
  (Vue2 398、630),这里改用仓库的 reka-ui `AlertDialog`。注意 AlertDialog 走
  `DialogPortal`,渲染在 `.agent-app` 子树之外,`.agent-app` 的 token 不对它生效
  ——这是既有约定(AgentSidebar 的删除确认已是同样处境),不是本任务引入的新问题。
-->
<script setup lang="ts">
import { ref, reactive, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import AgentIcon from '../icons/AgentIcon.vue'
import KindIcon from './KindIcon.vue'
import ContextUsageBar from '../blocks/ContextUsageBar.vue'
import MentionPopover from './MentionPopover.vue'
import SlashMenu from './SlashMenu.vue'
import AlertDialog from '../../../components/ui/AlertDialog.vue'
import { useProvidedAgentStore } from '../../composables/useProvidedAgentStore'
import { useToast } from '../../../stores/toast'
import { getExt, basename, dirname, scanMention, buildDrillText, buildPopText, stripMentionToken } from '../../util/composerText'
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
const slashOpen = ref(false)
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
 * P1c1 验收补丁 Task 1(见文件头「Vue2 缺陷修复」新增项 (c)):抽出 onInput 里
 * `scanMention` 那段——扫描光标处是否在一个有效的 `@` 词内,是则(重)开面板并
 * 还原层级/查询词,否则关闭面板。抽出来的原因是 onFocus/onClick 两个新处理器
 * 要复用同一份逻辑,不能各写一份(避免两份实现漂移)。**未改动扫描规则本身**,
 * 逐字保留原来 onInput 里的分支。
 */
function syncMentionFromCaret() {
  const v = text.value
  const el = ta.value
  const caret = el ? (el.selectionStart ?? v.length) : v.length

  const scan = scanMention(v, caret)
  if (scan.open) {
    mentionStart.value = scan.start
    mentionSegs.value = scan.segments
    mentionQuery.value = scan.query
    mentionOpen.value = true
    updateAnchor()
    return
  }
  closeMention()
}

/**
 * Vue2 300-335 onInput()。顺序不可打乱:先 grow(),再斜杠触发(307-310——
 * **仅当**整串正好是 `'/'` 且斜杠菜单未打开时才触发,不会在任何别的位置的
 * `/` 上误触发),否则走 `syncMentionFromCaret()`(Task 5 composerText.ts 的
 * `scanMention`,逐字对齐 Vue2 312-334 的"从光标往回扫,遇到非转义 @ 才算命中、
 * 遇到空白直接放弃"规则——现在与 onFocus/onClick 共用,见上面的抽取注释)。
 */
function onInput() {
  grow()
  const v = text.value

  // Vue2 307-310: slash command only at the very start of input.
  if (v.length === 1 && v === '/' && !slashOpen.value) {
    slashOpen.value = true
    return
  }

  syncMentionFromCaret()
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
 * 不触发斜杠菜单:那是 Task 3 的范围,且 `/` 的触发条件(整串正好是 '/')不同,
 * 重新聚焦本身不该触发它。
 */
function onFocus() {
  if (blurTimer.value !== null) {
    clearTimeout(blurTimer.value)
    blurTimer.value = null
  }
  syncMentionFromCaret()
}

/**
 * P1c1 验收补丁 Task 1 续,同一缺陷 (c) 的另一半:用户可能在已有文本里点一下,
 * 把光标移进/移出一个 `@` 词,面板要跟着开/关(而不是只在打字时响应)。与
 * onFocus 调用同一个幂等函数 `syncMentionFromCaret()`——点击输入框时 focus 和
 * click 两个事件都会触发,重复调用无副作用。
 */
function onClick() {
  syncMentionFromCaret()
}

/**
 * Vue2 336-342 onKeydown()。**补回** Task 9 去掉的 `if (this.mentionOpen)
 * return` 守卫(336 行)——那时 mention 面板还没接入,守卫是死代码;本任务把
 * MentionPopover 接上之后,守卫恢复效力:面板打开时键盘交给面板处理(方向键/
 * Tab/Enter/Esc/Backspace,见 MentionPopover.vue 的 onKey),composer 自己不再
 * 抢 Enter 发送。IME 双重守卫逐字保留(`e.isComposing || keyCode === 229`,
 * 后者是历史上部分浏览器/输入法不设置 isComposing 时的兜底,两个都要留)。
 */
function onKeydown(e: KeyboardEvent) {
  if (mentionOpen.value) return // popover handles keys
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
 * Known gap (final review, 2026-07-27, deferred to 1c-2): chips the agent
 * itself authorizes mid-run arrive with no `id` — Vue2 agentStream.js:539-542
 * and this repo's dispatchEvent.ts (`case 'visible_resource_added'`, ~line
 * 310-315) both forward the stream event to `appendVisibleResource`/
 * `addVisibleResource` with only `{path, kind}`, never an id (see the same
 * observation in agentStore.ts:35). Vue2 has no guard here at all — it calls
 * `removeVisibleResource(undefined)` unconditionally and lets the resulting
 * failure surface through its existing `catch { toastError(e) }`, i.e. the
 * user does see an error toast. This port's `id === undefined` guard instead
 * no-ops silently: clicking × on such a chip does nothing and gives no
 * feedback. A proper fix needs either the reducer to carry the id or a
 * remove-by-path path — both out of scope here; not attempted in this task.
 */
async function removeChip(c: { id?: string | number }) {
  if (c.id === undefined) return
  try {
    await store.removeVisibleResource(c.id)
  } catch (e) {
    toastError(e)
  }
}

/** Vue2 257-259 visibleFolders() —— SlashMenu 的 `folders` prop 喂料。 */
const visibleFolders = computed(() => store.visibleResources.filter((r) => r.kind === 'folder'))

/** Vue2 347-352 closeMention()。 */
function closeMention() {
  mentionOpen.value = false
  mentionStart.value = -1
  mentionSegs.value = []
  mentionQuery.value = ''
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
 */
function onBlur() {
  if (blurTimer.value !== null) clearTimeout(blurTimer.value)
  blurTimer.value = setTimeout(() => {
    closeMention()
    blurTimer.value = null
  }, 180)
}

/** Vue2 355-371 drillIn() —— 钻进一层文件夹/挂载点,把 "<name>/" 写回 @token
 *  末尾。用 Task 5 composerText.ts 的 buildDrillText 做文本+光标数学。 */
function drillIn(item: { name: string }) {
  const el = ta.value
  const caret = el ? (el.selectionStart ?? text.value.length) : text.value.length
  const result = buildDrillText(text.value, mentionStart.value, caret, mentionSegs.value, item.name)
  text.value = result.text
  mentionSegs.value = result.segments
  mentionQuery.value = ''
  nextTick(() => {
    el?.focus()
    el?.setSelectionRange(result.caretPos, result.caretPos)
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
  closeMention()
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

/** Vue2 613-617 onInit() —— `/init` 确认后清空输入并把目标目录上抛给
 *  AgentPage(Task 12 接线)。 */
function onInit(target: string) {
  slashOpen.value = false
  text.value = ''
  emit('send-init', target)
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
 * Vue2 275-281 `activeSessionId` watcher。关闭 mention 面板(`closeMention()`)
 * + 清空待发附件列表。服务端附件仍归属旧会话,这里只是丢弃本地 chip 引用,
 * 不发任何请求。
 */
watch(
  () => store.activeSessionId,
  () => {
    closeMention()
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

      <MentionPopover
        :open="mentionOpen"
        :query="mentionQuery"
        :segments="mentionSegs"
        :anchor-rect="anchorRect"
        @drill-in="drillIn"
        @pick="pickItem"
        @pop-segment="popSegment"
        @close="closeMention"
      />
    </div>

    <div class="composer-caption">
      {{ t('aiComposerCaption') }}
    </div>

    <SlashMenu
      v-if="slashOpen"
      :folders="visibleFolders"
      @init="onInit"
      @close="slashOpen = false"
    />

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
