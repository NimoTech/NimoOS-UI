<script setup lang="ts">
// VM 设置弹窗:两个 tab(通用/快照),本组件实现「通用」半 + 两个 tab 的壳。视觉 1:1 对
// Vue2 KVMFullPage.vue 模板 :230-393(head+tabs :231-252 / General section :255-325 /
// foot :387-391),逻辑对 showSettings(:1202-1221)/saveSettings(:1494-1514)/
// onOSSelect 的 settings 分支(:1378-1381)。
//
// Task 10:快照 tab 的真身是 `snapshots` 具名插槽的**默认内容**(SnapshotsTab 组件),
// 不是父组件从外面塞进来的——本组件本来就不持有 useSnapshots 实例(那份数据层同
// isoList/hostInfo 一样由 KvmPage 创建、随页面生命周期存活),所以直接把 SnapshotsTab
// 的五个 props/三个 emit 原样转发穿透(snapshots/snapshotsBusy/snapshotSubmitError 三个
// 新 prop + vmId/vmState 直接读 props.vm 派生,不需要单独再传)。留一个具名插槽而不是
// 焊死,是为了不破坏 Task 9 已经定型的"插槽机制本身"这条测试覆盖(见下方模板注释)。
//
// 表单编辑用一份本地副本(form,reactive),不直接绑定 props.vm 的字段——理由同
// CreateVmDialog / KvmGlobalSettingsDialog:Global Constraint #16 在本组件**确实适用**
// (与 Task 7 的创建弹窗不同):表单从 props.vm 回填,而 useVmList.update 成功后会把
// 结果写回**选中的 VM 对象**(照 Vue2 saveSettings :1503-1508)。如果表单直接双向绑定
// props.vm 的字段,用户改了值又点 ✕ 取消,脏值会直接污染共享的 VM 对象(不像
// KvmGlobalSettingsDialog 污染的是 composable 内部 ref,这里污染的是调用方持有的同一个
// 对象引用,污染面更直接)。见底部测试文件里 Global Constraint #16 那条用例 + 变异验证。
import { reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { KvmVM, KvmUpdateVMRequest } from '@nimotech/nimoos-service'
import KvmDialog from './KvmDialog.vue'
import SnapshotsTab from './SnapshotsTab.vue'
import type { SelectedOs } from './OsSelector.vue'
import type { KvmHostReadonly } from '../composables/useKvmHostInfo'
import { formatHostMem } from '../util/format'
import type { KvmSnapshot } from '@nimotech/nimoos-service'

const props = defineProps<{
  open: boolean
  vm: KvmVM
  host: KvmHostReadonly
  selectedOs: SelectedOs | null
  saving: boolean
  submitError: string
  // P6 Task 10:快照 tab 需要的四样,原样转发给 SnapshotsTab——本组件不持有快照数据层
  // (useSnapshots 由 KvmPage 创建、随页面生命周期存活,同 isoList/hostInfo 的既有惯例)。
  snapshots: KvmSnapshot[]
  snapshotsBusy: boolean
  snapshotSubmitError: string
}>()

const emit = defineEmits<{
  'update:open': [v: boolean]
  'open-os-selector': []
  submit: [patch: KvmUpdateVMRequest]
  'tab-change': [tab: 'general' | 'snapshots']
  'create-snapshot': [payload: { name: string; description: string }]
  'confirm-delete-snapshot': [s: KvmSnapshot]
  'confirm-restore-snapshot': [s: KvmSnapshot]
}>()

const { t } = useI18n()

const activeTab = ref<'general' | 'snapshots'>('general')

function selectTab(tab: 'general' | 'snapshots'): void {
  activeTab.value = tab
  emit('tab-change', tab)
}

// 本地表单副本。字段集与 Vue2 settingsForm(:629-639)一致,但**不含** diskUsedPercent——
// 那是纯展示值(disk 用量百分比),不是可编辑/可提交字段,直接读 props.vm.diskUsedPercent
// 展示即可,不需要进本地副本(读不写,不存在 Global Constraint #16 的污染风险)。
const form = reactive({
  name: '',
  vcpu: 0,
  memory: 0,
  disk: 0,
  iso: '',
  bootFromDisk: false,
  firmware: 'bios',
  networkMode: 'nat',
})

// 打开弹窗时从 props.vm 回填。照 Vue2 showSettings(:1208-1216):tab 复位到 general,
// networkMode 映射照 :1215(`vm.networkMode === 'bridge' ? (vm.networkInterface ||
// 'nat') : 'nat'`)。immediate:true 让"直接以 open=true 挂载"的场景(测试即如此)也走
// 一遍回填。
watch(() => props.open, (isOpen) => {
  if (!isOpen) return
  activeTab.value = 'general'
  const vm = props.vm
  form.name = vm.name
  form.vcpu = vm.vcpu
  form.memory = vm.memory
  form.disk = vm.disk
  form.iso = vm.iso || ''
  form.bootFromDisk = vm.bootFromDisk || false
  form.firmware = vm.firmware || 'bios'
  form.networkMode = vm.networkMode === 'bridge' ? (vm.networkInterface || 'nat') : 'nat'
}, { immediate: true })

// 选中 OS 后的联动。照 Vue2 onOSSelect 的 settings 分支(:1378-1381 / :1424-1427,两处
// isLocal/官方模板分支逻辑完全相同,合并成一条规则):`settingsOS = os; settingsForm.iso =
// os.path; settingsForm.bootFromDisk = false`——本组件不需要单独持有 settingsOS(那只是
// Vue2 用来在 saveSettings 之外的地方引用选中对象的字段,这里没有别的消费点)。
// immediate:true 与 open-watch 声明顺序保证:同一次 tick 内若两者都需要生效,"选中了
// 新 OS"这个更具体的意图赢(与 CreateVmDialog 的写法一致)。
watch(() => props.selectedOs, (os) => {
  if (!os) return
  form.iso = os.path
  form.bootFromDisk = false
}, { immediate: true })

function onSubmit(): void {
  // 防重复提交(同 CreateVmDialog onSubmit 的写法):原生 `disabled` 已经挡掉真实点击,
  // 这里再补一道 JS 层防线。评审变异验证见任务报告(用 dispatchEvent 绕开原生 disabled)。
  if (props.saving) return

  // 照 Vue2 saveSettings(:1497-1508):networkMode 折算 + 8 个可写字段。**不**照抄
  // `...this.settingsForm` 的展开写法——那样会把 diskUsedPercent 也塞进请求体,后端
  // model.CreateVMRequest 没有这个字段,静默丢弃、无实际影响,但这里显式列举更清楚
  // payload 契约是什么,不依赖"后端会不会丢弃"这种隐式保证。**不**包含 os/osType——
  // 后端 UpdateVM(NimoOS-KVM/route/v2/vms.go:78-101)复用 CreateVMRequest 但不回填
  // OSType,保存 VM 设置不改操作系统类型,Vue2 settingsForm 本来也没有这两个字段。
  const isBridge = form.networkMode !== 'nat'
  const patch: KvmUpdateVMRequest = {
    name: form.name,
    vcpu: form.vcpu,
    memory: form.memory,
    disk: form.disk,
    iso: form.iso,
    bootFromDisk: form.bootFromDisk,
    firmware: form.firmware,
    networkMode: isBridge ? 'bridge' : 'nat',
    networkInterface: isBridge ? form.networkMode : '',
  }
  emit('submit', patch)
}
</script>

<template>
  <KvmDialog
    :open="props.open"
    :title="`${t('kvmVmSettingsTitle')} - ${props.vm.name}`"
    width="600px"
    @update:open="emit('update:open', $event)"
  >
    <template #tabs>
      <div class="settings-tabs">
        <button
          type="button"
          class="settings-tab"
          :class="{ active: activeTab === 'general' }"
          @click="selectTab('general')"
        >{{ t('kvmTabGeneral') }}</button>
        <button
          type="button"
          class="settings-tab"
          :class="{ active: activeTab === 'snapshots' }"
          @click="selectTab('snapshots')"
        >{{ t('kvmTabSnapshots') }}</button>
      </div>
    </template>

    <div v-show="activeTab === 'general'">
      <div class="cv-field">
        <label class="cv-label">{{ t('kvmVmName') }}</label>
        <input v-model="form.name" type="text" name="name" class="cv-input" />
      </div>

      <div class="cv-field">
        <label class="cv-label">{{ t('kvmDiskSize') }}</label>
        <span class="cv-hint">{{ Math.round(props.vm.diskUsedPercent || 0) }}% {{ t('kvmUsed') }}</span>
        <div class="cv-input-row cv-input-unit">
          <input :value="form.disk" type="number" name="disk" class="cv-input" disabled />
          <span class="cv-unit">GB</span>
        </div>
      </div>

      <div class="cv-field">
        <label class="cv-label">{{ t('kvmIsoImage') }}</label>
        <div class="cv-input-row">
          <button type="button" class="cv-iso-btn" @click="emit('open-os-selector')">
            <span v-if="form.iso">{{ form.iso }}</span>
            <span v-else class="cv-placeholder">{{ t('kvmNoIsoMounted') }}</span>
            <span aria-hidden="true">▾</span>
          </button>
          <!-- 双态按钮(照 Vue2 :276-281):未装盘引导时显示"弹出"(点了就切到硬盘引导,
               清空 iso);已经切到硬盘引导时显示"挂载"(点了重新打开 OS 选择器)。 -->
          <button
            v-if="!form.bootFromDisk"
            type="button"
            class="cv-iso-eject"
            :aria-label="t('kvmEjectIso')"
            @click="form.bootFromDisk = true; form.iso = ''"
          >
            <span aria-hidden="true">⏏</span>
          </button>
          <button
            v-else
            type="button"
            class="cv-iso-eject"
            :aria-label="t('kvmMountIso')"
            @click="emit('open-os-selector')"
          >
            <span aria-hidden="true">▾</span>
          </button>
        </div>
      </div>

      <div class="cv-field">
        <label class="cv-label">{{ t('kvmCpuCores') }}</label>
        <div class="cv-cpu-group">
          <button
            v-for="n in props.host.cpuCores"
            :key="n"
            type="button"
            class="cv-cpu-btn"
            :class="{ active: n <= form.vcpu }"
            @click="form.vcpu = n"
          >{{ n }}</button>
        </div>
      </div>

      <div class="cv-field">
        <label class="cv-label">{{ t('kvmMemory') }}</label>
        <span class="cv-hint">{{ t('kvmMax') }}: {{ formatHostMem(props.host.availableMemoryMB) }}</span>
        <div class="cv-input-row cv-input-unit">
          <input
            v-model.number="form.memory"
            type="number"
            name="memory"
            min="256"
            :max="props.host.availableMemoryMB || undefined"
            step="256"
            class="cv-input"
          />
          <span class="cv-unit">MB</span>
        </div>
      </div>

      <div class="cv-field">
        <label class="cv-label">{{ t('kvmNetwork') }}</label>
        <div class="cv-select">
          <select v-model="form.networkMode" name="networkMode" class="cv-select-native">
            <option value="nat">NAT</option>
            <option v-for="iface in props.host.networkInterfaces" :key="iface" :value="iface">
              {{ t('kvmBridgeTo') }} {{ iface }}
            </option>
          </select>
          <span class="cv-select-arrow" aria-hidden="true">▾</span>
        </div>
      </div>

      <div class="cv-field">
        <label class="cv-label">{{ t('kvmFirmware') }}</label>
        <div class="cv-firmware-group">
          <button type="button" class="cv-firmware-btn" :class="{ active: form.firmware === 'uefi' }" disabled>UEFI</button>
          <button type="button" class="cv-firmware-btn" :class="{ active: form.firmware === 'bios' }" disabled>BIOS</button>
        </div>
      </div>

      <p v-if="props.submitError" class="cv-error">{{ props.submitError }}</p>
    </div>

    <div v-show="activeTab === 'snapshots'" class="snapshots-body">
      <!-- Task 10:具名插槽的默认内容就是真正的 SnapshotsTab——生产环境(KvmPage.vue)
           不覆盖这个插槽,走的正是这份默认内容;VmSettingsDialog.test.ts 覆盖点 2(2026-08-02
           已有,Task 9 遗留)显式传了 `slots: { snapshots: '<div class="probe-snapshots">…' }`
           覆盖掉默认内容,验证"插槽机制本身接得上",不依赖真实 SnapshotsTab——两条测试
           互不冲突,分别验证"插槽管道通"与"默认内容对不对"。 -->
      <slot name="snapshots">
        <SnapshotsTab
          :vm-id="props.vm.id"
          :vm-state="props.vm.state"
          :snapshots="props.snapshots"
          :busy="props.snapshotsBusy"
          :submit-error="props.snapshotSubmitError"
          @create="emit('create-snapshot', $event)"
          @confirm-delete="emit('confirm-delete-snapshot', $event)"
          @confirm-restore="emit('confirm-restore-snapshot', $event)"
        />
      </slot>
    </div>

    <!-- foot 只在 general tab 显示(照 Vue2 :387)——用 v-if 挂在具名 <template> 上让
         KvmDialog 里 `slots.footer` 判定为"未提供"时,整个 footer 容器(含 padding)
         一起消失,不是只隐藏按钮本身(那样会在快照 tab 下留一条空白脚部)。 -->
    <template v-if="activeTab === 'general'" #footer>
      <button
        type="button"
        class="cv-primary-btn"
        :class="{ 'is-loading': props.saving }"
        :disabled="props.saving"
        @click="onSubmit"
      >
        {{ t('kvmSave') }}
      </button>
    </template>
  </KvmDialog>
</template>
