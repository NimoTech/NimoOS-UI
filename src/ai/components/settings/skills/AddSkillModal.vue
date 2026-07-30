<!--
  SP8-P3b Task 5 —— 1:1 移植自 Vue2 src/views/AI/Skills/AddSkillModal.vue(188 行)。

  外壳换成 SkModal(reka Dialog),不照抄 Vue2 裸 `.sk-modal-bg` + `@click.self`
  (P2b Task 3 已定先例,视觉规则不变)。footer 用 SkModal 本任务新加的 `footerLeft`
  插槽承载「保存在这台 NAS 本地」说明,`footer` 插槽承载取消/创建两个按钮 —— 对齐
  Vue2 :96-108 的两栏布局(左 `.save-note`,右 `.right`),详见 SkModal.vue 头注释。

  ===== 三处拍板偏离(逐条三件套,公共约束 §3.6/3.7/3.8,brief §5.1)=====

  【偏离 1 —— 颜色圆点不用内联 :style】
  Vue2 :56-64 用 `:style="{ background: c.bg }"` 内联传渐变字符串,本仓禁内联颜色
  (公共约束 §6)。改 `:data-color="id"`,底色由 T1 埋进 skills-styles.scss:717-723 的
  7 条 `[data-color=…]` 规则供(值为 P3a Task 1 建的 `--grad-sk-*` token)。选中态仍走
  `:data-active`,与 Vue2 :60 语义一致。

  【偏离 2 —— 提交前本地校验】
  Vue2 :173-174 `submit()` 只查 `!this.valid`(两字段非空),填完一整屏才被后端一句英文
  顶回来。这里 submit() 先跑 T2 的 `validateSkillForm(name, description)`(逐条对齐后端
  skills_store.go 的校验规则),非 null 则把对应 i18n 键渲染进 `.sk-field-err`(落在
  `.sk-modal-body` 顶部,先于所有字段)。`valid`(按钮禁用条件,:137-139)仍只查两字段
  非空 —— 完整校验只在点击时跑,不塞进禁用态,否则用户不知道为什么点不动。
  `serverError` prop 与本地校验错误显示在同一个位——本地校验通不过时不会发请求,两者
  天然互斥,不需要额外的优先级判断。

  【偏离 3 —— >1 MiB 文件不再静默丢弃】
  Vue2 :164-167 `f.size > 1024*1024` 直接 `continue`,用户看不到文件消失。这里改为累计
  跳过数(`skippedCount`),达到 >0 时在文件字段下方追加一条 `.sk-field-hint`,文案
  `aiSkFilesSkippedTooBig`(先例:P1c1 附件管线的 500 MB 门)。

  ===== reka 初始焦点实测结论(任务书要求先实测,不要照猜)=====
  用 SkModal.vue 现有测试同款手法起了一个探针挂载(mount 后连续 `nextTick` 查
  `document.activeElement`):reka Dialog 的 FocusScope 默认把 mount-auto-focus 落在
  DialogContent 内**第一个可聚焦元素**——本组件里那是 SkModal 内置的 `.sk-x` 关闭按钮
  (它在 DOM 顺序上先于本组件的名称输入框),不是名称框。与 Vue2 :133-135「打开即聚焦
  名称输入框」不一致,所以需要显式 `focus()`。
  但进一步实测发现:reka 的 auto-focus 分派发生在 `FocusScope` 自己的
  `watchEffect(async () => { await nextTick(); ...dispatchMountAutoFocus... })` 里,
  与本组件在 `watch(() => props.open, ...)` 里同样用 `nextTick()` 再 `focus()` 是**同一
  微任务级时序在赛跑**——实测两者谁赢不确定(在 jsdom 环境下 reka 的分派后跑,直接抢回
  `.sk-x`)。改成宏任务级延迟(`setTimeout(fn, 0)`)后实测稳定胜出、落在名称输入框上,
  不再被 reka 的默认行为抢走(不修改 SkModal 本身的默认聚焏逃辑,只在本组件里用更晚的
  时机覆盖它,不影响 ChannelsSection/McpTokensSection 两个既有消费方的默认聚焦)。

  ===== 非「拍板偏离」但需要说明的实现细节 =====
  Vue2 每次打开这个弹窗都是父级 `v-if` 重新创建一份组件实例(`mounted()` 天然只跑一次,
  表单永远从空白开始)。本组件走 SkModal 的 `open` prop 控制可见性,组件实例本身是
  常驻的,不会随每次打开/关闭重新创建——若不显式复位,「取消」后再次打开会看到上一次
  残留的输入。这不是新增行为,是为了在架构变化后仍旧还原 Vue2 那个「每次打开都是空表单」
  的可见行为:`watch(open)` 在关闭时（`v === false`）复位全部字段,不在这里额外申报为
  行为偏离。
-->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import SkModal from '../SkModal.vue'
import AgentIcon from '../../icons/AgentIcon.vue'
import { SKILL_COLOR_IDS } from './SkillTile.vue'
import { validateSkillForm } from '../../../util/skillsErrorKey'
// SP8-P3b Task 8 —— 协调者预先解歧义①:`SkillFormPayload`/`SkillScript` 挪到
// `types/skill.ts` 并导出(纯搬移,字段未改),供 `SkillsSection.vue` 的 `onCreate`
// 标注 `@save` payload 类型。见 skill.ts 头注释「Task 8」段。
import type { SkillFormPayload } from '../../../types/skill'

interface PickedFile { name: string; content: string; size: number }

const props = defineProps<{ open: boolean; saving: boolean; serverError: string }>()
const emit = defineEmits<{
  (e: 'update:open', v: boolean): void
  (e: 'save', payload: SkillFormPayload): void
}>()

const { t } = useI18n()

const name = ref('')
const description = ref('')
const trigger = ref<'auto' | 'slash' | 'manual'>('auto')
const color = ref<string>(SKILL_COLOR_IDS[0]) // Vue2 data() color: 'blue' —— 首个 id 即 blue
const md = ref('')
const files = ref<PickedFile[]>([])
const skippedCount = ref(0)
const localErrorKey = ref('')

const nameInputEl = ref<HTMLInputElement | null>(null)
const filesInputEl = ref<HTMLInputElement | null>(null)

// Vue2 :137-139 —— 按钮禁用条件只查两字段非空,完整校验只在 submit() 时跑。
const valid = computed(() => name.value.trim().length > 0 && description.value.trim().length > 0)

// 偏离 2:本地校验错误优先显示;两者互斥(本地校验不过就不会发请求,serverError 不会
// 与本地错误同时非空)。
const errorText = computed(() => (localErrorKey.value ? t(localErrorKey.value) : props.serverError || ''))

// 对齐 ChannelsSection.vue:176-177 的既定手法——用户一动字段就撤掉旧错误,免得改完
// 还挂着上一次的红字。
watch([name, description], () => { localErrorKey.value = '' })

const triggerOptions: { id: 'auto' | 'slash' | 'manual'; nameKey: string; descKey: string }[] = [
  { id: 'auto', nameKey: 'aiSkTrigOptAuto', descKey: 'aiSkTrigDescAuto' },
  { id: 'slash', nameKey: 'aiSkTrigOptSlash', descKey: 'aiSkTrigDescSlash' },
  // 手动选项名复用 aiSkTagManual(与技能列表的「手动」标签同一个词,Vue2 :147 用的也是
  // 同一个 $t('Manual')),公共约束 §7 点名的可复用键之一。
  { id: 'manual', nameKey: 'aiSkTagManual', descKey: 'aiSkTrigDescManual' },
]

// Vue2 :150-153 computed mdPlaceholder。
const mdPlaceholder = computed(() => {
  const head = name.value.trim() || t('aiSkMdPlaceholderHead')
  return `## ${head}\n\n${t('aiSkMdPlaceholderBody')}`
})

function resetForm() {
  name.value = ''
  description.value = ''
  trigger.value = 'auto'
  color.value = SKILL_COLOR_IDS[0]
  md.value = ''
  files.value = []
  skippedCount.value = 0
  localErrorKey.value = ''
  if (filesInputEl.value) filesInputEl.value.value = ''
}

watch(
  () => props.open,
  (v) => {
    if (!v) {
      resetForm()
      return
    }
    // 显式聚焦名称输入框,对齐 Vue2 :133-135。见头注释「reka 初始焦点实测结论」——
    // 必须是宏任务级延迟才能稳定压过 reka FocusScope 自己的 mount-auto-focus。
    setTimeout(() => { nameInputEl.value?.focus() }, 0)
  },
  { immediate: true },
)

async function onFilesPicked(e: Event) {
  const input = e.target as HTMLInputElement
  const list = Array.from(input.files || [])
  const out: PickedFile[] = []
  let skipped = 0
  for (const f of list) {
    if (f.size > 1024 * 1024) {
      // 偏离 3:Vue2 :164-167 直接 continue 静默丢弃,这里累计跳过数,行内提示。
      skipped++
      continue
    }
    const text = await f.text()
    out.push({ name: f.name, content: text, size: f.size })
  }
  files.value = out
  skippedCount.value = skipped
}

function submit() {
  if (!valid.value) return
  const key = validateSkillForm(name.value, description.value)
  if (key) {
    localErrorKey.value = key
    return
  }
  localErrorKey.value = ''
  emit('save', {
    name: name.value.trim(),
    title: name.value.trim(),
    description: description.value.trim(),
    trigger: trigger.value,
    color: color.value,
    md: md.value.trim(),
    examples: [],
    scripts: files.value.map((f) => ({ path: 'scripts/' + f.name, content: f.content })),
  })
}

function onCancel() {
  emit('update:open', false)
}
</script>

<template>
  <SkModal :open="props.open" :title="t('aiSkAddTitle')" @update:open="(v) => emit('update:open', v)">
    <p v-if="errorText" class="sk-field-err" role="alert">{{ errorText }}</p>

    <div class="sk-field">
      <label class="sk-field-label">{{ t('aiSkFieldName') }}</label>
      <input
        ref="nameInputEl"
        type="text"
        :placeholder="t('aiSkNamePlaceholder')"
        v-model="name"
        @keydown.enter.prevent
      >
      <div class="sk-field-hint">{{ t('aiSkNameHint') }}</div>
    </div>

    <div class="sk-field">
      <label class="sk-field-label">{{ t('aiSkDescription') }}</label>
      <textarea :placeholder="t('aiSkDescPlaceholder')" v-model="description" />
      <div class="sk-field-hint">{{ t('aiSkDescFormHint') }}</div>
    </div>

    <div class="sk-field">
      <label class="sk-field-label">{{ t('aiSkTrigger') }}</label>
      <div class="sk-trig-options">
        <button
          v-for="o in triggerOptions" :key="o.id" type="button" class="sk-trig-option"
          :data-active="trigger === o.id ? 'true' : 'false'"
          @click="trigger = o.id"
        >
          <span class="name">{{ t(o.nameKey) }}</span>
          <span class="desc">{{ t(o.descKey) }}</span>
        </button>
      </div>
    </div>

    <div class="sk-field">
      <label class="sk-field-label">{{ t('aiSkFieldColor') }}</label>
      <div class="sk-color-row">
        <div
          v-for="id in SKILL_COLOR_IDS" :key="id" class="sk-color-dot"
          :data-color="id"
          :data-active="color === id ? 'true' : 'false'"
          @click="color = id"
        />
      </div>
    </div>

    <div class="sk-field">
      <label class="sk-field-label">
        SKILL.md
        <span class="sk-field-optional">({{ t('aiSkOptional') }})</span>
      </label>
      <textarea
        v-model="md"
        :placeholder="mdPlaceholder"
        style="min-height: 110px; font-family: var(--font-mono); font-size: 12.5px"
      />
    </div>

    <div class="sk-field">
      <label class="sk-field-label">
        {{ t('aiSkScriptFiles') }}
        <span class="sk-field-optional">({{ t('aiSkOptional') }})</span>
      </label>
      <input ref="filesInputEl" type="file" multiple @change="onFilesPicked">
      <div class="sk-field-hint">{{ t('aiSkScriptsHint') }}</div>
      <div v-if="skippedCount > 0" class="sk-field-hint">{{ t('aiSkFilesSkippedTooBig', { n: skippedCount }) }}</div>
      <ul v-if="files.length" style="font-size: 12px; color: var(--text-tertiary); margin-top: 6px">
        <li v-for="f in files" :key="f.name">{{ f.name }} — {{ f.size }} B</li>
      </ul>
    </div>

    <template #footerLeft>
      <span class="save-note">
        <AgentIcon name="check" :size="11" />
        {{ t('aiSkSavedLocally') }}
      </span>
    </template>
    <template #footer>
      <button type="button" class="sk-btn ghost" @click="onCancel">{{ t('aiCancel') }}</button>
      <button type="button" class="sk-btn primary" :disabled="!valid || props.saving" @click="submit">
        <AgentIcon name="plus" :size="13" />
        {{ props.saving ? t('aiSkCreating') : t('aiSkCreate') }}
      </button>
    </template>
  </SkModal>
</template>
