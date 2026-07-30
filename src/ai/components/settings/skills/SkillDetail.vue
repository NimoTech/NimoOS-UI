<!--
  SP8-P3a Task 5 —— 只读半,摘自 Vue2 src/views/AI/Skills/SkillDetail.vue(271 行)。
  本任务只取 brief §5.1 列的子集:空态 / 顶部条(去掉开关与更多菜单)/ 四格元信息 /
  描述段 / SKILL.md 段 / 附带文件段。写操作(开关、更多菜单、复制/导出/删除、
  TestPanel/runTest)全部留给 P3b(brief §5.2),本文件不出现任何相关状态或方法。

  SP8-P3b Task 6 —— 顶部条写操作(开关 + 更多菜单 + 复制/导出)+ 删除/卸载确认弹窗。
  对齐 Vue2 :21-56(顶部条控件)与 :155-184(确认弹窗),细节见下方就地注释。

  【偏离申报 1,公共约束 §3 偏离 12】复制走 `useCopyFeedback`(内部 `copyText` 兜底
  + toast + 打勾态),不照抄 Vue2 :243-253 手写的 `navigator.clipboard` try/catch +
  临时 textarea 那份兜底。

  【偏离申报 2,公共约束 §3 偏离 11 的延伸 / 任务书 6.1 协调者修订】删除确认弹窗不套
  `SkModal`,直接用 reka Dialog 原语(`DialogRoot`/`DialogPortal`/`DialogOverlay`/
  `DialogContent`)在本组件内拼出 Vue2 的确切 DOM——原因见任务书 6.1:`SkModal` 强制
  渲染标题栏+关闭按钮(Vue2 的确认弹窗没有标题栏,标题是 `.sk-confirm-body` 里的
  `<h3>`)、默认插槽套 `.sk-modal-body` 会与 `.sk-confirm-body` 自带 padding 叠加、
  `.sk-modal` 类写死加不上 `.sk-confirm`。`DialogPortal to=".set-app"` 不可省——AI 区
  token 定义在 `.agent-app` 作用域,portal 到 body 会让 `var(--bg-elevated)` 一类全部
  解析失败(同 SkModal.vue 头注释 D1)。无障碍标题用
  `<VisuallyHidden as-child><DialogTitle>`(reka 要求 DialogContent 内必须有
  DialogTitle),先例 `src/home/components/SearchDialog.vue:317`。确认/取消按钮用普通
  `<button>` 手写 `@click`(不用 `AlertDialogAction`/`DialogClose`)——那两个 reka 组件
  模板里硬编码了 `@click="onOpenChange(false)"`,消费者的 `@click` 经 `$attrs` 合并后
  `update:open` 必先于自定义 handler 触发(P1c1 Task 11 踩过的坑);本组件确认按钮的
  handler 直接读 `props.skill.id`,不依赖 `open` 状态,天然不受此坑影响,但仍按
  `SkModal.vue` 关闭按钮的既有写法(纯 `<button @click>`,非 DialogClose)保持一致,
  不引入新模式。

  【实现选择,非行为偏离,类比 SetSwitch.vue 头注释里 v-model/update:modelValue 那条
  "框架 API 差异,非行为改动"】外部点击关闭菜单,复用已有的 `useClickOutside`
  composable(`../../../composables/useClickOutside.ts`,已有先例
  `ModelPicker.vue:26,69`),而不是手写 Vue2 :214-225 那份 `watch(menuOpen)` 里
  条件式 addEventListener/removeEventListener。两者对用户可见行为完全等价(外部
  mousedown 关闭菜单、组件卸载后监听器必移除),`useClickOutside` 用 onMounted/
  onUnmounted 无条件挂/摘,反而**没有** Vue2 那种"仅当 menuOpen 为真才挂监听"的条件
  竞态面(P1c1 Task 7 的泄漏正是出在条件式挂载的时序上)。`skill.id` 变化时复位
  `menuOpen`/`confirmOpen` 仍用独立 `watch`,对齐 Vue2 :226-229。

  【偏离 2(公共约束 §3.2)】Vue2 :30 `SkillIcon` 不移植,统一用
  `../../icons/AgentIcon.vue`(sparkle 图标已有,SkillTile.vue 同款用法）。

  【偏离 4(公共约束 §3.2 / 类型 skill.ts 头注 / util/skillsFormat.ts 头注)】
  Vue2 :79 直接渲染 `skill.trigger_human || skill.trigger`。本仓弃用
  `trigger_human`,改用 `triggerLabel(skill.trigger, skill.name)`:命中则
  `t(key, params)`(slash 分支得到 `/{name}`),未命中（未知 trigger）原样显示
  `skill.trigger`。**本文件不读 `skill.trigger_human` 字段。**

  【颜色改动,公共约束 §6】Vue2 :64-73 的状态圆点是内联 `:style` 现场拼 `rgba(...)`
  (被 color-guard 明令禁止的写法，见约束 §6 第 5 条点名 `SkillDetail.vue:67-72`)。
  这里改成:`.val` 上按 `!skill.enabled` 输出 `data-disabled="true"/"false"`,
  颜色规则全部交给 Task 1 已在 skills-styles.scss:280-316 写好的
  `.sk-meta-cell .val .dot` / `.val[data-disabled="true"] .dot` 静态 CSS —— 本组件的
  `<span class="dot" />` 不再携带任何内联样式或颜色相关 data 属性。

  【last_used 不做映射】照 Vue2 :88 原样 `skill.last_used || '—'`。若后端将来在
  该字段写入英文相对时间串（如 "3 hours ago"），此处需要补一层本地化映射——目前
  后端契约（NimoOS-AI/service/skills.go）该字段就是任意字符串或空串，无需处理。

  【TestPanel 占位】Vue2 :108-112 里 `TestPanel` 夹在「描述」与「SKILL.md」两个
  `.sk-section` 之间。P3a 不渲染它，两段直接相邻；下方模板里留了一行注释标出
  P3b 要插回的确切位置，避免插错顺序。

  SP8-P3b Task 7 —— D4 弹窗(停用技能「在对话中试用」先提示) + 挂 TestPanel。

  【偏离申报 3,公共约束 §3 偏离 3 / 任务书 D4】收 P3a 挂账③:后端
  `NimoOS-AI/service/skills_runtime.go:57` 把 `disabled` 的技能排除出运行时视图,停用
  技能点「在对话中试用」时 `X-Skill-Id` 照发但 agent 找不到 `SKILL.md`,界面零反馈。
  Vue2 `SkillDetail.vue:240-242 tryInChat()` 完全不看 `skill.enabled`,永远直接跳转 ——
  这是要修的可复现错误行为,不是要照抄的“视觉/交互”。改成:`skill.enabled === false`
  时不跳转,改弹一个 D4 确认弹窗(「启用并试用」/取消);`enabled === true` 时行为不变
  (P3a 已实现,直接跳转)。**这个弹窗 Vue2 里完全不存在**(用户 2026-07-30 拍板新增),
  不是复刻目标,所以走标准壳 `SkModal`(见下方「两种弹窗外壳并存」注释),不是本文件里
  删除确认弹窗那套 reka 原语手拼。

  【两种弹窗外壳并存,不是不一致】本文件同时有两套弹窗写法:删除/卸载确认弹窗用裸 reka
  Dialog 原语手拼(见上方「偏离申报 2」),因为它要逐像素复刻 Vue2 一个**没有标题栏**的
  弹窗,`SkModal` 强制渲染标题栏+关闭按钮的形状套不上去;D4 这个弹窗是本期新增、
  Vue2 没有对应物,没有“复刻目标”,所以直接用现成的标准壳 `SkModal`
  (`:open`+`@update:open`+默认插槽+`#footer`,先例 `sections/ChannelsSection.vue:427`),
  拿它自带的 Esc/焦点陷阱/`.set-app` 作用域处理免费。两者选型依据同一条规则:「有逐像素
  复刻目标 → 手拼贴近 Vue2;无复刻目标(本期新增 UI)→ 用标准壳」,不是风格漂移。

  【`pendingTryId` 一次性语义】「启用并试用」发 `emit('toggle', id, true)` 后,必须等
  **父组件真的把这个技能的 `enabled` 改成 true**(toggle 成功)才跳转;toggle 失败时父组件
  不改 `enabled`,`watch` 不会看到值变化,自然不跳转,不需要额外的失败分支。用一个
  `pendingTryId`(记录发起请求那一刻的技能 id,而不是布尔标志)而不是定时器/await emit
  (emit 是同步的、没有返回值,等不到“父组件处理完”这个事实)。三条清除路径:
  ① 跳转前(`watch` 命中 `enabled===true` 且 id 匹配时)立即置空,防止以后这个技能任何
     一次“开关开→用户手动点开”都被误读成“待跳转”而把用户重新导航走;
  ② 点「取消」立即置空;
  ③ `skill.id` 变化时置空(与既有 `menuOpen`/`confirmOpen` 复位共用同一个 watch)—— 这样
     切到另一个技能后,上一个技能的挂号不会残留、也不会在多个 watcher 之间靠触发顺序
     猜测谁先跑:`watch(enabled)` 回调里额外核对 `skill.id === pendingTryId`,两层防御
     叠加,不依赖 Vue 内部 watcher 调度顺序这个实现细节。

  【评审后修订(Important 1,任务书 D4 的简化 vs 设计文档 §9.4 原话)】任务书把
  §9.4「先 `toggle(id, true)`,**成功才跳转**;失败则**留在弹窗** + danger toast,不
  跳转」简化成了「发 toggle 后关弹窗」,只保留了半句(失败不跳转),漏了「成功前弹窗
  必须留在原地」——这是任务书对设计文档的简化遗漏,以设计文档为准:`confirmEnableAndTry`
  不再在发 toggle 那一刻就关 `tryModalOpen`,而是保持打开;`watch(enabled)` 命中
  `id 匹配 && enabled===true` 时**同一步**关弹窗 + 跳转。toggle 失败时 `enabled`
  不变,弹窗因此保持打开,用户可以再点一次「启用并试用」或点「取消」。danger toast
  由父组件(T8 `SkillsSection.onToggle`)负责,本组件不重复发。
  顺带(自主判断范围,非设计文档强制):`busy[skill.id]` 为真(toggle 请求飞行中)时
  「启用并试用」按钮 `disabled`,防止用户在请求还没返回时重复点击、叠加发出多次
  `toggle` 请求。

  零 <style> 块:用到的每个 class(sk-detail*、sk-name、sk-pill-try、sk-meta-grid、
  sk-meta-cell、sk-section*、sk-description、sk-md、sk-file-row、sw、sk-pill-more、
  sk-menu、sk-modal-bg、sk-modal、sk-confirm*、sk-modal-foot、sk-btn)均已存在于
  skills-styles.scss(Task 1)或 sk-shared.scss(既有)。
-->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { service } from '@nimotech/nimoos-service'
import {
  DialogRoot, DialogPortal, DialogOverlay, DialogContent, DialogTitle, VisuallyHidden,
} from 'reka-ui'
import type { Skill } from '../../../types/skill'
import { triggerLabel, authorLabel, fileSizeLabel } from '../../../util/skillsFormat'
import { renderMarkdown } from '../../../markdown/renderMarkdown'
import { useClickOutside } from '../../../composables/useClickOutside'
import { useCopyFeedback } from '../../../composables/useCopyFeedback'
import AgentIcon from '../../icons/AgentIcon.vue'
import SkillTile from './SkillTile.vue'
import SetSwitch from '../SetSwitch.vue'
import SkModal from '../SkModal.vue'
import TestPanel from './TestPanel.vue'

// Vue2 SkillDetail.vue:200-201 `skill: { type: Object, default: null }` +
// `busy: { type: Object, default: () => ({}) }`(飞行中禁用的技能 id 集合,由父组件
// SkillsSection 在 toggle/delete 请求进行中维护,驱动开关的 disabled 态)。
const props = withDefaults(
  defineProps<{ skill: Skill | null; busy?: Record<string, boolean> }>(),
  { busy: () => ({}) },
)

// 对齐 Vue2 :27(`$emit('toggle', …)`)与 :238(`$emit('delete', …)`)。
// `test` 是 T7 新增:把 TestPanel 的 `test`(只在沙箱真正成功完成时才发,见
// TestPanel.vue 头注释偏离 D5)原样往上转发,不在本文件里加任何额外触发条件。
const emit = defineEmits<{
  (e: 'toggle', id: string, enabled: boolean): void
  (e: 'delete', id: string): void
  (e: 'test'): void
}>()

const { t } = useI18n()
const router = useRouter()

// 顶部条「更多」下拉菜单。对齐 Vue2 data() 里的 `menuOpen`(:205)。
const menuOpen = ref(false)
// 删除/卸载确认弹窗。对齐 Vue2 data() 里的 `confirm`(:206,本仓避开与 Vue `computed`
// 内建 confirm 全局同名的歧义,改叫 confirmOpen)。
const confirmOpen = ref(false)
// `.sk-pill-more` 按钮 + `.sk-menu` 下拉的包裹元素,对齐 Vue2 `ref="menuWrap"`(:33)。
const menuWrap = ref<HTMLElement | null>(null)
// D4:停用技能点「在对话中试用」的确认弹窗(Vue2 没有对应物,本期新增,见文件头注释
// 「偏离申报 3」)。
const tryModalOpen = ref(false)
// D4「启用并试用」的一次性挂号:记录发起 toggle 那一刻的技能 id(不是布尔标志),
// 见文件头注释「pendingTryId 一次性语义」。
const pendingTryId = ref<string | null>(null)

// 外部点击关闭菜单。复用既有 `useClickOutside` composable(见文件头注释「实现选择」)
// 而不是手写 Vue2 :214-225 那份 `watch(menuOpen)` 里条件式 add/removeEventListener。
useClickOutside(menuWrap, () => { menuOpen.value = false })

// `skill.id` 变化时复位菜单与确认弹窗,对齐 Vue2 `watch: { 'skill.id'() { … } }`(:226-229)。
// D4:同一处一并复位 tryModalOpen/pendingTryId(清除路径③,见文件头注释)——切到另一个
// 技能后,上一个技能的「启用并试用」挂号不能残留。
watch(() => props.skill?.id, () => {
  menuOpen.value = false
  confirmOpen.value = false
  tryModalOpen.value = false
  pendingTryId.value = null
})

// 复制 SKILL.md 到剪贴板 + 打勾态(偏离申报 1,见文件头注释)。
const { copiedKey, copy: copyToClipboard } = useCopyFeedback()

// 对齐 Vue2 `closeAnd(fn)`(:235):先收起菜单,再执行传入的动作。
function closeAnd(fn?: () => void) {
  menuOpen.value = false
  fn?.()
}

// 对齐 Vue2 菜单第一项 `$emit('toggle', skill.id, !skill.enabled)`(:38)。拆成具名函数
// (而不是模板里内联 `() => emit('toggle', skill.id, !skill.enabled)`)是因为 vue-tsc
// 对 `v-else` 分支里 `skill` 的非空窄化不会穿透进模板内联箭头函数体
// (TS18047 `'skill' is possibly 'null'`),具名函数在 <script> 里用 `props.skill` 重新
// 判空即可规避,行为与内联写法完全等价。
function toggleFromMenu() {
  const s = props.skill
  if (!s) return
  emit('toggle', s.id, !s.enabled)
}

// 对齐 Vue2 `copyMarkdown()`(:243-253)——手写的 clipboard/execCommand 兜底已被
// `useCopyFeedback` 内部的 `copyText` 取代(偏离申报 1)。
function copyMarkdown() {
  copyToClipboard(props.skill?.md ?? '', 'skillmd')
}

// 对齐 Vue2 `exportSkill()`(:255-262):建一个隐藏 `<a>`,靠 `download` 属性触发浏览器
// 下载,而不是导航当前页面。`service.ai.exportSkillURL` 是同步 URL builder(非 axios
// 调用),token 走 `?token=` query 兜底。
function exportSkill() {
  const s = props.skill
  if (!s) return
  const a = document.createElement('a')
  a.href = service.ai.exportSkillURL(s.id)
  a.download = (s.name || 'skill') + '.tar.gz'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

// 对齐 Vue2 `doDelete()`(:236-239)。
function doDelete() {
  const s = props.skill
  if (!s) return
  confirmOpen.value = false
  emit('delete', s.id)
}

// 对齐 Vue2 :79，但输入换成原始 trigger 枚举（偏离 4，见文件头注释）。
const triggerText = computed(() => {
  const s = props.skill
  if (!s) return ''
  const ref = triggerLabel(s.trigger, s.name)
  return ref ? t(ref.key, ref.params ?? {}) : s.trigger
})

// 对齐 Vue2 :83，`authorLabel` 只本地化后端硬编码的字面量 'You'，其余原样显示。
const authorText = computed(() => {
  const s = props.skill
  if (!s) return ''
  const ref = authorLabel(s.author)
  return ref ? t(ref.key) : s.author
})

// 对齐 Vue2 :90 `Number(skill.calls || 0).toLocaleString()`。
const totalCount = computed(() => Number(props.skill?.calls || 0).toLocaleString())

// 顶部条「开关」的 title,对齐 Vue2 :24 `:title="skill.enabled ? $t('Disable') : $t('Enable')"`。
const switchTitle = computed(() => (props.skill?.enabled ? t('aiSkDisable') : t('aiSkEnable')))

// 「更多」菜单第一项(暂停/启用)的文案,对齐 Vue2 :40。
const pauseLabel = computed(() => (props.skill?.enabled ? t('aiSkDisableTemporarily') : t('aiSkEnable')))

// 「更多」菜单危险项 + 确认弹窗的文案:内置技能用「卸载」措辞,用户自建的用「删除」措辞。
// 对齐 Vue2 :53(菜单项)与 :158-179(弹窗标题/正文/按钮),内置那条正文是 D3 改过的
// 实话文案(公共约束 §3 偏离 2:后端只写 uninstalled=1 标记,全仓无恢复接口)。
const dangerMenuLabel = computed(() => (props.skill?.system ? t('aiSkUninstall') : t('aiSkDeleteSkill')))
const confirmTitle = computed(() => (props.skill?.system ? t('aiSkUninstallTitle') : t('aiSkDeleteTitle')))
const confirmBody = computed(() => (props.skill?.system ? t('aiSkUninstallBody') : t('aiSkDeleteBody')))
const confirmButtonLabel = computed(() => (props.skill?.system ? t('aiSkUninstall') : t('aiSkDelete')))

// 对齐 Vue2 :169 `$t('{count} previous runs', { count: Number(skill.calls || 0).toLocaleString() })`。
// 与 totalCount 是同一个格式化公式,分开建一个 computed 只是为了让确认弹窗与 :90 那处
// 元信息格互不影响、各自独立演化(其实当前值恒等,若未来拆开格式化规则不必回头改这里)。
const confirmRunsText = computed(() => t('aiSkNPrevRuns', { count: totalCount.value }))

// 对齐 Vue2 :130 `$t('{n} files', { n: (skill.files || []).length })`（段头 hint，
// 复用 aiSkNFiles —— 与下方单个文件行的 size 本地化是同一个键的两种用法）。
const filesHint = computed(() => t('aiSkNFiles', { n: (props.skill?.files || []).length }))

// 对齐 Vue2 :211（this.skill && this.skill.md || ''）；`renderMarkdown` 内部已做
// DOMPurify 消毒，可安全 v-html。
const mdHTML = computed(() => renderMarkdown(props.skill?.md || ''))

// 对齐 Vue2 :141 `f.size` 原样显示；本仓额外把文件夹的 "(N files)" 格式过一遍
// fileSizeLabel() 做本地化，字节单位（"12 B"/"1.0 KB"）原样透传。
function fileSize(size: string): string {
  const ref = fileSizeLabel(size)
  return ref ? t(ref.key, ref.params ?? {}) : size
}

// 对齐 Vue2 :240-242 `tryInChat`,但收 P3a 挂账③改成正确逻辑(D4,见文件头注释
// 「偏离申报 3」):Vue2 完全不看 `skill.enabled`,永远直接跳转;停用的技能在 agent
// 运行时视图里根本不存在(`skills_runtime.go:57`),跳过去試也没有任何反馈。
// `enabled === true` 时行为不变,直接跳转(P3a 既有实现)。
function tryInChat() {
  const s = props.skill
  if (!s) return
  if (s.enabled === false) {
    tryModalOpen.value = true
    return
  }
  router.push({ path: '/ai/agent', query: { skill: s.id } })
}

// D4「启用并试用」:记下当前技能 id 作为一次性挂号,把意图往上冒泡。**不在这里关
// 弹窗**(评审后修订,见文件头注释「评审后修订」)——设计文档 §9.4 要求「成功才跳转」,
// 弹窗必须保持打开直到父组件真的把 `enabled` 改成 true;失败时弹窗留在原地,用户能
// 再点一次或点取消。是否真的启用成功由父组件(SkillsSection)决定——本组件不直接改
// `skill.enabled`,只观察 props 上的值(下面的 watch)。
function confirmEnableAndTry() {
  const s = props.skill
  if (!s) return
  pendingTryId.value = s.id
  emit('toggle', s.id, true)
}

// D4「取消」:清除路径②(见文件头注释)。不 emit toggle,不跳转。
function cancelTryModal() {
  tryModalOpen.value = false
  pendingTryId.value = null
}

// D4 一次性跳转:只在「当前 props.skill 就是发起挂号的那个技能」且它的 `enabled`
// 变成 true 时才**同一步**关弹窗 + 跳转,随即清空挂号(清除路径①)。toggle 失败时
// 父组件不会把 `enabled` 改成 true,这里就永远不会看到 true,弹窗保持打开
// (评审后修订,见文件头注释)——不需要额外的失败分支/定时器。显式核对
// `s.id === pendingTryId.value` 而不是只信任「skill.id 变化时复位」那处 watch 已经
// 清空了它:两个 watch 都挂在同一个 `props.skill` 上,不依赖 Vue 内部对同一 tick 里
// 多个 watcher 的调度顺序这个实现细节。
watch(() => props.skill?.enabled, (enabled) => {
  const s = props.skill
  if (!s || !pendingTryId.value) return
  if (s.id !== pendingTryId.value) { pendingTryId.value = null; return }
  if (enabled === true) {
    pendingTryId.value = null
    tryModalOpen.value = false
    router.push({ path: '/ai/agent', query: { skill: s.id } })
  }
})
</script>

<template>
  <div class="sk-detail">
    <template v-if="!skill">
      <div class="sk-detail-empty">
        <div class="sk-detail-empty-inner">
          <div class="orb" />
          <div class="empty-title">{{ t('aiSkPickLeft') }}</div>
          <div class="empty-sub">{{ t('aiSkPickLeftSub') }}</div>
        </div>
      </div>
    </template>
    <template v-else>
      <div class="sk-detail-bar">
        <SkillTile :color="skill.color" :icon="skill.icon" :size="28" :radius="8" />
        <div class="sk-name">
          <span>{{ skill.title }}</span>
          <code>{{ skill.name }}</code>
        </div>
        <!-- .sw 开关,对齐 Vue2 :21-28。只接 SetSwitch 的 @change,不接 v-model ——
             状态的真源是父组件列表项里的 skill.enabled,本组件只把意图往上冒泡。 -->
        <SetSwitch
          :model-value="skill.enabled"
          :disabled="!!busy[skill.id]"
          :title="switchTitle"
          @change="emit('toggle', skill.id, !skill.enabled)"
        />
        <button class="sk-pill-try" :title="t('aiSkTryInChat')" @click="tryInChat">
          <AgentIcon name="sparkle" :size="13" />
          {{ t('aiSkTryInChat') }}
        </button>
        <!-- .sk-pill-more + .sk-menu 下拉,对齐 Vue2 :33-56。`menuWrap` 容器包按钮 +
             `v-if="menuOpen"` 的菜单:暂停/启用 · 复制 SKILL.md · 导出技能 · <hr> ·
             危险项(卸载/删除)。 -->
        <div ref="menuWrap" style="position: relative">
          <button class="sk-pill-more" @click="menuOpen = !menuOpen">
            <AgentIcon name="settings" :size="16" />
          </button>
          <div v-if="menuOpen" class="sk-menu">
            <button @click="closeAnd(toggleFromMenu)">
              <AgentIcon name="pause" :size="13" />
              {{ pauseLabel }}
            </button>
            <button @click="closeAnd(copyMarkdown)">
              <AgentIcon name="edit" :size="13" />
              {{ copiedKey === 'skillmd' ? t('aiCopied') : t('aiSkCopyMd') }}
            </button>
            <button @click="closeAnd(exportSkill)">
              <AgentIcon name="download" :size="13" />
              {{ t('aiSkExport') }}
            </button>
            <hr>
            <button data-danger="true" @click="closeAnd(() => { confirmOpen = true })">
              <AgentIcon name="trash" :size="13" />
              {{ dangerMenuLabel }}
            </button>
          </div>
        </div>
      </div>

      <div class="sk-detail-body">
        <div class="sk-detail-inner">
          <div class="sk-meta-grid">
            <div class="sk-meta-cell">
              <div class="lbl">{{ t('aiSkStatus') }}</div>
              <div class="val" :data-disabled="!skill.enabled ? 'true' : 'false'">
                <span class="dot" />
                {{ skill.enabled ? t('aiSkActive') : t('aiSkPaused') }}
              </div>
            </div>
            <div class="sk-meta-cell">
              <div class="lbl">{{ t('aiSkTrigger') }}</div>
              <div class="val">{{ triggerText }}</div>
            </div>
            <div class="sk-meta-cell">
              <div class="lbl">{{ t('aiSkAddedBy') }}</div>
              <div class="val">{{ authorText }}</div>
            </div>
            <div class="sk-meta-cell">
              <div class="lbl">{{ t('aiSkLastRun') }}</div>
              <div class="val">
                {{ skill.last_used || '—' }}
                <span class="total">· {{ t('aiSkNTotal', { count: totalCount }) }}</span>
              </div>
            </div>
          </div>

          <div class="sk-section">
            <div class="sk-section-head">
              <div class="sk-section-title">{{ t('aiSkDescription') }}</div>
              <div class="sk-section-hint">{{ t('aiSkDescHint') }}</div>
            </div>
            <div class="sk-section-body">
              <div class="sk-description">{{ skill.description }}</div>
            </div>
          </div>

          <!-- Vue2 SkillDetail.vue:108-112:TestPanel 夹在「描述」与「SKILL.md」之间。
               :key="skill.id" 对齐 Vue2 :109——切换技能时整个组件销毁重建(TestPanel.vue
               头注释已说明:key 变化不会触发它内部的 skill.id watcher,真正兜底的清理
               落在它自己的 onBeforeUnmount)。test 事件原样转发,见 emits 定义处注释。 -->
          <TestPanel :key="skill.id" :skill="skill" @test="emit('test')" />

          <div class="sk-section">
            <div class="sk-section-head">
              <div class="sk-section-title">SKILL.md</div>
              <div class="sk-section-hint">{{ t('aiSkMdHint') }}</div>
            </div>
            <div class="sk-section-body">
              <div class="sk-md" v-html="mdHTML" />
            </div>
          </div>

          <div class="sk-section">
            <div class="sk-section-head">
              <div class="sk-section-title">{{ t('aiSkBundledFiles') }}</div>
              <div class="sk-section-hint">{{ filesHint }}</div>
            </div>
            <div class="sk-section-body">
              <div
                v-for="(f, i) in (skill.files || [])"
                :key="i"
                class="sk-file-row"
              >
                <div class="ico" />
                <span class="name">{{ f.name }}</span>
                <span class="size">{{ fileSize(f.size) }}</span>
              </div>
              <div
                v-if="!skill.files || skill.files.length === 0"
                class="sk-file-row"
                style="color: var(--text-tertiary)"
              >
                <span class="name">{{ t('aiSkNoBundledFiles') }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 删除/卸载确认弹窗,对齐 Vue2 :155-184。不套 SkModal——reka Dialog 原语直接拼出
           Vue2 的确切 DOM(理由见文件头注释「偏离申报 2」)。 -->
      <DialogRoot :open="confirmOpen" @update:open="confirmOpen = $event">
        <DialogPortal to=".set-app" defer>
          <DialogOverlay class="sk-modal-bg">
            <DialogContent class="sk-modal sk-confirm" :aria-describedby="undefined">
              <VisuallyHidden as-child><DialogTitle>{{ confirmTitle }}</DialogTitle></VisuallyHidden>
              <div class="sk-confirm-body">
                <h3>{{ confirmTitle }}</h3>
                <p>{{ confirmBody }}</p>
                <div class="sk-confirm-skill">
                  <SkillTile :color="skill.color" :icon="skill.icon" :size="28" :radius="8" />
                  <div class="skill-line">
                    <div class="name">{{ skill.name }}</div>
                    <div class="runs">{{ confirmRunsText }}</div>
                  </div>
                </div>
              </div>
              <div class="sk-modal-foot">
                <div class="right">
                  <button class="sk-btn ghost" @click="confirmOpen = false">{{ t('aiCancel') }}</button>
                  <button class="sk-btn danger" @click="doDelete">
                    <AgentIcon name="trash" :size="13" />
                    {{ confirmButtonLabel }}
                  </button>
                </div>
              </div>
            </DialogContent>
          </DialogOverlay>
        </DialogPortal>
      </DialogRoot>

      <!-- D4:停用技能「在对话中试用」先提示(见文件头注释「偏离申报 3」)。这个弹窗
           Vue2 里不存在,没有逐像素复刻目标,所以用标准壳 SkModal,不套上面那份 reka
           原语手拼(两种外壳并存的理由见文件头注释「两种弹窗外壳并存,不是不一致」)。 -->
      <SkModal
        :open="tryModalOpen"
        :title="t('aiSkTryDisabledTitle')"
        @update:open="tryModalOpen = $event"
      >
        <p>{{ t('aiSkTryDisabledBody') }}</p>
        <template #footer>
          <button class="sk-btn ghost" @click="cancelTryModal">{{ t('aiCancel') }}</button>
          <!-- busy[skill.id] 为真时禁用(toggle 请求飞行中),防止重复点击叠加发出多次
               toggle 请求——自主判断范围,见文件头注释「评审后修订」末段。 -->
          <button
            class="sk-btn primary"
            :disabled="!!busy[skill.id]"
            @click="confirmEnableAndTry"
          >{{ t('aiSkTryEnableAndTry') }}</button>
        </template>
      </SkModal>
    </template>
  </div>
</template>
