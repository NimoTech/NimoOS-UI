<script setup lang="ts">
// VM 设置弹窗的「快照」tab:建快照表单 + 快照列表(每条带恢复/删除,均需就地二次确认)。
// 视觉 1:1 对 Vue2 KVMFullPage.vue 模板 :327-385(create-vm-body snapshots-body 段),
// 逻辑对 createSnapshot(:1237-1258)/confirmRestoreSnapshot(:1260-1276)/
// confirmDeleteSnapshot(:1290-1302)/formatDate(:1316-1320)。
//
// 本组件是纯展示层——不发任何请求,只 emit 意图('create'/'confirm-delete'/
// 'confirm-restore'),真正调 useSnapshots 的 create/remove/restore 由父组件
// (VmSettingsDialog → KvmPage)负责,进度遮罩/toast 也在那一层拼(硬约束,brief Step 4)。
//
// 就地二次确认复用 P5 OverflowMenu.vue 的思路(单一 pendingAction+pendingId 决定「谁在
// 待确认」),但**不抽公共组件**——OverflowMenu 管的是菜单项(单列表、单一种确认目标),
// 这里是"同一条快照上恢复/删除两个独立按钮"外加"多条快照"的组合,形状不同(硬约束,
// brief Step 4 明确要求)。这里也不需要 OverflowMenu 那套非响应式闭包变量 + tick 手法——
// 那是为了应对"父组件用 v-if 在关闭动画期间提前卸载"的时序问题(P4 教训),本组件不存在
// 那个场景(reka DialogContent 在 open=false 时整个卸载,不是先播动画再卸载),普通 ref
// 就够。
import { reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { KvmSnapshot } from '@nimotech/nimoos-service'

const props = defineProps<{
  vmId: string
  vmState: string
  snapshots: KvmSnapshot[]
  busy: boolean
  submitError: string
}>()

const emit = defineEmits<{
  create: [payload: { name: string; description: string }]
  'confirm-delete': [s: KvmSnapshot]
  'confirm-restore': [s: KvmSnapshot]
}>()

const { t } = useI18n()

const form = reactive({ name: '', description: '' })
// ''=无内联错误;硬约束 10:弹窗内联报错,不用 toast(同 CreateVmDialog/VmSettingsDialog
// 既有写法)。
const localError = ref('')

function onCreateClick(): void {
  // 防重复提交(同 CreateVmDialog.onSubmit 的写法):原生 `disabled` 已经挡掉真实点击,
  // 这里再补一道 JS 层防线。变异验证见任务报告。
  if (props.busy) return
  // 照 Vue2 createSnapshot(:1238-1240):名称为空(含纯空白)不发请求。**改正确**:
  // Vue2 用 toast 提示,本项目 KVM 区约定弹窗内联报错、不用 toast(硬约束 7)。
  if (!form.name.trim()) {
    localError.value = t('kvmErrNoSnapshotName')
    return
  }
  localError.value = ''
  emit('create', { name: form.name, description: form.description })
}

// 创建成功后清空表单(照 Vue2 createSnapshot :1250:`this.snapshotForm = { name: '',
// description: '' }`,只在成功时清)。本组件不持有"是否成功"这个结果本身——父组件
// 用 busy 从 true 变回 false 且 submitError 仍是空来表达"这一轮成功了"(与
// CreateVmDialog/VmSettingsDialog 的 saving/submitError 契约一致)。用 oldBusy 参数
// 而不是额外的 ref 记"上一次是不是在忙":watch 回调本身就带前一个值。
watch(() => props.busy, (isBusy, wasBusy) => {
  if (wasBusy && !isBusy && !props.submitError) {
    form.name = ''
    form.description = ''
  }
})

// 就地二次确认:单一 pendingAction+pendingId 决定"谁在待确认"(照 Vue2 单一
// pendingConfirmAction/pendingConfirmId 的语义,confirmRestoreSnapshot:1265-1275 /
// confirmDeleteSnapshot:1291-1301)。**改正确**:不照抄 confirmRestoreSnapshot 里
// "VM 必须停止" 那句死代码 toast(:1262)——恢复按钮本身已经
// `:disabled="vmState !== 'stopped'"`(:368),点不到这个分支(spec §1.15 已核实)。
const pendingAction = ref<'' | 'delete' | 'restore'>('')
const pendingId = ref('')

function isPending(action: 'delete' | 'restore', id: string): boolean {
  return pendingAction.value === action && pendingId.value === id
}

function confirmThenEmit(action: 'delete' | 'restore', snap: KvmSnapshot): void {
  if (isPending(action, snap.id)) {
    pendingAction.value = ''
    pendingId.value = ''
    // 全分支评审修复(A1,已申报):这里曾经不清 localError,导致「创建校验失败留下的
    // 陈旧文案」在改去点删除/恢复时继续挡在 `.cv-error` 位上——`localError || props.submitError`
    // 的优先级会让后端这次真实失败的 message 永远露不出来(见 :143 模板)。这一支是
    // "确认后真正派发"的唯一出口,清空放这里与 CreateVmDialog.onSubmit(:172,每次有效
    // 提交清 localError)同一个思路:新一轮结果(不管是成功还是父组件即将写入的失败
    // message)开始前,先清掉上一轮遗留的本地校验错误。
    localError.value = ''
    // 分支写死事件名(而不是三元表达式算出字符串再传给 emit)——defineEmits 的重载签名
    // 认不出三元算出的联合类型字符串,vue-tsc 会报"参数类型不匹配"(已实测)。
    if (action === 'delete') emit('confirm-delete', snap)
    else emit('confirm-restore', snap)
  } else {
    // 把待确认目标整体替换成这一次点的(action, id)——天然实现"确认态互斥"(换一条
    // 快照)与"切换动作也复位"(同一条快照换成另一个动作):单一状态源,旧目标不再匹配
    // isPending() 就自动显示成"未待确认",不需要额外的复位分支。变异验证见任务报告。
    pendingAction.value = action
    pendingId.value = snap.id
  }
}

// 照 Vue2 formatDate(:1316-1320)。
function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleString()
}
</script>

<template>
  <div>
    <div class="cv-field">
      <label class="cv-label">{{ t('kvmCreateSnapshot') }}</label>
    </div>
    <div class="cv-field">
      <label class="cv-label">{{ t('kvmName') }}</label>
      <input
        v-model="form.name"
        type="text"
        name="snapshotName"
        :placeholder="t('kvmSnapshotNamePlaceholder')"
        class="cv-input"
      />
    </div>
    <div class="cv-field">
      <label class="cv-label">{{ t('kvmDescription') }}</label>
      <input
        v-model="form.description"
        type="text"
        name="snapshotDescription"
        :placeholder="t('kvmSnapshotDescPlaceholder')"
        class="cv-input"
      />
    </div>
    <div class="cv-field">
      <button
        type="button"
        class="cv-primary-btn"
        :class="{ 'is-loading': props.busy }"
        :disabled="props.busy"
        @click="onCreateClick"
      >
        {{ t('kvmCreate') }}
      </button>
    </div>

    <p v-if="localError || props.submitError" class="cv-error">{{ localError || props.submitError }}</p>

    <div class="cv-field">
      <!-- 复用 kvmTabSnapshots(与 VmSettingsDialog 的 tab 文字同一个键)——Vue2 这里的
           $t('Snapshots') 与 tab 按钮的 $t('Snapshots') 是同一个 i18n 键、同一段译文
           ("快照"),不是巧合撞词,没必要为完全相同的文案再起一个新键。 -->
      <label class="cv-label">{{ t('kvmTabSnapshots') }}</label>

      <div v-if="props.snapshots.length === 0" class="cv-empty-state">
        <span>{{ t('kvmNoSnapshots') }}</span>
      </div>
      <div v-else>
        <div
          v-for="snap in props.snapshots"
          :key="snap.id"
          class="cv-field cv-snapshot-item"
        >
          <div class="cv-snapshot-info">
            <span class="cv-snapshot-name">{{ t('kvmName') }}: {{ snap.name }}</span>
            <span v-if="snap.description" class="cv-snapshot-desc">{{ t('kvmDescription') }}: {{ snap.description }}</span>
            <span class="cv-snapshot-date">{{ t('kvmCreatedAt') }}: {{ formatDate(snap.createdAt) }}</span>
          </div>
          <div class="cv-snapshot-actions">
            <button
              type="button"
              class="cv-btn cv-btn-restore"
              :disabled="props.vmState !== 'stopped'"
              @click="confirmThenEmit('restore', snap)"
            >
              <span aria-hidden="true">↺</span>
              <span :class="{ 'confirm-text-danger': isPending('restore', snap.id) }">
                {{ isPending('restore', snap.id) ? t('kvmAreYouSure') : t('kvmRestore') }}
              </span>
            </button>
            <button
              type="button"
              class="cv-btn cv-btn-delete"
              @click="confirmThenEmit('delete', snap)"
            >
              <span aria-hidden="true">⊟</span>
              <!-- 改正确(已申报):Vue2 :379 的删除按钮那个 span 没有绑
                   `confirm-text-danger`(只有 :372 的恢复按钮绑了)——两个按钮背景本来
                   就常年是红色,这个遗漏在 Vue2 里几乎看不出来,但 brief Step 3 覆盖点 8
                   明确要求删除的"你确定吗?"同样要带这个类,这里按 brief 补齐,登记为
                   有意偏离而不是照抄这处不对称。 -->
              <span :class="{ 'confirm-text-danger': isPending('delete', snap.id) }">
                {{ isPending('delete', snap.id) ? t('kvmAreYouSure') : t('kvmDelete') }}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
