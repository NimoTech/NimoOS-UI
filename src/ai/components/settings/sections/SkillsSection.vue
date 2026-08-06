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
  打开 `AddSkillModal`)属于 P3b(写操作半),Task 8 已接线,见下方新注释段。

  【颜色】Vue2 :15 `SkillIcon name="search" ... color="var(--text-tertiary)"` 显式传色
  (`.sk-col-search` 容器本身没有给图标定 color 的 CSS 规则,不显式传就会退回
  `currentColor`,视觉上会比 Vue2 深,故按原样显式传 token)。`.icon-btn` 按钮本身
  在 settings-styles.scss:350 已定义 `color: var(--text-secondary)`,刷新/清空按钮
  内的图标走 currentColor 自然继承,不需要再显式传色。

  Vue2 :17-24 那个内联 `style="width: 18px; height: 18px"` 与 :27-29 的
  `style="display: grid; place-items: center; padding: 28px 0"` 都是尺寸/布局,不是
  颜色,原样照抄不违反 color-guard(brief §6.1 点名)。

  零 <style> 块:用到的每个 class(sk-col*/sk-list/sk-col-empty/sk-spinner/icon-btn/
  sk-col-actions/set-split/sk-add-btn)均已存在于 settings-styles.scss(sk-col-actions/
  set-split/icon-btn)与 skills-styles.scss(Task 1/8,其余)。

  ============================================================================
  SP8-P3b Task 8 —— `+` 按钮 + 四个写操作接线(对齐 Vue2 :6-11 顺序、:147-214 四个
  方法体)。

  【单层取数,公共约束 §4 / brief §10.2】三处全部单层取数,不再像 Vue2 那样多剥一层
  `.data`——理由与本文件已有的 `reload()`(偏离 1,上方旧注释段)完全同构:
    - Vue2 :150-151 `const resp = await ai.updateSkill(...); const updated = resp.data`
      → 后端 `route/v2/skills.go:131`(PATCH)走 `h.Get(c)` 返回 **200 裸 skill**,
      共享包已剥过一层 axios,再剥一次恒 `undefined`,`if (idx !== -1 && updated)`
      永假——开关点了列表项不更新(用户体感:开关"点了但没反应",要刷新才能看到)。
    - Vue2 :188 `const sk = resp.data` → 后端 `:105`(POST)**201 裸 skill**,同一缺陷,
      新建成功后 `sk && sk.id` 永假,列表不会追加、也不会选中新技能。
    - DELETE(`:143`)**204 无内容**,Vue2 没有读它的返回值(`:166` 只 `await
      ai.deleteSkill(id)`,本仓同样不读),此处没有偏离,只是一并记录三个端点的
      真实形状。

  【删除后选中项落位,对齐 Vue2 :168-170,brief §10.2 明确点名的条件】只有当删的是
  **当前选中项**才把 `activeId` 落到剩余第一项;删别的项时 `activeId` 不动。

  【onTest 乐观本地值,申报,对齐 Vue2 :204-214,brief §10.2】`onTest()` 就地把当前
  选中项(`activeId` 对应项,由 `TestPanel` 经 `SkillDetail` 转发的 `test` 事件只在
  沙箱**真正成功完成**时才触发——见 `TestPanel.vue` 头注释偏离 D5、`SkillDetail.vue`
  `emit('test')` 转发处注释)`last_used` 改成 `'Just now'`、`calls` 自增 1。这是**乐观
  本地值,不落库**:后端 `service/skills.go:352 RecordRun` 全仓零调用点(grep 确认,
  见任务报告),`reload()`/切换技能/刷新页面都会让这两个字段打回后端原值,乐观更新
  即刻消失。这不是本任务要修的缺陷——公共约束 §3 偏离 4 已把它列为已登记的既有事实
  (「测试次数只在成功完成时 +1」的另一半:后端从不真正记录),此处只是原样保留
  Vue2 的这个本地体感,不新增行为。

  【console.error 不照抄,申报,对齐 Vue2 :139,156,178,196】四个方法(reload 已在
  上方旧偏离 2 里申报过;onToggle/onDelete/onCreate 三处同款)全部不写
  `console.error`——本仓三个兄弟分区(BlacklistSection/ExecutionSection/
  MemorySection)与本文件 P3a 已有的 `reload()` 都没有这个惯例,失败态统一交给
  toast/行内错误呈现,静默吞错已经足够。

  【`+` 按钮不传具名色,对齐公共约束 §3 偏离 8 / brief §10.1】Vue2 :10
  `SkillIcon name="plus" ... color="white"` 不照抄——`AgentIcon` 不传 `color`,走
  `currentColor`,由 `.sk-add-btn { color: var(--text-on-accent) }`
  (skills-styles.scss:193,已确认这条规则里有 `color`)供色。

  【弹窗接线写法,brief §10.3 要求 grep 先例后二选一并说明】`AddSkillModal` 用
  `v-model:open="adding"`(即 `:open="adding"` + `@update:open="adding = $event"`)
  常挂,不套 Vue2 :65-70 的 `v-if="adding"`——理由:`AddSkillModal.vue` 本身已经在
  `watch(() => props.open, ...)` 里对 `!v` 分支做 `resetForm()`(见该文件头注释「非
  拍板偏离但需要说明的实现细节」),它是按「组件常驻、`open` 驱动可见性」这个前提
  设计的;这也是 `ChannelsSection.vue:427`(`SkModal :open="showAdd"`)与
  `SkillDetail.vue`(`SkModal :open="tryModalOpen"`)两处既有先例的统一写法,本文件
  跟随先例,不引入第三种模式。关闭时(`adding` 变 `false`)额外清空 `createError`——
  `AddSkillModal` 只复位它自己的字段,`serverError` 的来源(`createError`)住在本组件,
  不清的话下次打开弹窗会看到上一次的报错残留。
  ============================================================================
-->
<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import type { Skill, SkillFormPayload } from '../../../types/skill'
import { createSkillErrorKey } from '../../../util/skillsErrorKey'
import { useToast } from '../../../../stores/toast'
import AgentIcon from '../../icons/AgentIcon.vue'
import SkillGroup from '../skills/SkillGroup.vue'
import SkillDetail from '../skills/SkillDetail.vue'
import AddSkillModal from '../skills/AddSkillModal.vue'

const { t } = useI18n()
const toast = useToast()

const skills = ref<Skill[]>([])
const loading = ref(true)
const activeId = ref<string | null>(null)
const query = ref('')

// Task 8 新增状态,逐字照 brief §1。
const adding = ref(false)
const saving = ref(false)
const busy = ref<Record<string, boolean>>({})
const createError = ref('')

// 弹窗关闭时清掉行内错误(见文件头注释「弹窗接线写法」末段)。
watch(adding, (v) => {
  if (!v) createError.value = ''
})

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

// 对齐 Vue2 `onToggle`(:147-161)。单层取数(见文件头注释「单层取数」第一条)。
//
// 【P3b 终审 M5 修复】此前 `idx !== -1 && updated` 为假(后端返回意外形状,如空体)
// 时列表不更新,却照样走 `try` 分支底部弹成功 toast——今天 PATCH 恒返 200 裸
// skill 不会触发,但一旦触发,列表原地不动 + 一条"已启用/已暂停"的假成功提示,叠加
// `SkillDetail.vue` D4 的 `watch(enabled)`(等的正是这个 `updated` 落到 props 上)会
// 让 D4 弹窗永远等不到 `enabled` 真的变化、卡在打开状态,用户毫无线索。改成:只有
// 真的替换了列表项才算成功;否则走失败分支(与请求异常同一条 danger toast)。
async function onToggle(id: string, enabled: boolean) {
  busy.value = { ...busy.value, [id]: true }
  try {
    const updated = (await service.ai.updateSkill(id, { enabled })) as Skill | undefined
    const idx = skills.value.findIndex((s) => s.id === id)
    if (idx !== -1 && updated) {
      skills.value.splice(idx, 1, updated)
      toast.show(enabled ? t('aiSkEnabledToast') : t('aiSkPausedToast'))
    } else {
      toast.show(t('aiSkUpdateFailed'), 3000, 'danger')
    }
  } catch {
    toast.show(t('aiSkUpdateFailed'), 3000, 'danger')
  } finally {
    const next = { ...busy.value }
    delete next[id]
    busy.value = next
  }
}

// 对齐 Vue2 `onDelete`(:162-183)。DELETE 是 204 无内容,不读返回值(见文件头注释
// 「单层取数」第三条)。选中项落位条件见文件头注释「删除后选中项落位」。
async function onDelete(id: string) {
  const s = skills.value.find((x) => x.id === id)
  busy.value = { ...busy.value, [id]: true }
  try {
    await service.ai.deleteSkill(id)
    skills.value = skills.value.filter((x) => x.id !== id)
    if (activeId.value === id) {
      activeId.value = skills.value[0]?.id ?? null
    }
    const name = s?.name ?? id
    toast.show(s?.system ? t('aiSkUninstalledName', { name }) : t('aiSkDeletedName', { name }))
  } catch {
    toast.show(t('aiSkDeleteFailed'), 3000, 'danger')
  } finally {
    const next = { ...busy.value }
    delete next[id]
    busy.value = next
  }
}

// 对齐 Vue2 `onCreate`(:184-203)。201 裸 skill(见文件头注释「单层取数」第二条)。
// 失败时**不关弹窗**(用户可改后重试),错误走行内 `createError`,不是 toast
// (brief §10.2/公共约束 §3 偏离 5:HTTP 层失败不回显后端 body,改本地化文案)。
async function onCreate(payload: SkillFormPayload) {
  saving.value = true
  createError.value = ''
  try {
    // `service.ai.createSkill` 的形参类型是 `Record<string, unknown>`(共享包签名,
    // 见 NimoOS-Service/src/ai.ts:337)——`SkillFormPayload` 是具名 interface,不带隐式
    // 索引签名,TS 判定不兼容(TS2345),故转型一次;字段值本身未做任何改动。
    const sk = (await service.ai.createSkill(payload as unknown as Record<string, unknown>)) as Skill | undefined
    if (sk?.id) {
      skills.value.push(sk)
      activeId.value = sk.id
      adding.value = false
      toast.show(t('aiSkAddedName', { name: sk.name }))
    }
  } catch (e) {
    createError.value = t(createSkillErrorKey(e))
  } finally {
    saving.value = false
  }
}

// 对齐 Vue2 `onTest`(:204-214)。乐观本地值,不落库——见文件头注释「onTest 乐观
// 本地值」申报段:后端 RecordRun 全仓零调用点,reload()/切换技能/刷新页面都会让
// 这两个字段打回原值。
function onTest() {
  const idx = skills.value.findIndex((s) => s.id === activeId.value)
  if (idx === -1) return
  const s = skills.value[idx]
  skills.value.splice(idx, 1, {
    ...s,
    last_used: 'Just now',
    calls: (s.calls || 0) + 1,
  })
}
</script>

<template>
  <div class="set-split">
    <div class="sk-col">
      <div class="sk-col-head">
        <div class="sk-col-actions">
          <button class="icon-btn" :title="t('aiCfgRefresh')" @click="reload">
            <AgentIcon name="refresh" :size="15" />
          </button>
          <!-- 对齐 Vue2 :9-11。不传具名 color——见文件头注释「+ 按钮不传具名色」。 -->
          <button class="sk-add-btn" :title="t('aiSkAddSkill')" @click="adding = true">
            <AgentIcon name="plus" :size="15" />
          </button>
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

    <SkillDetail
      :skill="activeSkill"
      :busy="busy"
      @toggle="onToggle"
      @delete="onDelete"
      @test="onTest"
    />

    <AddSkillModal
      v-model:open="adding"
      :saving="saving"
      :server-error="createError"
      @save="onCreate"
    />
  </div>
</template>
