<script setup lang="ts">
// 创建虚拟机弹窗。视觉 1:1 对 Vue2 KVMFullPage.vue 模板 :396-494,逻辑对
// showCreateVM(:1155-1190)/onOSSelect 赋值部分(:1376-1447)/osTemplate watch
// (:720-746)/createVM(:1450-1492)。
//
// 表单状态(8 字段 + 内部专用的 osTemplate)整个在组件内部,不接收/回写任何共享对象——
// `host`/`defaults`/`isos`/`selectedOs` 全部只读消费(数字/字符串按值复制进 form,
// selectedOs 只读它的字段,从不写 `props.selectedOs.xxx = ...`)。Global Constraint #16
// 在本组件**不适用**:没有可被污染的共享对象,见组件底部「Constraint #16 自查」注释。
//
// 三条已申报的「改正确」偏离(硬约束 2,任务 brief 逐条要求):
// 1) submit 的 payload 不带 `osTemplate`(纯前端联动概念)与 `autostart`——后端
//    model.CreateVMRequest(NimoOS-KVM/model/vm.go:39-51)只认 11 个字段没这两个,
//    Vue2 用 `{...vm}` 把它们一起发出去被后端静默丢弃,「继承全局自动启动」从来没生效过。
// 2) 默认值直接读 props.host/props.defaults,不在本组件里再拉一次 getSettings——
//    页面级 useKvmHostInfo() 已经有一份(Task 2),重复请求是浪费。
// 3) `host.cpuCores === 0`(GET /settings 还没回来)时不渲染任何 CPU 格子——这是
//    `v-for="n in props.host.cpuCores"` 在 n=0 时的自然结果,不需要额外分支;前提是
//    Task 2 已把 host 的初值改成全 0(不是 Vue2 那个硬编码 16 的假值),spec §12 #6。
import { reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { KvmISO, KvmCreateVMRequest } from '@nimotech/nimoos-service'
import KvmDialog from './KvmDialog.vue'
import type { SelectedOs } from './OsSelector.vue'
import type { KvmHostReadonly, KvmWritableSettings } from '../composables/useKvmHostInfo'
import type { IsoRow } from '../composables/useIsoList'
import { validateCreateVm, type CreateVmForm } from '../util/createVmValidate'
import { osTemplateDefaults, matchTemplateByFamily } from '../util/isoMatch'
import { formatHostMem } from '../util/format'

const props = defineProps<{
  open: boolean
  host: KvmHostReadonly
  defaults: KvmWritableSettings
  isos: IsoRow[]
  selectedOs: SelectedOs | null
  creating: boolean
  submitError: string
}>()

const emit = defineEmits<{
  'update:open': [v: boolean]
  'open-os-selector': []
  submit: [payload: KvmCreateVMRequest]
}>()

const { t } = useI18n()

// `osTemplate` 是本组件内部专用的联动驱动值(照 Vue2 newVM.osTemplate),不进 payload。
const form = reactive<CreateVmForm & { osTemplate: string }>({
  name: '',
  vcpu: props.defaults.defaultVcpu || 2,
  memory: props.defaults.defaultMemory || 2048,
  disk: props.host.defaultDiskSize || 32,
  iso: '',
  os: '',
  osType: '',
  networkMode: 'nat',
  firmware: 'bios',
  osTemplate: 'generic-linux',
})

// ''=无内联错误;非空=校验失败文案或后端 submitError 的兜底(硬约束 7,弹窗内联不用 toast)。
const localError = ref('')

// 打开弹窗时复位表单。照 Vue2 showCreateVM(:1155-1169),但默认值直接读 props(改正确
// 偏离 #2,已在组件头部申报),不在这里再拉一次 getSettings。immediate:true 让「直接以
// open=true 挂载」的场景(测试即如此)也走一遍复位。
watch(() => props.open, (isOpen) => {
  if (!isOpen) return
  form.name = ''
  form.vcpu = props.defaults.defaultVcpu || 2
  form.memory = props.defaults.defaultMemory || 2048
  form.disk = props.host.defaultDiskSize || 32
  form.iso = ''
  form.os = ''
  form.osType = ''
  form.networkMode = 'nat'
  form.firmware = 'bios'
  form.osTemplate = 'generic-linux'
  localError.value = ''
}, { immediate: true })

// 选中 OS 后的联动。照 Vue2 onOSSelect 赋值部分(:1376-1447),两个分支(isLocal / 官方
// 模板)在 brief 里合并成一条统一规则——**不设 autostart**(改正确偏离 #1,已申报)。
watch(() => props.selectedOs, (os) => {
  if (!os) return
  form.iso = os.path
  form.os = os.isLocal ? os.name.replace(/\.iso$/i, '') : os.name

  // 决定 osTemplate:id 直接命中(非 'local')就用它;否则按文件名反查模板;再不行按
  // 文件名含 'win' 兜底成两个固定占位模板之一。osType/firmware/os 的最终值交给下面
  // watch(osTemplate) 用 Task 3 的 osTemplateDefaults 统一推导,这里只负责定 osTemplate。
  //
  // 全分支评审修复(B1,已申报):这里原来调的是 `matchTemplateByFilename`(严格版,
  // IsoBrowser 第一遍已经用过的同一个纯函数)——但走到这个 else 分支时 `os.id` 必然是
  // `'local'`(IsoBrowser.vue onItemClick 的契约:命中就给真实模板 id,不命中才落
  // 'local'),对同一个文件名再跑同一个确定性函数必然还是返回 null,是可证明的死代码。
  // Vue2 KVMFullPage.vue:1392-1403 在这个位置跑的其实是另一个更宽松的"家族前缀"匹配器
  // (`t.id.split('-')[0]`,如 'ubuntu'/'debian'/'alpine',对 win* 额外核对版本号)——
  // 之前只搬了严格版,这个宽松兜底整层丢了,是未申报的能力丢失(详见 isoMatch.ts 里
  // matchTemplateByFamily 的完整对照注释)。现在换成它,恢复 Vue2 对
  // "文件名含家族前缀但不含完整 id" 这类真实命名(如 alpine-standard-3.19.1-x86_64.iso)
  // 的识别能力。
  if (os.id && os.id !== 'local') {
    form.osTemplate = os.id
  } else {
    const match = matchTemplateByFamily(os.name, props.isos)
    form.osTemplate = match ? match.id : (os.name.toLowerCase().includes('win') ? 'generic-windows' : 'generic-linux')
  }

  // 有推荐值就覆盖 vcpu/memory(照 Vue2 :1440-1441,直接读 os 本身的推荐值,不等
  // osTemplate 联动去查——万一 os.id 在当前 isos 列表里查不到模板,这里仍是安全网)。
  if (os.recommendedVcpu) form.vcpu = os.recommendedVcpu
  if (os.recommendedMemory) form.memory = os.recommendedMemory
  // 全分支评审订正(B2,已申报,原注释「照 Vue2 :1442」不准确):Vue2 :1436-1443 是
  // `if (os.id) { this.newVM.osTemplate = os.id } else { ...这条磁盘公式... }`——磁盘公式
  // 那句话在 Vue2 里挂在 `else`(即 `!os.id`)分支下。真机 `GET /v1/kvm/isos` 返回的每一
  // 行都带 `id`(已用 2026-08-03 curl 核实),所以这个 else 分支在可达路径上**从未执行
  // 过**,Vue2 选中任何 OS 后都不会改 `disk`,磁盘输入框停在打开弹窗时的默认值
  // (`host.defaultDiskSize`,20 或 32)。New-UI 这里没有复刻 `if (os.id) {...} else {...}`
  // 这层分支——上面已经用 osTemplate 分支处理了 osTemplate 本身,这条磁盘公式对**每一次**
  // 选中都会跑(官方模板 `os.minDisk` 恒有定义,这个条件恒真)。**这不是照抄失败,是有意
  // 保留新行为,不是缺陷**:新行为更准确——例如选中 `alpine-319`(minDisk=2)时预填
  // 20GB(`Math.max(2*3,20)`),而 Vue2 对 minDisk=40 的 Windows 模板会预填出 32GB
  // (defaultDiskSize),随即违反表单自己的 `:min="minDisk"` 校验(32 < 40)。保留现状,
  // 只把这条注释从"误标为照抄"改成正式的偏离申报。
  if (os.minDisk !== undefined) form.disk = Math.max((os.minDisk || 8) * 3, 20)
}, { immediate: true })

// osTemplate 联动。逐字对 Vue2 watch('newVM.osTemplate')(:720-746),用 Task 3 的
// osTemplateDefaults 计算——**改正确**:Vue2 原文「找不到模板」时整段 watch 是空
// no-op(:731 `if (tmpl) {...}` 没有 else 分支),但 osTemplateDefaults 作为纯函数必须
// 有确定返回值,不能真的什么都不做,只能在调用方补回这层「找不到就跳过」的判断——否则
// 会把上面 watch(selectedOs) 刚设好的 os/firmware 覆盖成兜底的 'Linux'/'bios',丢失
// 已经更精确的信息。这层判断就是把 Vue2 那个隐藏在 if 里的 no-op 显式搬回来。
watch(() => form.osTemplate, (val) => {
  if (!val) return
  const isGeneric = val === 'generic-linux' || val === 'generic-windows'
  const tmpl = props.isos.find((t) => t.id === val)
  if (!isGeneric && !tmpl) return
  const d = osTemplateDefaults(val, props.isos)
  form.osType = d.osType
  form.firmware = d.firmware
  form.os = d.os
  if (d.vcpu) form.vcpu = d.vcpu
  if (d.memory) form.memory = d.memory
  // 照 Vue2 :741-743,`!this.newVM.disk` 这个条件在复位后基本恒为 false(disk 总有值)——
  // 保留是为了逐字对齐,不是死代码硬留:disk===0 的边界值理论上仍会命中。
  if (d.minDisk && !form.disk) form.disk = Math.max(form.disk || 0, d.minDisk)
}, { immediate: true })

// validateCreateVm(Task 3)要的是 KvmISO 形状,而这里只有 SelectedOs(字段子集,部分
// 可选)。只读它实际用到的两个字段(minDisk/minMemory)加一层判空,其余字段(version/
// category/size/status/progress)填空占位——validateCreateVm 内部不读它们,纯粹是
// 为了满足参数类型,不是伪造数据发给后端(payload 是另外单独构造的,见 buildPayload)。
function toValidateOs(os: SelectedOs | null): KvmISO | null {
  if (!os) return null
  return {
    id: os.id,
    name: os.name,
    version: '',
    category: '',
    size: '',
    status: '',
    progress: 0,
    path: os.path,
    recommendedVcpu: os.recommendedVcpu ?? 0,
    recommendedMemory: os.recommendedMemory ?? 0,
    minMemory: os.minMemory ?? 0,
    minDisk: os.minDisk ?? 0,
  }
}

function onSubmit(): void {
  // 防重复提交:创建请求在途时点了也不生效(硬约束,测试用例 12)。原生 `disabled`
  // 属性(见 template)已经挡掉了浏览器里的真实鼠标点击,这里再补一道 JS 层的防线——
  // 万一将来某次改动漏挂 `:disabled` 或从别的路径调用 onSubmit,这里仍能兜底。
  // 评审做过变异验证:删掉这一行,用例(用 dispatchEvent 绕开原生 disabled 拦截)
  // 精确翻红,证明这行不是死代码,详见任务报告。
  if (props.creating) return

  const formForValidate: CreateVmForm = {
    name: form.name, vcpu: form.vcpu, memory: form.memory, disk: form.disk,
    iso: form.iso, os: form.os, osType: form.osType,
    networkMode: form.networkMode, firmware: form.firmware,
  }
  const err = validateCreateVm(formForValidate, toValidateOs(props.selectedOs), props.host)
  if (err) {
    // 弹窗内联报错,不用 toast(硬约束 7:toast z-index 60 会被弹窗遮罩 900+blur 压住糊掉)。
    localError.value = t(err.key) + (err.arg ? ` ${err.arg}` : '')
    return
  }
  localError.value = ''

  // 照 Vue2 createVM(:1475-1480):networkMode 只有 'nat' 是 nat,其余(网卡名字符串)
  // 一律算 bridge,网卡名本身回填进 networkInterface。
  const isBridge = form.networkMode !== 'nat'
  const payload: KvmCreateVMRequest = {
    name: form.name,
    vcpu: form.vcpu,
    memory: form.memory,
    disk: form.disk,
    iso: form.iso,
    os: form.os,
    osType: form.osType || 'linux',
    networkMode: isBridge ? 'bridge' : 'nat',
    networkInterface: isBridge ? form.networkMode : '',
    firmware: form.firmware,
    // 有意不传 osTemplate / autostart / bootFromDisk——见组件头部偏离登记 #1
    // (bootFromDisk 是可选字段,后端默认 false,不传等价于传 false)。
  }
  emit('submit', payload)
}
</script>

<template>
  <KvmDialog :open="props.open" :title="t('kvmCreateTitle')" @update:open="emit('update:open', $event)">
    <div class="cv-field">
      <label class="cv-label">{{ t('kvmVmName') }}</label>
      <input v-model="form.name" type="text" name="name" :placeholder="t('kvmVmNamePlaceholder')" class="cv-input" />
    </div>

    <div class="cv-field">
      <label class="cv-label">{{ t('kvmIsoImage') }}</label>
      <div class="cv-input-row">
        <!-- name 属性不是 Vue2 有的东西(它靠 b-input 组件,没有裸 name)——纯测试钩子,
             与其它 input 一样,方便 vue-test-utils 精确选中。 -->
        <button type="button" class="cv-iso-btn" @click="emit('open-os-selector')">
          <span v-if="props.selectedOs">{{ props.selectedOs.path }}</span>
          <span v-else class="cv-placeholder">{{ t('kvmSelectIsoPlaceholder') }}</span>
          <span aria-hidden="true">▾</span>
        </button>
      </div>
    </div>

    <div class="cv-field">
      <label class="cv-label">{{ t('kvmDiskSize') }}</label>
      <span class="cv-hint">{{ t('kvmMax') }}: {{ props.host.availableDiskGB }} GB</span>
      <div class="cv-input-row cv-input-unit">
        <input
          v-model.number="form.disk"
          type="number"
          name="disk"
          :min="props.selectedOs?.minDisk || 8"
          :max="props.host.availableDiskGB || undefined"
          class="cv-input"
        />
        <span class="cv-unit">GB</span>
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
          :min="props.selectedOs?.minMemory || 256"
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
        <button
          type="button"
          class="cv-firmware-btn"
          :class="{ active: form.firmware === 'uefi' }"
          @click="form.firmware = 'uefi'"
        >UEFI</button>
        <button
          type="button"
          class="cv-firmware-btn"
          :class="{ active: form.firmware === 'bios' }"
          @click="form.firmware = 'bios'"
        >BIOS</button>
      </div>
    </div>

    <div v-if="props.selectedOs?.isLocal" class="cv-field">
      <label class="cv-label">{{ t('kvmOsVersion') }}</label>
      <div class="cv-select">
        <select v-model="form.osTemplate" name="osTemplate" class="cv-select-native">
          <option value="generic-linux">{{ t('kvmGenericLinux') }}</option>
          <option value="generic-windows">{{ t('kvmGenericWindows') }}</option>
          <option v-for="tmpl in props.isos" :key="tmpl.id" :value="tmpl.id">{{ tmpl.name }}</option>
        </select>
        <span class="cv-select-arrow" aria-hidden="true">▾</span>
      </div>
    </div>

    <p v-if="localError || props.submitError" class="cv-error">{{ localError || props.submitError }}</p>

    <template #footer>
      <button
        type="button"
        class="cv-primary-btn"
        :class="{ 'is-loading': props.creating }"
        :disabled="props.creating"
        @click="onSubmit"
      >
        {{ t('kvmCreate') }}
      </button>
    </template>
  </KvmDialog>
</template>
