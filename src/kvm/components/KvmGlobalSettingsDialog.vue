<script setup lang="ts">
// 全局设置弹窗:左栏齿轮的入口,弹窗内改存储路径/默认 vCPU/默认内存/自动启动四个全局
// 设置。视觉 1:1 对 Vue2 KVMFullPage.vue 模板 :516-556,数据流对 showGlobalSettings
// (:1075-1088)/saveGlobalSettings(:1090-1106)。
//
// 表单编辑用一份本地副本(local,reactive)——不直接双向绑定 useKvmHostInfo() 的
// settings ref。理由(brief 提醒 + 本任务硬约束):settings 是 Task 7(创建弹窗)/
// Task 9(VM 设置弹窗)共用的同一份 composable 状态,用户在这个弹窗里改了值又点 ✕
// 取消,脏值不该留在共享 state 里污染其它消费方读到的默认值。fetch() 完成后才把
// host.settings 的值覆盖进 local,取消编辑不影响共享状态。
import { reactive, ref, computed, watch, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import KvmDialog from './KvmDialog.vue'
import { useKvmHostInfo } from '../composables/useKvmHostInfo'
import type { KvmWritableSettings } from '../composables/useKvmHostInfo'
import { useToast } from '../../stores/toast'

const props = defineProps<{ open: boolean }>()
// `saved`(P6 Task 8 补,评审指出的真缺陷修复):本组件持有自己独立的一份
// `useKvmHostInfo()` 实例(见上面「表单编辑用一份本地副本」那段注释),与 `KvmPage.vue`
// 为创建弹窗持有的另一份 `hostInfo` 互不相干——这是 Task 2 的有意设计(隔离本地编辑
// 副本,取消不污染共享 state),但代价是:这里保存成功只会更新**自己这一份**
// `host.settings`,`KvmPage` 那份 `hostInfo.settings`(创建弹窗的 `:defaults` 来源)
// 完全不知道值已经变了。不补这个通知,用户改完全局默认值、打开创建弹窗看到的还是
// 旧值,要刷新整页才对——这是评审实测到的真缺陷,不是"下一个任务再说"的债务。
// 保存成功时额外 emit 这个事件,父组件(KvmPage)收到后重新 fetch 自己那份即可,
// 不需要打破「本地副本隔离」这条边界(把 hostInfo 当 props 传进来 / 把
// useKvmHostInfo 改成模块级单例都会破坏 Task 2 已评审通过的隔离设计,评审已明确
// 排除这两种改法)。
const emit = defineEmits<{ 'update:open': [v: boolean]; saved: [] }>()

const { t, te } = useI18n()
const toast = useToast()
const host = useKvmHostInfo()

const local = reactive<KvmWritableSettings>({
  storagePath: '', defaultVcpu: 0, defaultMemory: 0, autostart: false,
})

const saving = ref(false)
// ''=无错误;否则是后端原文,或 useKvmHostInfo.save() 回退的 i18n 键名——两种情况都交给
// 下面 errorText 用 te()/t() 判定,同 InstallBanner.vue / ConsoleStage.vue 的既有写法。
const formError = ref('')
const errorText = computed(() => (formError.value && te(formError.value)) ? t(formError.value) : formError.value)

// 就地过期守卫(硬约束 5,别抽公共 guard 工具):组件本身在 KvmPage 里常驻挂载
// (v-model:open 控制显隐,不是 v-if),理论上只有整页卸载(离开 /kvm 路由)才会触发,
// 但 fetch/save 都是异步操作,仍需按项目约定处理。
let alive = true

// 照 Vue2 showGlobalSettings(:1075-1087):先开弹窗(props.open 已经驱动 KvmDialog
// 显示)再拉数据。immediate:true 让"直接以 open=true 挂载"的场景(测试即如此)也走一遍。
watch(() => props.open, async (isOpen) => {
  if (!isOpen) return
  formError.value = ''
  await host.fetch()
  if (!alive) return // dispose 之后到达的响应不再覆盖本地副本
  Object.assign(local, host.settings.value)
}, { immediate: true })

onUnmounted(() => {
  alive = false
  host.dispose()
})

async function onSave(): Promise<void> {
  if (saving.value) return
  saving.value = true
  formError.value = ''
  try {
    const err = await host.save({ ...local })
    if (!alive) return
    if (err === '') {
      // 硬约束 2:「操作结果」性质的成功提示走全局 toast,不是弹窗内联。
      toast.show(t('kvmToastSettingsSaved'))
      emit('update:open', false)
      // 见上面 `saved` emit 定义处的注释:通知父组件把它自己那份 useKvmHostInfo()
      // 重新 fetch 一次,否则创建弹窗的默认值会停在保存前的旧值上。
      emit('saved')
    } else {
      // 硬约束 2:弹窗内报错走内联 .cv-error,不用 toast(toast z-index 60 会被
      // 弹窗遮罩 900 压住 + blur 糊掉,优先显示后端 message 原文对排障有用)。
      formError.value = err
    }
  } finally {
    if (alive) saving.value = false
  }
}
</script>

<template>
  <KvmDialog :open="props.open" :title="t('kvmSettings')" @update:open="emit('update:open', $event)">
    <div class="cv-field">
      <label class="cv-label">{{ t('kvmStoragePath') }}</label>
      <input v-model="local.storagePath" type="text" name="storagePath" class="cv-input" />
    </div>

    <div class="cv-field">
      <label class="cv-label">{{ t('kvmDefaultVcpu') }}</label>
      <div class="cv-input-row cv-input-unit">
        <input v-model.number="local.defaultVcpu" type="number" name="defaultVcpu" min="1" class="cv-input" />
        <span class="cv-unit">{{ t('kvmCoresUnit') }}</span>
      </div>
    </div>

    <div class="cv-field">
      <label class="cv-label">{{ t('kvmDefaultMemory') }}</label>
      <div class="cv-input-row cv-input-unit">
        <input v-model.number="local.defaultMemory" type="number" name="defaultMemory" min="256" step="256" class="cv-input" />
        <span class="cv-unit">MB</span>
      </div>
    </div>

    <div class="cv-field">
      <!-- 容器偏离(已申报):Vue2 用 buefy b-switch,New-UI 没有 → 自绘 .cv-switch
           (胶囊形,视觉照 buefy 开关)。原生 checkbox 视觉隐藏(不用 display:none,
           保留键盘可达性与原生 checked 语义),靠 :checked 相邻兄弟选择器驱动
           .cv-switch-track/.cv-switch-knob 的样式,不需要额外 JS。 -->
      <label class="cv-switch">
        <input v-model="local.autostart" type="checkbox" name="autostart" />
        <span class="cv-switch-track"><span class="cv-switch-knob"></span></span>
        <span>{{ t('kvmAutoStart') }}</span>
      </label>
    </div>

    <p v-if="errorText" class="cv-error">{{ errorText }}</p>

    <template #footer>
      <button
        type="button"
        class="cv-primary-btn"
        :class="{ 'is-loading': saving }"
        :disabled="saving"
        @click="onSave"
      >
        {{ t('kvmSave') }}
      </button>
    </template>
  </KvmDialog>
</template>
