<!--
  SP8-P3a Task 5 —— 只读半,摘自 Vue2 src/views/AI/Skills/SkillDetail.vue(271 行)。
  本任务只取 brief §5.1 列的子集:空态 / 顶部条(去掉开关与更多菜单)/ 四格元信息 /
  描述段 / SKILL.md 段 / 附带文件段。写操作(开关、更多菜单、复制/导出/删除、
  TestPanel/runTest)全部留给 P3b(brief §5.2),本文件不出现任何相关状态或方法。

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

  【不取，§5.2】`.sw` 开关 · `.sk-pill-more` + `.sk-menu` 下拉 · 删除确认弹窗
  (`.sk-modal-bg`/`.sk-confirm`) · `TestPanel` · `copyMarkdown`/`exportSkill`/
  `runTest`/`doDelete`/`closeAnd` · `menuOpen` 与 document mousedown 监听 ·
  `busy` prop · `watch('skill.id')` 里复位菜单/弹窗的逻辑。全部一个不写。

  零 <style> 块:用到的每个 class（sk-detail*、sk-name、sk-pill-try、sk-meta-grid、
  sk-meta-cell、sk-section*、sk-description、sk-md、sk-file-row）均已存在于
  skills-styles.scss（Task 1）或 sk-shared.scss（既有）。
-->
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import type { Skill } from '../../../types/skill'
import { triggerLabel, authorLabel, fileSizeLabel } from '../../../util/skillsFormat'
import { renderMarkdown } from '../../../markdown/renderMarkdown'
import AgentIcon from '../../icons/AgentIcon.vue'
import SkillTile from './SkillTile.vue'

// Vue2 SkillDetail.vue:200 `skill: { type: Object, default: null }`。
// `busy`（:201）不移植 —— 写操作专用 prop，本任务不涉及任何写操作。
const props = defineProps<{ skill: Skill | null }>()

const { t } = useI18n()
const router = useRouter()

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
        <button class="sk-pill-try" :title="t('aiSkTryInChat')" @click="tryInChat">
          <AgentIcon name="sparkle" :size="13" />
          {{ t('aiSkTryInChat') }}
        </button>
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
    </template>
  </div>
</template>
