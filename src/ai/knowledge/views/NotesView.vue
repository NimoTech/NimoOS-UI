<!--
  SP8-P5d Task 6 —— 「笔记」页(rail 第 4 项),1:1 移植自 Vue2 蓝本
  `NimoOS-UI` (main@7a6ee6b7) `src/views/AI/Knowledge/NotesView.vue`(271 行,
  `git show 7a6ee6b7:` 读取,治理文件 §1:工作树是旧分支不可信)。

  结构对照(蓝本行区间 → 本文件):
    :8-16    pathstrip(每条笔记都是磁盘上的 .md 文件)
    :19-28   骨架屏(loading && !notes.length)
    :31-38   空态(!notes.length)
    :42-76   草稿收件箱(drafts.length)
    :79-99   工具栏(状态 pill + 类型下拉 + 新建)
    :102-142 列表(filtered)+ 列表脚注
    :147-175 删除确认弹窗(本刀转 reka,见下方【K7/K29/K36 同族】)
    :180-266 全部 script

  【K1 —— 单层取数,治理 §4.1】`service.notes.list({limit:200})` 返回**已归一化的
  `Note[]`**,不是 `{notes:[]}` 信封(`NimoOS-Service/src/notes.ts:211-215`);
  `service.notes.getSettings()` 返回 camelCase 且只有 `{notesRoot, autoExtract}`
  两个字段;`service.notes.remove(id)` 返回值本页不读(蓝本 `:261` 只 `await`)。

  【§5.2 —— reload() 过期守卫,K15 同族第 8 次】`reload()` 有 3 个并发入口:
  created 等效(见文件底部 setup 顶层直调)· `watch editingId` 变空 ·
  5 个动作各自 `reload()`。`loading = false` 被先完成的那次提前清掉会让骨架
  提前消失、用户可见 —— 用组件本地(不是模块级!)的 `let reloadEpoch` 判断
  「我还是最新那一发吗」,不是最新就整发丢弃,inline 写,不抽公共 guard。

  【N30 —— watch editingId 只在变空时 reload,照抄】`:key="editingId"` 不许删,
  切到另一条笔记时(id 非空→另一个非空)不触发 reload,靠 :key 变化重建子组件。

  【N24 —— 骨架算术内联样式照抄】`(52 - i*8)%` / `(72 - i*6)%` 与 `cursor: default`
  一字不改,不抽 class / computed。

  【N31 —— confirmAll 照抄】`Promise.all` 并发 + 无 `finally` + 失败也 `reload()`。
  部分成功时:toast 报失败,但 `reload()` 仍把已成功的那些刷出来(这是 Vue2
  现状,不是可复现错误行为,不修)。

  【N25 —— 列表脚注整句带 {n} 照抄】不许拆成三段拼接。

  【K3】`store.actions.toast(...)` → 全局 `useToast().show(msg, 2400)`(承 P5a K3,
  2400ms 与 `knowledgeStore.ts:312` 的既定 duration 一致)。
  【K5(全部 catch)】不回显后端 `e.message`,统一弹固定文案 `aiKbOpFailed`
  ——蓝本 5 处 catch 都是 `$t('Operation failed') + ': ' + (e.message || e)`,
  本仓按既定模具(P2a/P2b/P5b K19/P5c K30)只弹固定键。

  【`store.actions.setNotesDraftCount(n)` 照抄调用】`knowledgeStore.ts:509`,
  该 store 全期零改动,本刀只调用。

  【notesRoot 静默兜底,K6】蓝本 `:215` 是空 catch + 注释 `keep placeholder`,
  照抄,连 `console.error` 都不加。

  【`editingId` 深链 watch 每个键各自的 getter】`editingId` 是读 `route.query.id`
  的 computed(天然响应式,不是 onMounted 里一次性读值),避免记忆
  `newui-router-query-only-no-remount` 那个坑——用户改地址栏一行也会生效。

  【缺口③ —— 模板内联色,附录 B §B.4 第 34 行是权威映射】蓝本 `:85` 的草稿
  计数底色字面量藏在 `:style` 的 JS 对象字面量里,已换成 token 引用。守卫见
  `../../styles/knowledgeStyles.test.ts` 的「守卫缺口③′」— 该断言贪婪抽取整个
  `<template>` 块做文本级正则扫描,天然覆盖 `:style` 对象字面量里的字符串(不止
  `style="…"` 属性),本刀把 `views/NotesView.vue` 加进 `KNOWLEDGE_VUE_FILES`
  清单即可被其覆盖。

  【K41 同族 —— tags 类型收窄】包内 `Note.tags` 是 `unknown[]`
  (`NimoOS-Service/src/notes.ts:25`),蓝本模板把它当字符串数组直接渲染
  (`:124/:128`,`{{ t }}` / `:key="t"`),create/update 两端点的 tags 字段本就是
  `string[]`,蓝本自己也从不做运行时校验。消费侧一次性断言式收窄(`tagsOf()`),
  不改包、不用 `any`。K41 在治理文件里正式登记于 T7,本刀命中同一个字段、
  用同一手法,行文里一并注明。

  【K34 同族 —— Vue3+TS 机械改写】`confirmDelete()` 里 `deleting.value!.id`
  ——蓝本 `notesApi.remove(this.deleting.id)` 没有任何空值防御,`deleting` 只在
  删除弹窗打开时才非空(按钮只在弹窗内)。按 K34 第④条「能用保抛就用保抛」,
  用非空断言 `!` 而不是 `?.`/提前 return(那会把蓝本的隐式抛错静默改成 no-op,
  不是零行为变化)。

  【NoteEditPane.vue 已在 T7 落地】T6 提交时该文件尚不存在,内联了一个零逻辑
  占位组件顶替静态 import(见 p5d-task-6-report.md §7)。T7 创建了真实的
  `../components/NoteEditPane.vue` 后,依计划书 §T7/brief §2 的「自动上膛」
  守卫要求(见下方 `NotesView.test.ts` 对应 describe 块),已把下面这个 import
  换回真组件,占位实现随之删除。

  【删除确认弹窗转 reka,申报】计划书 §T8-7 已把冲突弹窗定为「转」,本刀判断
  删除确认弹窗同族(K7 自 P5b 起对本期新增弹窗一律生效,QueueView/
  IndexedFilesView/SettingsView 三个先例全部已转)。蓝本本身就有可见的
  `.k-modal-title` 元素(`:150` 附近),按 K36 的既定选择用 `<DialogTitle as-child>`
  直接套在那个 div 上(不额外插入 VisuallyHidden 隐藏节点),DOM 与蓝本逐字一致。
  `DialogPortal to=".knowledge-app"`,结构照 `QueueView.vue:560-583` /
  `SettingsView.vue:580-624` 抄,不自己发明。
-->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { DialogRoot, DialogPortal, DialogOverlay, DialogContent, DialogTitle } from 'reka-ui'
import { service } from '@nimotech/nimoos-service'
import type { Note } from '@nimotech/nimoos-service'
import { useKnowledgeStore } from '../stores/knowledgeStore'
import { useToast } from '../../../stores/toast'
import KIcon from '../components/KIcon.vue'
import NoteEditPane from '../components/NoteEditPane.vue'
import { openDirInNewTab } from '../../services/openInApp'
import { NOTE_TYPES, noteTypeMeta, noteSourceMeta, applyFilters, relativeTime } from '../util/notesViewHelpers'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const store = useKnowledgeStore()

const typeMeta = noteTypeMeta
const sourceMeta = noteSourceMeta
const timeAgo = relativeTime

const notes = ref<Note[]>([])
const loading = ref(false)
const fType = ref('')
const fStatus = ref<'active' | 'draft' | 'curated' | 'archived'>('active')
const inboxOpen = ref(true)
const deleting = ref<Note | null>(null)
const bulkConfirming = ref(false)
const notesRoot = ref('')

/** K41 同族(见文件头注释)—— 包内 `Note.tags` 是 `unknown[]`,消费侧一次性
 * 断言式收窄成 `string[]`,蓝本模板直接把它当字符串数组渲染。 */
function tagsOf(n: Note): string[] {
  return n.tags as string[]
}

const filtered = computed<Note[]>(() => applyFilters(notes.value, { type: fType.value, status: fStatus.value }))
const drafts = computed<Note[]>(() => notes.value.filter((n) => n.status === 'draft'))
const counts = computed(() => ({
  draft: notes.value.filter((n) => n.status === 'draft').length,
  curated: notes.value.filter((n) => n.status === 'curated').length,
  archived: notes.value.filter((n) => n.status === 'archived').length,
}))

/** 深链:`editingId` 来自 `route.query.id`。用 computed 直接读 `route.query.id`
 * (而不是在 onMounted 里读一次存进本地变量)—— `route` 是响应式对象,这样
 * 用户直接改地址栏的 `?id=` 也会立刻反映到这里(记忆
 * `newui-router-query-only-no-remount`)。 */
const editingId = computed<string>(() => (route.query.id as string) || '')

/**
 * 蓝本 `watch: { editingId(v) { if (!v) this.reload() } }`(:208-209,N30)——
 * 只在 `id` 变空时重载(从编辑页返回列表),变成另一个非空 id 时不重载,
 * 靠模板里的 `:key="editingId"` 重建 `NoteEditPane`。
 */
watch(editingId, (v) => {
  if (!v) reload()
})

/**
 * 🔴 §5.2 过期守卫(K15 同族第 8 次)—— `reload()` 的 3 个并发入口:setup 顶层
 * 直调(蓝本 created)· 上面的 `watch editingId` · 下面 5 个动作各自的
 * `reload()`。`epoch` 声明在 `<script setup>` 函数体内 == 组件实例作用域
 * (每次挂载都是新的闭包),不是模块级 —— 两个组件实例各自独立计数,互不串号。
 * 判据:若把 `let reloadEpoch = 0` 挪到模块顶层(跨实例共享),两个实例交错时
 * 会互相把对方的响应当成「过期」丢弃,`NotesView.test.ts` 的「两实例交错」用例
 * 会报红(见该测试文件的 RED 探针记录)。
 */
let reloadEpoch = 0

async function reload(): Promise<void> {
  const epoch = ++reloadEpoch
  loading.value = true
  try {
    const list = await service.notes.list({ limit: 200 })
    // 过期:更晚的一发已经把 reloadEpoch 往前推了,这一发是先发后至 —— 不许
    // 覆盖新数据,也不许往下清 loading(那正是骨架提前消失的那个 bug)。
    if (epoch !== reloadEpoch) return
    notes.value = list
    store.setNotesDraftCount(drafts.value.length)
  } catch {
    if (epoch !== reloadEpoch) return
    useToast().show(t('aiKbOpFailed'), 2400)
  }
  if (epoch === reloadEpoch) loading.value = false
}

// 蓝本 created()(:212-216)的等效——setup 顶层直调,一次性发起首次加载 +
// 笔记根目录探测。
reload()
service.notes
  .getSettings()
  .then((s) => {
    notesRoot.value = s.notesRoot
  })
  .catch(() => {
    // 蓝本 :215 空 catch,注释原文 `keep placeholder`。K6:静默兜底,
    // 连 console.error 都不加,照抄。
  })

function openNotesFolder(): void {
  openDirInNewTab(notesRoot.value || '/DATA/Notes')
}

function startCreate(): void {
  router.push({ query: { id: 'new' } })
}

function edit(n: Note): void {
  router.push({ query: { id: n.id } })
}

async function curate(n: Note): Promise<void> {
  try {
    await service.notes.curate(n.id)
    useToast().show(t('aiKbNoteConfirmed'), 2400)
    reload()
  } catch {
    useToast().show(t('aiKbOpFailed'), 2400)
  }
}

/** N31 照抄 —— `Promise.all` 并发确认,没有 `finally`,失败也 `reload()`。
 * 部分成功时(比如 3 条里 1 条后端拒绝):`Promise.all` 整体 reject,只弹一条
 * 失败 toast,但随后的 `reload()` 仍会把已经在后端成功 curate 的那些刷出来
 * ——这是 Vue2 现状,不是可复现的错误行为,不修。 */
async function confirmAll(): Promise<void> {
  const list = drafts.value
  bulkConfirming.value = true
  try {
    await Promise.all(list.map((d) => service.notes.curate(d.id)))
    useToast().show(t('aiKbNtNDraftsConfirmed', { n: list.length }), 2400)
  } catch {
    useToast().show(t('aiKbOpFailed'), 2400)
  }
  bulkConfirming.value = false
  reload()
}

async function archive(n: Note): Promise<void> {
  try {
    await service.notes.archive(n.id)
    useToast().show(t('aiKbNtNoteArchived'), 2400)
    reload()
  } catch {
    useToast().show(t('aiKbOpFailed'), 2400)
  }
}

function archiveInsteadOfDelete(): void {
  const n = deleting.value
  deleting.value = null
  if (n) archive(n)
}

async function confirmDelete(): Promise<void> {
  try {
    // K34 同族:蓝本 `notesApi.remove(this.deleting.id)` 没有空值防御,按
    // 「能保抛就保抛」用非空断言(不是 `?.`/提前 return——那会把蓝本的隐式
    // 抛错静默改成 no-op)。按钮只在删除弹窗内出现,`deleting` 此刻恒非空。
    await service.notes.remove(deleting.value!.id)
    useToast().show(t('aiKbNtNoteDeleted'), 2400)
  } catch {
    useToast().show(t('aiKbOpFailed'), 2400)
  }
  deleting.value = null
  reload()
}

/** K29 同族(SettingsView.vue:349-355 的既定手法)—— reka 的 `DialogRoot` 用
 * `@update:open` 表达「弹窗被关掉了」,蓝本三条关闭路径(× 按钮/取消/点遮罩)
 * 都收敛成 `deleting = null`。 */
function onDeleteOpenChange(v: boolean): void {
  if (!v) deleting.value = null
}
</script>

<template>
  <div class="k-view">
    <NoteEditPane v-if="editingId" :key="editingId" :note-id="editingId" />
    <template v-else>
      <div class="k-scroll">
        <div class="k-scroll-inner kn-notes-col">
          <!-- Selling point: every note is a Markdown file on disk -->
          <div class="kn-pathstrip">
            <KIcon name="folder" :size="14" color="var(--text-tertiary)" />
            <span>
              {{ t('aiKbNtPathLead') }}
              <code>{{ notesRoot || '/DATA/Notes' }}/</code>
              — {{ t('aiKbNtPathTail') }}
            </span>
            <a @click.prevent="openNotesFolder">{{ t('aiKbNtOpenFolder') }} <KIcon name="chev" :size="10" /></a>
          </div>

          <!-- Loading skeleton -->
          <div v-if="loading && !notes.length" class="kn-list">
            <div v-for="i in 4" :key="i" class="kn-note-row" style="cursor: default">
              <div class="k-skel" style="width: 32px; height: 32px; border-radius: 9px" />
              <div style="display: flex; flex-direction: column; gap: 7px">
                <div class="k-skel" :style="{ width: (52 - i * 8) + '%', height: '13px' }" />
                <div class="k-skel" :style="{ width: (72 - i * 6) + '%', height: '11px' }" />
              </div>
              <div class="k-skel" style="width: 52px; height: 11px" />
            </div>
          </div>

          <!-- Empty state -->
          <div v-else-if="!notes.length" class="k-empty">
            <div class="k-empty-illust" style="display: grid; place-items: center">
              <KIcon name="edit" :size="34" color="var(--text-quaternary)" />
            </div>
            <div class="k-empty-title">{{ t('aiKbNtEmptyTitle') }}</div>
            <div class="k-empty-sub">{{ t('aiKbNtEmptySub') }}</div>
            <button class="k-btn primary" @click="startCreate"><KIcon name="plus" :size="13" /> {{ t('aiKbNtNewNote') }}</button>
          </div>

          <template v-else>
            <!-- Draft inbox -->
            <div v-if="drafts.length" class="kn-inbox" :data-open="String(inboxOpen)">
              <div class="kn-inbox-head" @click="inboxOpen = !inboxOpen">
                <div class="kn-inbox-icon"><KIcon name="sparkle" :size="17" /></div>
                <div style="flex: 1; min-width: 0">
                  <div class="kn-inbox-title"><b>{{ drafts.length }}</b> {{ t('aiKbNtInboxTitle') }}</div>
                  <div class="kn-inbox-sub">{{ t('aiKbNtInboxSub') }}</div>
                </div>
                <button class="k-btn primary" style="flex-shrink: 0" :disabled="bulkConfirming" @click.stop="confirmAll">
                  <KIcon name="check" :size="12" /> {{ t('aiKbNtConfirmAll') }} ({{ drafts.length }})
                </button>
                <span class="kn-inbox-chev"><KIcon name="chev" :size="13" /></span>
              </div>
              <template v-if="inboxOpen">
                <div class="kn-inbox-rows">
                  <div v-for="d in drafts" :key="d.id" class="kn-inbox-row">
                    <span class="kn-type-ic" :style="{ background: typeMeta(d.type).color, width: '30px', height: '30px' }">
                      <KIcon :name="typeMeta(d.type).icon" :size="13" stroke-width="2" />
                    </span>
                    <div class="kn-inbox-row-main" @click="edit(d)">
                      <div class="kn-inbox-row-title">{{ d.title }}</div>
                      <div class="kn-inbox-row-desc">{{ d.description }}</div>
                    </div>
                    <span class="kn-inbox-row-time">{{ timeAgo(d.updatedAt) }}</span>
                    <div class="kn-inbox-acts">
                      <button class="kn-act" data-tone="confirm" @click="curate(d)"><KIcon name="check" :size="11" /> {{ t('aiKbNtConfirm') }}</button>
                      <button class="kn-act" data-tone="danger" :title="t('aiKbNtDelete')" @click="deleting = d"><KIcon name="trash" :size="11" /></button>
                    </div>
                  </div>
                </div>
                <div class="kn-inbox-foot">
                  <span class="kn-inbox-foot-hint">{{ t('aiKbNtInboxFootHint') }}</span>
                  <button class="k-btn text" @click="fStatus = 'draft'">{{ t('aiKbNtReviewOneByOne') }} <KIcon name="chev" :size="11" /></button>
                </div>
              </template>
            </div>

            <!-- Toolbar: status pills + type select + new -->
            <div class="kn-toolbar">
              <button class="k-filter-pill" :data-on="String(fStatus === 'active')" @click="fStatus = 'active'">
                {{ t('aiKbAll') }}<span class="k-filter-pill-count">{{ counts.draft + counts.curated }}</span>
              </button>
              <button class="k-filter-pill" :data-on="String(fStatus === 'draft')" @click="fStatus = 'draft'">
                <KIcon name="sparkle" :size="11" />{{ t('aiKbAiDraft') }}
                <span
                  class="k-filter-pill-count"
                  :style="counts.draft ? { background: 'var(--warning-soft)', color: 'var(--warning)' } : null"
                >{{ counts.draft }}</span>
              </button>
              <button class="k-filter-pill" :data-on="String(fStatus === 'curated')" @click="fStatus = 'curated'">
                {{ t('aiKbCurated') }}<span class="k-filter-pill-count">{{ counts.curated }}</span>
              </button>
              <button class="k-filter-pill" :data-on="String(fStatus === 'archived')" @click="fStatus = 'archived'">
                {{ t('aiKbArchived') }}<span class="k-filter-pill-count">{{ counts.archived }}</span>
              </button>
              <select class="k-filt-select" v-model="fType" :title="t('aiKbColType')">
                <option value="">{{ t('aiKbNtAllTypes') }}</option>
                <option v-for="(m, k) in NOTE_TYPES" :key="k" :value="k">{{ t(m.labelKey) }}</option>
              </select>
              <span style="flex: 1" />
              <button class="k-btn primary" @click="startCreate"><KIcon name="plus" :size="13" /> {{ t('aiKbNtNewNote') }}</button>
            </div>

            <!-- List -->
            <div class="kn-list">
              <div v-if="!filtered.length" class="kn-empty-filtered">
                <KIcon name="funnel" :size="22" color="var(--text-quaternary)" />
                {{ t('aiKbNtNoMatch') }}
                <button class="k-btn outline" @click="fType = ''; fStatus = 'active'">{{ t('aiKbClearFilters') }}</button>
              </div>
              <template v-else>
                <div v-for="n in filtered" :key="n.id" class="kn-note-row" :data-s="n.status" @click="edit(n)">
                  <span class="kn-type-ic" :style="{ background: typeMeta(n.type).color, width: '32px', height: '32px' }">
                    <KIcon :name="typeMeta(n.type).icon" :size="14" stroke-width="2" />
                  </span>
                  <div class="kn-note-main">
                    <div class="kn-note-line1">
                      <span class="kn-note-title">{{ n.title }}</span>
                      <span v-if="n.status === 'draft'" class="kn-badge" data-s="draft"><KIcon name="sparkle" :size="9" /> {{ t('aiKbAiDraft') }}</span>
                      <span v-else-if="n.status === 'archived'" class="kn-badge" data-s="archived">{{ t('aiKbArchived') }}</span>
                    </div>
                    <div v-if="n.description" class="kn-note-desc">{{ n.description }}</div>
                    <div class="kn-note-meta">
                      <span>{{ t(typeMeta(n.type).labelKey) }}</span>
                      <span class="sep">·</span>
                      <span class="kn-src"><KIcon :name="sourceMeta(n.createdBy).icon" :size="11" />{{ t(sourceMeta(n.createdBy).labelKey) }}</span>
                      <span v-if="tagsOf(n).length" class="sep">·</span>
                      <span v-for="tg in tagsOf(n)" :key="tg" class="kn-tag">{{ tg }}</span>
                    </div>
                  </div>
                  <div class="kn-note-side" @click.stop>
                    <span class="kn-note-time">{{ timeAgo(n.updatedAt) }}</span>
                    <div class="kn-note-actions">
                      <button v-if="n.status === 'draft'" class="kn-act" data-tone="confirm" @click="curate(n)"><KIcon name="check" :size="11" /> {{ t('aiKbNtConfirm') }}</button>
                      <button v-if="n.status !== 'archived'" class="kn-act" @click="archive(n)">{{ t('aiKbNtArchive') }}</button>
                      <button class="kn-act" data-tone="danger" :title="t('aiKbNtDelete')" @click="deleting = n"><KIcon name="trash" :size="11" /></button>
                    </div>
                  </div>
                </div>
                <div class="kn-list-foot">
                  <KIcon name="layers" :size="12" />
                  {{ t('aiKbNtListFoot', { n: filtered.length }) }}
                </div>
              </template>
            </div>
          </template>
        </div>
      </div>

      <!-- Delete confirm —— reka Dialog 原语,portal 到知识库容器(见文件头注释) -->
      <DialogRoot :open="!!deleting" @update:open="onDeleteOpenChange">
        <DialogPortal to=".knowledge-app" defer>
          <DialogOverlay class="k-modal-bg">
            <DialogContent v-if="deleting" class="k-modal" style="width: min(420px, 100%)" :aria-describedby="undefined">
              <div class="k-modal-head">
                <DialogTitle as-child>
                  <div class="k-modal-title">{{ t('aiKbNtDeleteTitle') }}</div>
                </DialogTitle>
                <button class="k-modal-x" @click="deleting = null"><KIcon name="x" :size="13" /></button>
              </div>
              <div class="k-modal-body">
                <div style="display: flex; gap: 10px; align-items: center">
                  <span class="kn-type-ic" :style="{ background: typeMeta(deleting.type).color, width: '32px', height: '32px' }">
                    <KIcon :name="typeMeta(deleting.type).icon" :size="14" stroke-width="2" />
                  </span>
                  <div style="min-width: 0">
                    <div style="font-size: 13.5px; font-weight: 600">{{ deleting.title }}</div>
                    <div v-if="deleting.path" style="font-family: var(--font-mono); font-size: 11px; color: var(--text-tertiary); margin-top: 2px; word-break: break-all">{{ deleting.path }}</div>
                  </div>
                </div>
                <div style="font-size: 12.5px; color: var(--text-secondary); line-height: 1.6; margin-top: 10px">
                  {{ t('aiKbNtDeleteBody1') }}
                  <b style="color: var(--danger)">{{ t('aiKbNtDeleteBody2') }}</b>
                  {{ t('aiKbNtDeleteBody3') }}
                </div>
              </div>
              <div class="k-modal-foot">
                <button class="k-btn ghost" @click="deleting = null">{{ t('aiKbCancel') }}</button>
                <button class="k-btn outline" @click="archiveInsteadOfDelete">{{ t('aiKbNtArchiveInstead') }}</button>
                <button class="k-btn danger" @click="confirmDelete"><KIcon name="trash" :size="12" /> {{ t('aiKbNtDelete') }}</button>
              </div>
            </DialogContent>
          </DialogOverlay>
        </DialogPortal>
      </DialogRoot>
    </template>
  </div>
</template>
