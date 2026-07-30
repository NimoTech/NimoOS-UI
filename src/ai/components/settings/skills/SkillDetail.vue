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

  【不取,留给 T7】`TestPanel`/`runTest` 占位(:166-167 那处注释)不是本任务范围,
  按协调者要求原样不动。

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

// Vue2 SkillDetail.vue:200-201 `skill: { type: Object, default: null }` +
// `busy: { type: Object, default: () => ({}) }`(飞行中禁用的技能 id 集合,由父组件
// SkillsSection 在 toggle/delete 请求进行中维护,驱动开关的 disabled 态)。
const props = withDefaults(
  defineProps<{ skill: Skill | null; busy?: Record<string, boolean> }>(),
  { busy: () => ({}) },
)

// 对齐 Vue2 :27(`$emit('toggle', …)`)与 :238(`$emit('delete', …)`)。
const emit = defineEmits<{
  (e: 'toggle', id: string, enabled: boolean): void
  (e: 'delete', id: string): void
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

// 外部点击关闭菜单。复用既有 `useClickOutside` composable(见文件头注释「实现选择」)
// 而不是手写 Vue2 :214-225 那份 `watch(menuOpen)` 里条件式 add/removeEventListener。
useClickOutside(menuWrap, () => { menuOpen.value = false })

// `skill.id` 变化时复位菜单与确认弹窗,对齐 Vue2 `watch: { 'skill.id'() { … } }`(:226-229)。
watch(() => props.skill?.id, () => {
  menuOpen.value = false
  confirmOpen.value = false
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

// 对齐 Vue2 :240-242 `tryInChat`。
function tryInChat() {
  if (!props.skill) return
  router.push({ path: '/ai/agent', query: { skill: props.skill.id } })
}
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

          <!-- P3b: TestPanel 插回这里（Vue2 SkillDetail.vue:108-112），夹在「描述」
               与「SKILL.md」之间，见文件头注释。 -->

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
    </template>
  </div>
</template>
