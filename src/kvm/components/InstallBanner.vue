<script setup lang="ts">
// 安装横幅:选中的 VM 正在运行、但还没切回硬盘引导(bootFromDisk=false)且挂着 iso 时
// 显示,提示用户 ISO 装完系统后点按钮切回硬盘引导。视觉 1:1 对 Vue2
// components/KVM/KVMFullPage.vue 模板 :142-149 + 样式 :3096-3147——注意样式在 Vue2
// 文件末尾**第二个、非 scoped** 的 `<style lang="scss">` 块里(第一个 `<style scoped>`
// 在 :1657 起,全局块在 :2875 起),不是随手能在 scoped 块里找到的,这里单独标注一下
// 免得下次翻 Vue2 源文件翻错地方。
//
// 这是全页唯一的浅色块(--kvm-banner-* 系列 token 是浅蓝底,T2 阶段就在 theme.sp9.css
// 里定义好了、当时未使用,本任务是第一个消费它们的地方)。显示条件由父组件(KvmPage)
// 算好通过 v-if 控制挂载,本组件只管渲染 + 点击回调。
//
// ⚠️ 评审 Important #1 修复(2026-08-02):eject 失败时原来完全静默——`useVmList` 把
// 失败原因写进共享的 `lastError`,但那条内联错误只在 ConsoleStage 的
// `console-placeholder`(`v-if="!connected"`)里渲染;安装横幅的显示条件要求
// `state==='running'`,此时 T6 早已自动建立 VNC 连接、`connected` 恒为 true,占位层
// 压根不渲染,`lastError` 因此有写但从无处显示。Vue2 这里是弹一条红色 toast;按 KVM 区
// 从 T5 起确立的"控制台内联显示、不用 toast"约定,这里改成在横幅**内部**新增一行错误
// 文案(Vue2 没有这个元素,是新增的展示位——没有 toast 就必须有个地方放这条信息,
// 不是可有可无的装饰)。
//
// errorKey 与 ConsoleStage 的 error-key 走同一套约定:可能是 i18n key(如
// 'kvmEjectFailed'),也可能是后端返回的已解析原文,两种情况都用 te()/t() 判定——
// 同 KvmPage.vue 里 consoleErrorKey 的既有写法,保持整个 KVM 区错误展示逻辑一致。
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{ busy: boolean; errorKey?: string }>()
const emit = defineEmits<{ finish: [] }>()

const { t, te } = useI18n()

const errorText = computed(() => {
  const key = props.errorKey
  if (!key) return ''
  return te(key) ? t(key) : key
})

// ⚠️ 与 Vue2 的偏离(改正确逻辑、不照抄 bug,已申报):Vue2 的 `.is-loading` 只靠 CSS
// `pointer-events: none` 挡鼠标点击(:3127-3130),按钮本身没有 disabled 属性——键盘
// 用户 Tab 到按钮上按 Enter/Space 触发的 click 事件不受 pointer-events 影响,finishingInstall
// 为真时理论上仍能重复调用 handleInstallationFinished(该方法内部虽然也有
// `if (this.finishingInstall) return` 兜底,但那层兜底与"点击层面挡不挡得住"是两件事,
// 双保险不冲突)。这里直接在点击处理函数里判断 busy 再决定要不要 emit,不新增原生
// disabled 属性(disabled 在多数浏览器会带来 Vue2 没有的默认视觉,比如更淡的默认光标/
// 焦点样式,不是 1:1;纯 JS 判断不影响任何视觉)。
function onClick(): void {
  if (!props.busy) emit('finish')
}
</script>

<template>
  <div class="installation-banner">
    <div class="banner-content">
      <!-- ℹ 是单色文字符号占位(禁 emoji),对位 Vue2 b-icon icon="information-outline"。
           纯装饰,文字本身已经说明信息,不需要额外 aria-label。 -->
      <span aria-hidden="true">ℹ</span>
      <span>{{ t('kvmInstallingFromIso') }}</span>
    </div>
    <button
      type="button"
      class="banner-btn"
      :class="{ 'is-loading': busy }"
      @click="onClick"
    >
      {{ t('kvmFinishedInstalling') }}
    </button>
    <!-- 新增元素(Vue2 没有,评审要求补——见上方脚本注释):eject 失败时的内联错误提示。
         flex-basis:100% 让它在有内容时独占一行,不影响没有错误时原本的单行布局。 -->
    <p v-if="errorText" class="banner-error">{{ errorText }}</p>
  </div>
</template>
