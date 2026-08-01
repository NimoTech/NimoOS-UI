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
import { useI18n } from 'vue-i18n'

const props = defineProps<{ busy: boolean }>()
const emit = defineEmits<{ finish: [] }>()

const { t } = useI18n()

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
  </div>
</template>
