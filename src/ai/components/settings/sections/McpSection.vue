<!--
  SP8-P4 Task 9(收官)—— 1:1 移植自 Vue2 `NimoOS-UI/src/views/AI/MCP/McpSection.vue`
  (136 行)。孪生兄弟是 `./SkillsSection.vue`(SP8-P3a/P3b,已评审通过)——本文件的
  `<script setup>` 写法、四个数据方法(reload/toggle/delete/save)的结构、`+` 按钮
  接线方式全部照它抄,不引入第三种模式。做完本文件,`sections.ts` 的
  `DEFERRED_SECTIONS` 清空——13 个设置分区全部接入真组件。

  【偏离 D1(公共约束 §3 第 1 条,强制,命中两处)】

  1. `reload()` —— Vue2 `:74` `this.servers = resp.data || []`。共享包
     `service.ai.listMCPServers()` 已 `return res.data`(剥过一次 axios 层),后端
     `mcp.go:96` 是 `c.JSON(200, out)` 裸数组,再剥一次在裸数组上恒 `undefined`,
     `this.servers` 就恒为 `[]`(`|| []` 兜底把"取到 undefined"这件事盖住了)——
     服务器列表永远空。本仓直接把返回值当数组用:`Array.isArray(list) ? list : []`
     (与 `SkillsSection.vue` 的 `reload()` 同一模具,同一句写法)。
  2. `onSave` 新建分支 —— Vue2 `:117` `const id = resp.data && resp.data.id`。
     共享包 `service.ai.createMCPServer` 同样已剥过一层,后端 `mcp.go:121` 是
     `201 {"id": <int64>}`——不是完整对象,再剥一次恒 `undefined`,新建成功后
     不会选中新服务器。本仓直接读 `(created as { id?: number })?.id`。

  【偏离 D2(公共约束 §3 第 2 条)】`.sk-toast`(Vue2 `:32-34`,`showToast()`)不
  移植,改用全局 `useToast().show()`。Vue2 的 `.sk-toast` 模板**无条件**渲染绿色
  check 图标(`:33`),连失败提示也顶着一个"成功"勾——这是 Vue2 自己的缺陷,不照抄
  (承 P3a/P3b,与 `SkillsSection.vue` 同款申报)。失败态统一走
  `toast.show(t(...), 3000, 'danger')`,`danger` tier 天然不带勾。

  【偏离 D4(公共约束 §3 第 4 条)】不写 `console.error`(Vue2 `:79,93,105,124` 四处)
  ——本仓三个兄弟分区(BlacklistSection/ExecutionSection/MemorySection)与
  `SkillsSection.vue` 都没有这个惯例,静默吞错 + toast/行内错误呈现已经足够。

  【偏离 D5(公共约束 §3 第 5 条)】`onSave` 失败不再读 Vue2 `:125` 的
  `e.response.data.message`(后端英文原文,界面永不回显原文的硬约束),改用
  `util/mcpErrorKey.ts`(T3)的 `saveServerErrorKey(e)` 映射成 i18n 键,`saveError`
  传给 `McpServerModal` 的 `serverError` prop——**弹窗不关**(用户可改后重试),
  行内展示而不是 toast(承 P3b `SkillsSection.vue` `onCreate` 同款写法)。
  `watch(modalOpen)` 关闭时清 `saveError`(照 `SkillsSection.vue:126-128`)——
  下次打开弹窗不会看到上一次的报错残留。

  【偏离 D7(公共约束 §3 第 7 条)】`+` 按钮的 `AgentIcon` 不传具名色 `color="white"`
  (Vue2 `:7`)——不传 `color`,走 `currentColor`,由 `.sk-add-btn` 的
  `--text-on-accent`(`skills-styles.scss:183` 起)供色,与 `SkillsSection.vue` 同款。

  【N4 照抄不改(公共约束 §3.5 第 4 条,已确认照抄)】`activeServer` 在**未过滤的
  `servers`** 上查(Vue2 `:64`),不是在 `filtered` 上查——搜索时右侧详情面板
  不跟着清空,与 `SkillsSection.vue` 的 `activeSkill` 同款,不是本文件的新决定。

  【删除后选中项落位,对齐 Vue2 `:102`】只有删的是**当前选中项**才把 `activeId`
  落到剩余第一项;删别的项时 `activeId` 不动——与 `SkillsSection.vue` `onDelete`
  同一条件。

  【接口偏离(裁定 3,沿用 T8 `McpServerModal` 的既定接口)】Vue2 是
  `v-if="modalOpen"`(每次打开重建实例,`data()` 天然只跑一次)+ `@close`。本仓
  `McpServerModal` 已经是 `v-model:open` 常挂 + `server`/`serverError` 两个 prop
  的设计(见该文件头注释),`McpSection` 侧只需要在 `openCreate`/`openEdit` 里
  同步设置 `editing` 与 `modalOpen`(同一函数体内先设 `editing.value` 再设
  `modalOpen.value = true`,Vue 的响应式更新会在下一次渲染前把两者一起同步给
  `McpServerModal` 的 `watch(() => props.open, ...)`,不会出现"弹窗先以旧
  server 弹出、下一帧才刷新成新 server"的闪烁)——协调者追加的两条集成用例
  (「编辑 A → 关闭 → 编辑 B」「新增 → 关闭 → 编辑」)钉的正是这条时序。

  【`+` 按钮不传具名色,零 <style> 块】用到的每个类均已存在于既有 scss:
  `set-split`/`sk-col*`/`sk-list`/`sk-col-empty`/`sk-spinner`/`icon-btn`/
  `sk-col-actions`/`sk-add-btn`(`settings-styles.scss`/`skills-styles.scss`,
  与 `SkillsSection.vue` 完全同一组类,已在该文件评审通过)。Vue2 `:13`/`:16`
  的内联 `style="width: 18px; height: 18px"` / `style="display: grid; place-items:
  center; padding: 28px 0"` 是尺寸/布局不是颜色,原样照抄(公共约束 §6 明确允许)。
-->
<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import type { McpServer, McpServerFormPayload } from '../../../types/mcpServer'
import { saveServerErrorKey } from '../../../util/mcpErrorKey'
import { useToast } from '../../../../stores/toast'
import AgentIcon from '../../icons/AgentIcon.vue'
import McpServerGroup from '../mcp/McpServerGroup.vue'
import McpServerDetail from '../mcp/McpServerDetail.vue'
import McpServerModal from '../mcp/McpServerModal.vue'

const { t } = useI18n()
const toast = useToast()

const servers = ref<McpServer[]>([])
const loading = ref(true)
const activeId = ref<number | null>(null)
const query = ref('')

const modalOpen = ref(false)
const editing = ref<McpServer | null>(null)
const saving = ref(false)
const saveError = ref('')

// 弹窗关闭时清掉行内错误(见文件头注释「偏离 D5」末段,照 SkillsSection.vue:126-128),
// 并清掉 editing(修复轮 M5)。
//
// 【修复轮 M5,未申报偏离】Vue2 `closeModal()`(`:85`)是
// `{ this.modalOpen = false; this.editing = null }`——**每一条关闭路径**都清
// `editing`。本仓早前只在 `closeModal()`(见下方,onSave 成功后才调用)里清,
// 取消 / 右上角 X / 遮罩三条关闭路径走的是 `v-model:open` 直接把 `modalOpen`
// 置 false,不经过 `closeModal()`,`editing` 会残留旧值。虽然 `openCreate`/
// `openEdit` 每次都会重新设置 `editing`,`McpServerModal` 的 `watch(open)`
// true 分支也会用 `props.server` 回填,实测无可见后果——但这是一条未在任何
// 报告里申报过的行为差异,按移植纪律「未申报的偏离本身就是缺陷」改正:把清
// `editing` 挪到这个 watch 里,与清 `saveError` 同一处、覆盖全部关闭路径,
// 和 Vue2 `closeModal()` 逐条路径都清的行为对齐。
watch(modalOpen, (v) => {
  if (!v) {
    saveError.value = ''
    editing.value = null
  }
})

// 对齐 Vue2 `computed`(`:57-64`)。
const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return servers.value
  // Vue2 `:60` 只搜 name/url 两个字段,不搜 command——照抄(设计 §5.1)。
  return servers.value.filter(
    (s) => (s.name || '').toLowerCase().includes(q) || (s.url || '').toLowerCase().includes(q),
  )
})
const enabled = computed(() => filtered.value.filter((s) => s.enabled))
const disabled = computed(() => filtered.value.filter((s) => !s.enabled))
// N4 照抄不改(见文件头注释):activeServer 在未过滤的 servers 上查,搜索不清空
// 详情面板。
const activeServer = computed(() => servers.value.find((s) => s.id === activeId.value) || null)

function setActive(id: number) {
  activeId.value = id
}

// 对齐 Vue2 `reload()`(`:70-82`)。
async function reload() {
  loading.value = true
  try {
    // 偏离 D1 第 1 处(见文件头注释):单层取数,不再多剥一层 `.data`。
    const list = await service.ai.listMCPServers()
    servers.value = Array.isArray(list) ? list : []
    // 选中态保持逻辑,对齐 Vue2 `:75-77`:当前选中项还在新列表里就不动,否则落到
    // 第一项(空列表落 null)。
    if (!activeId.value || !servers.value.find((s) => s.id === activeId.value)) {
      activeId.value = servers.value[0]?.id ?? null
    }
  } catch {
    // 偏离 D2/D4(见文件头注释):不写 console.error,失败走全局 danger toast。
    toast.show(t('aiMcpSrvLoadFailed'), 3000, 'danger')
  } finally {
    loading.value = false
  }
}

onMounted(() => reload())

function openCreate() {
  editing.value = null
  modalOpen.value = true
}
function openEdit(server: McpServer) {
  editing.value = server
  modalOpen.value = true
}
function closeModal() {
  modalOpen.value = false
  editing.value = null
}

// 对齐 Vue2 `onToggle`(`:86-96`)。204 无内容,不读返回值。
async function onToggle(id: number, enabledVal: boolean) {
  try {
    await service.ai.updateMCPServer(id, { enabled: enabledVal })
    const idx = servers.value.findIndex((s) => s.id === id)
    if (idx !== -1) servers.value.splice(idx, 1, { ...servers.value[idx], enabled: enabledVal })
    toast.show(enabledVal ? t('aiMcpSrvEnabledToast') : t('aiMcpSrvDisabledToast'))
  } catch {
    toast.show(t('aiMcpSrvUpdateFailed'), 3000, 'danger')
  }
}

// 对齐 Vue2 `onDelete`(`:97-108`)。204 无内容,不读返回值。删除后选中项落位见
// 文件头注释——只有删的是当前选中项才把 activeId 落到剩余第一项。
async function onDelete(id: number) {
  const s = servers.value.find((x) => x.id === id)
  try {
    await service.ai.deleteMCPServer(id)
    servers.value = servers.value.filter((x) => x.id !== id)
    if (activeId.value === id) {
      activeId.value = servers.value[0]?.id ?? null
    }
    toast.show(t('aiMcpSrvRemovedName', { name: s ? s.name : String(id) }))
  } catch {
    toast.show(t('aiCfgDeleteFailed'), 3000, 'danger')
  }
}

// 对齐 Vue2 `onSave`(`:109-128`)。偏离 D1 第 2 处 / D5 见文件头注释。
async function onSave(payload: McpServerFormPayload) {
  saving.value = true
  saveError.value = ''
  try {
    // 共享包形参类型是 `Record<string, unknown>`(NimoOS-Service/dist/ai.d.ts:85-86)
    // ——`McpServerFormPayload` 是具名 interface,不带隐式索引签名,TS 判定不兼容
    // (TS2345),故转型一次;字段值本身未做任何改动(与 SkillsSection.vue
    // `onCreate` 同款说明)。
    if (editing.value) {
      await service.ai.updateMCPServer(editing.value.id, payload as unknown as Record<string, unknown>)
      toast.show(t('aiCfgSaved'))
    } else {
      const created = await service.ai.createMCPServer(payload as unknown as Record<string, unknown>)
      const id = (created as { id?: number } | undefined)?.id
      if (id) activeId.value = id
      toast.show(t('aiMcpSrvAddedName', { name: payload.name }))
    }
    closeModal()
    await reload()
  } catch (e) {
    saveError.value = t(saveServerErrorKey(e))
  } finally {
    saving.value = false
  }
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
          <!-- 对齐 Vue2 :7。不传具名 color——见文件头注释「偏离 D7」。 -->
          <button class="sk-add-btn" :title="t('aiMcpSrvAdd')" @click="openCreate">
            <AgentIcon name="plus" :size="15" />
          </button>
        </div>
      </div>
      <div class="sk-col-search">
        <AgentIcon name="search" :size="13" color="var(--text-tertiary)" />
        <input v-model="query" :placeholder="t('aiMcpSrvSearchPlaceholder')">
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
          <McpServerGroup
            v-if="enabled.length"
            :label="t('aiMcpSrvGroupEnabled')"
            :items="enabled"
            :active-id="activeId"
            @pick="setActive"
          />
          <McpServerGroup
            v-if="disabled.length"
            :label="t('aiMcpSrvGroupDisabled')"
            :items="disabled"
            :active-id="activeId"
            @pick="setActive"
          />
          <div v-if="filtered.length === 0" class="sk-col-empty">
            <template v-if="query">
              {{ t('aiMcpSrvNoMatch') }} <code>{{ query }}</code>
            </template>
            <template v-else>
              {{ t('aiMcpSrvEmpty') }}
            </template>
          </div>
        </template>
      </div>
    </div>

    <McpServerDetail
      :server="activeServer"
      @toggle="onToggle"
      @edit="openEdit"
      @delete="onDelete"
    />

    <McpServerModal
      v-model:open="modalOpen"
      :server="editing"
      :saving="saving"
      :server-error="saveError"
      @save="onSave"
    />
  </div>
</template>
