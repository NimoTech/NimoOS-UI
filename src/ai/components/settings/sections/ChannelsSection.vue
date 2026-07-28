<!--
  SP8-P2b Task 12 —— 1:1 移植自 Vue2 src/views/AI/Settings/sections/ChannelsSection.vue(410 行)。
  纯函数(bindingLabel / pairInstructions 的 split-join / channelsBotTokenTail 的
  split-join)已由 Task 11 抽到 ../../../util/channelsFormat.ts,这里只保留组件专属状态
  与 i18n 拼接。

  【D2 申报】状态留在组件本地(ref)、直调 service.ai —— 与 Vue2 归属一致(Vue2 data()
  是组件本地状态),不做 store 集中。用户 2026-07-28 拍板(见 BlacklistSection.vue 头
  注释)。

  【D1 申报】Vue2 :46-80(加机器人)与 :140-160(配对码明文)两处手写 `.sk-modal-bg`
  裸 div + `@click.self` 关闭,换成 Task 3 的 SkModal(reka Dialog 外壳,视觉规则不变,
  详见 SkModal.vue 头注释的 D1)。Vue2 `$buefy.dialog.confirm`(:287-293 删机器人、
  :341-347 解绑)→ 共享 AlertDialog。两处都是「纯确认后动作,取消无需复原状态」
  (与 Task 8 开关那种「取消要复原」场景不同,这里不引入 watch(open)+confirmed 标志),
  同 McpTokensSection.vue 的 confirmDeleteOpen/pendingDeleteId 手法。
  Vue2 里 `.chan-x` 关闭按钮 scoped 样式已被 SkModal 内置的 `.sk-x` 收编,这里不再重复
  定义。

  【范围扩张,已申报:样式落点偏离 brief】brief Step 3 原话是把 Vue2 :387-410 那 9 条
  `.chan-*` 规则「一并搬进本组件的 <style scoped>」——但那是 brief 对账前写的,phase-wide
  的既定范式(constraints §4,已被 BlacklistSection/.px-msg 与 McpTokensSection/
  .mcp-label 两次验证)是分区组件零 <style> 块。这里遵从后者、不遵从 brief:9 条规则
  (`.chan-x`/`.chan-x:hover` 已被 SkModal 收编,不搬)移到
  `src/ai/styles/settings-styles.scss`(McpTokensSection 那次的同一落点),回归测试见
  `src/ai/styles/settingsStyles.test.ts` 新增的 ChannelsSection 描述块。值逐字保留,
  Vue2 原 9 条本来就全是 `var(--…)`,无需摘裸色。

  【未移植项,已申报】Vue2 :192-195 有 `watch: { isAdmin(v) { if (v && !this.instances.length)
  this.loadInstances() } } }`,用于「登录后角色从 user 变成 admin」这种运行时切换场景
  补拉一次管理员数据。本仓 isAdmin 是 computed 读 localStorage(见 useSessionStore 头
  注释),同一实例生命周期内不会变(角色切换走整页重载,不存在"同一组件实例内角色跳变"
  的中间态)——这个 watch 在本仓不可能被触发,故不移植,未写对应测试。

  ⚠️ 机器人启用开关是原生 `<input type="checkbox">` 包在 `<label class="chan-switch">`
  里,不是 SetSwitch —— Vue2 就是这么写的(:34-37),照搬,不"顺手统一"成 SetSwitch(界面
  改动,超出移植范围)。
-->
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import { useSessionStore } from '../../../../stores/session'
import { useToast } from '../../../../stores/toast'
import { apiErrorMessage } from '../../../util/apiError'
import { copyText } from '../../../../files/util/clipboard'
import { bindingLabel, fillPairInstructions, fillTokenTail, type ChannelBinding } from '../../../util/channelsFormat'
import { buildCloudModelList, type AgentModel } from '../../../stores/agentStore'
import AgentIcon from '../../icons/AgentIcon.vue'
import ModelPicker from '../../shell/ModelPicker.vue'
import SkModal from '../SkModal.vue'
import AlertDialog from '../../../../components/ui/AlertDialog.vue'

interface ChannelInstance {
  id: string | number
  name?: string
  channel_type?: string
  bot_username?: string
  token_tail?: string
  invite_url?: string
  enabled?: boolean
}

const { t } = useI18n()
const toast = useToast()
const session = useSessionStore()
const isAdmin = computed(() => session.isAdmin)

const pairable = ref<ChannelInstance[]>([])
const pairLoading = ref(false)
const bindings = ref<ChannelBinding[]>([])
const loading = ref(false)
const error = ref(false)
const availableModels = ref<AgentModel[]>([])
const showCode = ref(false)
const revealedCode = ref('')
const codeInstance = ref<ChannelInstance | null>(null)
const instances = ref<ChannelInstance[]>([])
const instLoading = ref(false)
const showAdd = ref(false)
const newName = ref('')
const newToken = ref('')
const newType = ref<'telegram' | 'discord'>('telegram')
const adding = ref(false)
const confirmDeleteBotOpen = ref(false)
const confirmUnbindOpen = ref(false)
const pendingBotId = ref<string | number | null>(null)
const pendingBindingId = ref<string | number | null>(null)

const pairInstructions = computed(() =>
  fillPairInstructions(t('aiCfgChannelsPairInstructions'), codeInstance.value?.bot_username || '', revealedCode.value),
)

// Vue2 是 created() 里同步触发四个加载,本仓用 onMounted —— 两者对本组件等价(无 SSR、
// 不依赖挂载前时序),与其余分区写法统一。见文件头「未移植项」关于 isAdmin watch 的申报。
onMounted(() => {
  void loadPairable()
  void loadBindings()
  void loadModels()
  if (isAdmin.value) void loadInstances()
})

async function loadPairable() {
  pairLoading.value = true
  try {
    const res = (await service.ai.listPairableChannelInstances()) as { instances?: ChannelInstance[] } | null | undefined
    pairable.value = (res && res.instances) || [] // Vue2 :207-208,已剥掉 axios .data 那层(见公共约束 §5)
  } catch {
    pairable.value = []
  } finally {
    pairLoading.value = false
  }
}

async function loadBindings() {
  loading.value = true
  error.value = false
  try {
    const res = (await service.ai.listChannelBindings()) as { bindings?: ChannelBinding[] } | null | undefined
    bindings.value = (res && res.bindings) || [] // Vue2 :219-220
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
}

// Vue2 :227-243:两个独立 try/catch,任一失败不影响另一个。
async function loadModels() {
  const models: AgentModel[] = []
  try {
    const body = (await service.ai.listModels()) as
      | { models?: Array<{ name?: string; size?: number }> }
      | Array<{ name?: string; size?: number }>
      | null
      | undefined
    const list = (body && (Array.isArray(body) ? body : body.models || body)) || []
    for (const m of list as Array<{ name?: string; size?: number }>) {
      if (!m || !m.name) continue
      models.push({ key: 'local:' + m.name, source: 'local', displayName: m.name, size: m.size })
    }
  } catch {
    /* Vue2 :237 local models optional */
  }
  try {
    const provs = await service.ai.listProviders()
    models.push(...buildCloudModelList(provs || []))
  } catch {
    /* Vue2 :241 cloud models optional */
  }
  availableModels.value = models
}

async function loadInstances() {
  instLoading.value = true
  try {
    const res = (await service.ai.listChannelInstances()) as { instances?: ChannelInstance[] } | null | undefined
    instances.value = (res && res.instances) || [] // Vue2 :247-248
  } catch {
    instances.value = []
  } finally {
    instLoading.value = false
  }
}

async function addBot() {
  const token = newToken.value.trim()
  if (!token) return
  adding.value = true
  try {
    await service.ai.createChannelInstance({
      channel_type: newType.value,
      name: newName.value.trim(),
      config: { bot_token: token },
    })
    showAdd.value = false
    newName.value = ''
    newToken.value = ''
    newType.value = 'telegram'
    await loadInstances()
    await loadPairable()
  } catch (e) {
    // Vue2 :270-272 失败时 showAdd 保持 true,不关弹窗
    toast.show(apiErrorMessage(e, t('aiCfgChannelsAddBotFailed')), 3000, 'danger')
  } finally {
    adding.value = false
  }
}

// 遮罩点击 / Esc / 右上 × 与「取消」按钮都只是关闭,不做任何复位(与 Vue2 :46/75 一致:
// 取消不清空表单字段,只有 addBot() 成功时才清空)。
function onAddOpenChange(v: boolean) {
  showAdd.value = v
}

async function toggle(inst: ChannelInstance, enabled: boolean) {
  try {
    await service.ai.setChannelInstanceEnabled(inst.id, enabled)
    inst.enabled = enabled // Vue2 :280 写在 await 之后,失败时不改,开关自然回到原值
    await loadPairable()
  } catch (e) {
    toast.show(apiErrorMessage(e, t('aiCfgSaveFailed')), 3000, 'danger')
  }
}

function confirmDeleteBot(inst: ChannelInstance) {
  pendingBotId.value = inst.id
  confirmDeleteBotOpen.value = true
}

async function onConfirmDeleteBot() {
  const id = pendingBotId.value
  if (id == null) return
  await doDeleteBot(id)
}

async function doDeleteBot(id: string | number) {
  try {
    await service.ai.deleteChannelInstance(id)
    instances.value = instances.value.filter((i) => i.id !== id)
    await loadPairable()
  } catch (e) {
    toast.show(apiErrorMessage(e, t('aiCfgDeleteFailed')), 3000, 'danger')
  }
}

async function genCode(inst: ChannelInstance) {
  try {
    const res = (await service.ai.createChannelPairingCode(inst.id)) as { code?: string } | null | undefined
    revealedCode.value = (res && res.code) || ''
    codeInstance.value = inst
    showCode.value = true
  } catch (e) {
    toast.show(apiErrorMessage(e, t('aiCfgChannelsCreateCodeFailed')), 3000, 'danger')
  }
}

async function setModel(b: ChannelBinding, key: string) {
  try {
    await service.ai.setChannelBindingModel(b.id, key)
    b.default_model = key
    toast.show(t('aiCfgSaved'))
  } catch (e) {
    toast.show(apiErrorMessage(e, t('aiCfgSaveFailed')), 3000, 'danger')
  }
}

async function saveDownloadDir(b: ChannelBinding, dir: string) {
  const v = (dir || '').trim()
  if (!v || v === b.download_dir) return // Vue2 :293
  try {
    await service.ai.setChannelBindingDownloadDir(b.id, v)
    b.download_dir = v
    toast.show(t('aiCfgSaved'))
  } catch (e) {
    toast.show(apiErrorMessage(e, t('aiCfgSaveFailed')), 3000, 'danger')
  }
}

function confirmUnbind(b: ChannelBinding) {
  pendingBindingId.value = b.id
  confirmUnbindOpen.value = true
}

async function onConfirmUnbind() {
  const id = pendingBindingId.value
  if (id == null) return
  await doUnbind(id)
}

async function doUnbind(id: string | number) {
  try {
    await service.ai.deleteChannelBinding(id)
    bindings.value = bindings.value.filter((b) => b.id !== id)
  } catch (e) {
    toast.show(apiErrorMessage(e, t('aiCfgDeleteFailed')), 3000, 'danger')
  }
}

// 三条关闭路径(遮罩/Esc/× 经 update:open,「完成」按钮直调)统一走这里 —— 同
// McpTokensSection.vue 的 onRevealClose/handleRevealOpenChange 先例。清空明文码在
// await 之前(Vue2 :357-364 同序:先 showCode=false,再清 revealedCode/codeInstance,
// 再重拉 bindings)。
async function onCodeClosed() {
  showCode.value = false
  revealedCode.value = ''
  codeInstance.value = null
  await loadBindings()
}

function handleCodeOpenChange(open: boolean) {
  if (!open) void onCodeClosed()
}

async function copy(text: string) {
  try {
    await copyText(text)
    toast.show(t('aiCopied'))
  } catch {
    toast.show(t('aiCfgCopyFailed'), 3000, 'warning')
  }
}
</script>

<template>
  <div class="set-inner">
    <div class="set-page-head">
      <h1 class="set-h1">{{ t('aiCfgChannels') }}</h1>
      <p class="set-desc">{{ t('aiCfgChannelsDesc') }}</p>
    </div>

    <!-- admin bot config -->
    <div v-if="isAdmin" class="sk-section">
      <div class="sk-section-head">
        <div class="sk-section-title">{{ t('aiCfgChannelsAdminTitle') }}</div>
        <div class="sk-section-hint">{{ instances.length }}</div>
        <button class="sk-btn primary" style="margin-left:auto" @click="showAdd = true">
          <AgentIcon name="plus" :size="13" /> {{ t('aiCfgChannelsAddBot') }}
        </button>
      </div>
      <div class="sk-section-body">
        <p class="set-note">{{ t('aiCfgChannelsAdminHint') }}</p>
        <div v-if="instLoading" class="set-note">{{ t('aiCfgLoadingDots') }}</div>
        <div v-else v-for="inst in instances" :key="inst.id" class="tok-row">
          <span class="tok-ic"><AgentIcon name="cloud" :size="16" /></span>
          <div class="tok-body">
            <div class="tok-name">
              {{ inst.name || inst.channel_type }}
              <span v-if="inst.bot_username" class="chan-bot">@{{ inst.bot_username }}</span>
            </div>
            <div class="tok-meta">
              <span>{{ fillTokenTail(t('aiCfgChannelsBotTokenTail'), inst.token_tail || '') }}</span>
              <a
                v-if="inst.invite_url" class="chan-invite" :href="inst.invite_url"
                target="_blank" rel="noopener"
              >{{ t('aiCfgChannelsDiscordInvite') }}</a>
            </div>
          </div>
          <label class="chan-switch">
            <input
              type="checkbox" :checked="inst.enabled"
              @change="toggle(inst, ($event.target as HTMLInputElement).checked)"
            >
            {{ t('aiCfgChannelsEnabled') }}
          </label>
          <button class="tok-del" @click="confirmDeleteBot(inst)">
            <AgentIcon name="trash" :size="13" /> {{ t('aiCfgDelete') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Pair a chat account -->
    <div class="sk-section">
      <div class="sk-section-head">
        <div class="sk-section-title">{{ t('aiCfgChannelsPairTitle') }}</div>
      </div>
      <div class="sk-section-body">
        <div v-if="pairLoading" class="set-note">{{ t('aiCfgLoadingDots') }}</div>
        <div v-else-if="!pairable.length" class="set-note">{{ t('aiCfgChannelsNoBots') }}</div>
        <div v-else class="set-rows">
          <div v-for="inst in pairable" :key="inst.id" class="set-row">
            <div class="lbl">
              {{ inst.name || inst.channel_type }}
              <span v-if="inst.bot_username" class="chan-bot">@{{ inst.bot_username }}</span>
            </div>
            <div class="val">
              <button class="sk-btn primary" @click="genCode(inst)">
                <AgentIcon name="plus" :size="13" /> {{ t('aiCfgChannelsGenerateCode') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- My linked accounts -->
    <div class="sk-section">
      <div class="sk-section-head">
        <div class="sk-section-title">{{ t('aiCfgChannelsBindingsTitle') }}</div>
        <div class="sk-section-hint">{{ bindings.length }}</div>
      </div>
      <div class="sk-section-body">
        <div v-if="loading" class="set-note">{{ t('aiCfgLoadingDots') }}</div>
        <div v-else-if="error" class="set-note">{{ t('aiCfgLoadFailed') }}</div>
        <div v-else-if="!bindings.length" class="set-note">{{ t('aiCfgChannelsNoBindings') }}</div>
        <div v-else v-for="b in bindings" :key="b.id" class="tok-row">
          <span class="tok-ic"><AgentIcon name="user" :size="16" /></span>
          <div class="tok-body">
            <div class="tok-name">{{ bindingLabel(b, t('aiCfgNoLabel')) }}</div>
            <div class="tok-meta">
              <span>{{ b.instance_name || b.channel_type }}</span>
              <span class="sep" />
              <span class="chan-model-lbl">{{ t('aiCfgChannelsBindingDefaultModel') }}:</span>
              <ModelPicker
                :available-models="availableModels" :selected-key="b.default_model || null"
                @select="(k) => setModel(b, k)"
              />
              <span class="sep" />
              <span class="chan-model-lbl">{{ t('aiCfgChannelsBindingDownloadDir') }}:</span>
              <input
                class="set-input" style="width:220px" :value="b.download_dir"
                @change="saveDownloadDir(b, ($event.target as HTMLInputElement).value)"
              >
            </div>
          </div>
          <button class="tok-del" @click="confirmUnbind(b)">
            <AgentIcon name="trash" :size="13" /> {{ t('aiCfgChannelsUnbind') }}
          </button>
        </div>
      </div>
    </div>

    <!-- add-bot modal -->
    <SkModal :open="showAdd" :title="t('aiCfgChannelsAddBot')" @update:open="onAddOpenChange">
      <div class="sk-field">
        <label class="sk-field-label">{{ t('aiCfgChannelsBotType') }}</label>
        <div class="chan-type-row">
          <button
            type="button" class="chan-type-opt" :data-active="newType === 'telegram'"
            @click="newType = 'telegram'"
          >{{ t('aiCfgChannelsTypeTelegram') }}</button>
          <button
            type="button" class="chan-type-opt" :data-active="newType === 'discord'"
            @click="newType = 'discord'"
          >{{ t('aiCfgChannelsTypeDiscord') }}</button>
        </div>
      </div>
      <div class="sk-field">
        <label class="sk-field-label">{{ t('aiCfgChannelsBotName') }}</label>
        <input type="text" v-model="newName" maxlength="64">
      </div>
      <div class="sk-field">
        <label class="sk-field-label">{{ t('aiCfgChannelsBotToken') }}</label>
        <input type="text" v-model="newToken">
        <p class="chan-field-hint">
          {{ newType === 'discord' ? t('aiCfgChannelsBotTokenDiscordHint') : t('aiCfgChannelsBotTokenTelegramHint') }}
        </p>
        <p v-if="newType === 'discord'" class="chan-field-hint">{{ t('aiCfgChannelsDiscordPairNote') }}</p>
      </div>
      <template #footer>
        <button class="sk-btn ghost" @click="showAdd = false">{{ t('aiCancel') }}</button>
        <button class="sk-btn primary" :disabled="!newToken.trim() || adding" @click="addBot">
          {{ t('aiCfgChannelsAddBot') }}
        </button>
      </template>
    </SkModal>

    <!-- pairing-code reveal modal -->
    <SkModal :open="showCode" :title="t('aiCfgChannelsCodeTitle')" @update:open="handleCodeOpenChange">
      <p class="chan-modal-warn">{{ t('aiCfgChannelsCodeWarn') }}</p>
      <div class="set-copy">
        <input class="set-input full mono" :value="revealedCode" readonly>
        <button class="set-copybtn" @click="copy(revealedCode)">
          <AgentIcon name="copy" :size="13" /> {{ t('aiCopy') }}
        </button>
      </div>
      <p class="chan-modal-hint">{{ pairInstructions }}</p>
      <template #footer>
        <button class="sk-btn primary" @click="onCodeClosed">{{ t('aiDone') }}</button>
      </template>
    </SkModal>

    <AlertDialog
      v-model:open="confirmDeleteBotOpen"
      :title="t('aiCfgDelete')"
      :message="t('aiCfgChannelsDeleteBotConfirm')"
      :confirm-text="t('aiCfgDelete')"
      :cancel-text="t('aiCancel')"
      destructive
      @confirm="onConfirmDeleteBot"
    />

    <AlertDialog
      v-model:open="confirmUnbindOpen"
      :title="t('aiCfgChannelsUnbind')"
      :message="t('aiCfgChannelsUnbindConfirm')"
      :confirm-text="t('aiCfgChannelsUnbind')"
      :cancel-text="t('aiCancel')"
      destructive
      @confirm="onConfirmUnbind"
    />
  </div>
</template>
