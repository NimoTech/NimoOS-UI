<!--
  SP8-P3a Task 6 —— 1:1 移植自 Vue2 src/views/AI/Skills/SkillsSection.vue(226 行,
  只读半)。左列(头部只有刷新按钮 + 搜索框 + 分组列表)+ 右侧 SkillDetail。

  【偏离清单(均按公共约束 §2 三件套申报)】

  1(公共约束 §3 偏离 1 / brief §6.2)—— `reload()` 不再多剥一层 `.data`。
  Vue2 :133-134 写的是 `const resp = await ai.listSkills(); this.skills = resp.data
  || []`,那是把 axios 响应层的 `.data` 当成后端 payload 剥。共享包
  `service.ai.listSkills()`(NimoOS-Service/dist/ai.d.ts:75)已经在内部 `return
  res.data` 剥过一次 axios 层,而后端 `NimoOS-AI/route/v2/skills.go:37` 是
  `c.JSON(200, out)` 裸数组——再取一次 `.data` 在裸数组上恒为 `undefined`,
  `this.skills` 就恒为 `[]`(空数组兜底掩盖了真正取到 undefined 这件事),列表
  永远空。这与 SP8-P2a 验收时修的 `loadAvailableModels`(提交 a942196)是同一个
  缺陷模具:核心字段名≠核心信封层数。此处直接 `await service.ai.listSkills()`
  当数组用,不再有第二层 `.data`。

  2(公共约束 §3 偏离 3)—— `.sk-toast`(Vue2 :72-77,`showToast()`)不移植,改用
  全局 `useToast().show()`。Vue2 加载失败时(`:139-140`)走 `console.error` +
  `showToast('Could not load skills')`,且它的 `.sk-toast` 模板(:73-74)**无条件**
  渲染绿色 check 图标,连失败提示也顶着一个"成功"勾——这是 Vue2 自己的缺陷,不照抄
  (brief §6.2 明确点名)。本仓失败改走 `toast.show(t('aiSkLoadFailed'), 3000,
  'danger')`,`danger` tier 天然不会带勾。`Vue2 :139` 的 `console.error` 同样不照抄
  ——本仓三个兄弟分区(BlacklistSection/ExecutionSection/MemorySection)都没有这个
  惯例,静默吞错 + toast 提示已经足够。

  3(公共约束 §3 偏离 2)—— `SkillIcon.vue` 不移植,统一用 `../../icons/AgentIcon.vue`
  (Task 4/5 已同款处理)。

  4(brief §6.1)—— 左列头部只有刷新按钮。Vue2 :9-11 的 `+` 添加按钮(`adding = true`
  打开 `AddSkillModal`)属于 P3b(写操作半),下方模板里留了占位注释标出插入位置,
  不在本任务渲染 `AddSkillModal`。

  【不取,留给 P3b】`adding`/`saving`/`busy`/`toast`/`toastTimer` 状态、
  `showToast`/`setBusy`/`onToggle`/`onDelete`/`onCreate`/`onTest` 方法、
  `AddSkillModal` 组件、`.sk-toast` 淡入淡出 transition。全部一个不写。

  【颜色】Vue2 :15 `SkillIcon name="search" ... color="var(--text-tertiary)"` 显式传色
  (`.sk-col-search` 容器本身没有给图标定 color 的 CSS 规则,不显式传就会退回
  `currentColor`,视觉上会比 Vue2 深,故按原样显式传 token)。`.icon-btn` 按钮本身
  在 settings-styles.scss:350 已定义 `color: var(--text-secondary)`,刷新/清空按钮
  内的图标走 currentColor 自然继承,不需要再显式传色。

  Vue2 :17-24 那个内联 `style="width: 18px; height: 18px"` 与 :27-29 的
  `style="display: grid; place-items: center; padding: 28px 0"` 都是尺寸/布局,不是
  颜色,原样照抄不违反 color-guard(brief §6.1 点名)。

  零 <style> 块:用到的每个 class(sk-col*/sk-list/sk-col-empty/sk-spinner/icon-btn/
  sk-col-actions/set-split)均已存在于 settings-styles.scss(sk-col-actions/set-split/
  icon-btn)与 skills-styles.scss(Task 1,其余)。
-->
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import type { Skill } from '../../../types/skill'
import { useToast } from '../../../../stores/toast'
import AgentIcon from '../../icons/AgentIcon.vue'
import SkillGroup from '../skills/SkillGroup.vue'
import SkillDetail from '../skills/SkillDetail.vue'

const { t } = useI18n()
const toast = useToast()

const skills = ref<Skill[]>([])
const loading = ref(true)
const activeId = ref<string | null>(null)
const query = ref('')

// 四个 computed,对齐 Vue2 SkillsSection.vue:105-118。
const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return skills.value
  return skills.value.filter(
    (s) =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.title || '').toLowerCase().includes(q) ||
      (s.description || '').toLowerCase().includes(q),
  )
})
const builtIn = computed(() => filtered.value.filter((s) => s.system))
const personal = computed(() => filtered.value.filter((s) => !s.system))
const activeSkill = computed(() => skills.value.find((s) => s.id === activeId.value) || null)

function setActive(id: string) {
  activeId.value = id
}

async function reload() {
  loading.value = true
  try {
    // 单层取数(偏离 1,见文件头注释)——不再多剥一层 `.data`。
    const list = (await service.ai.listSkills()) as Skill[]
    skills.value = Array.isArray(list) ? list : []
    // 选中态保持逻辑,对齐 Vue2 :135-137:当前选中项还在新列表里就不动,否则落到
    // 第一项(空列表落 null)。
    if (!activeId.value || !skills.value.find((s) => s.id === activeId.value)) {
      activeId.value = skills.value[0]?.id ?? null
    }
  } catch {
    // 偏离 2(见文件头注释):Vue2 `console.error` 不照抄,失败走全局 danger toast。
    toast.show(t('aiSkLoadFailed'), 3000, 'danger')
  } finally {
    loading.value = false
  }
}

onMounted(() => reload())
</script>

<template>
  <div class="set-split">
    <div class="sk-col">
      <div class="sk-col-head">
        <div class="sk-col-actions">
          <button class="icon-btn" :title="t('aiCfgRefresh')" @click="reload">
            <AgentIcon name="refresh" :size="15" />
          </button>
          <!-- P3b: 添加技能的 + 按钮插在这里,刷新按钮之后(Vue2 SkillsSection.vue:6-11
               顺序是 refresh → sk-add-btn,`adding = true` 打开 AddSkillModal)。
               本期不渲染。 -->
        </div>
      </div>
      <div class="sk-col-search">
        <AgentIcon name="search" :size="13" color="var(--text-tertiary)" />
        <input v-model="query" :placeholder="t('aiSkSearchPlaceholder')">
        <button
          v-if="query"
          class="icon-btn"
          style="width: 18px; height: 18px"
          @click="query = ''"
        >
          <AgentIcon name="x" :size="10" />
        </button>
      </div>
      <div class="sk-list">
        <div v-if="loading" style="display: grid; place-items: center; padding: 28px 0">
          <div class="sk-spinner" />
        </div>
        <template v-else>
          <SkillGroup
            v-if="builtIn.length"
            :label="t('aiSkBuiltIn')"
            :items="builtIn"
            :active-id="activeId"
            @pick="setActive"
          />
          <SkillGroup
            v-if="personal.length"
            :label="t('aiSkYours')"
            :items="personal"
            :active-id="activeId"
            @pick="setActive"
          />
          <div v-if="filtered.length === 0" class="sk-col-empty">
            <template v-if="query">
              {{ t('aiSkNoMatch') }} <code>{{ query }}</code>
            </template>
            <template v-else>
              {{ t('aiSkEmpty') }}
            </template>
          </div>
        </template>
      </div>
    </div>

    <SkillDetail :skill="activeSkill" />
  </div>
</template>
