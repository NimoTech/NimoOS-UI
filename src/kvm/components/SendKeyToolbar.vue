<script setup lang="ts">
// SendKey 悬浮工具条:四修饰键(Ctrl/Alt/Shift/Win)+ Tab/Esc + Ctrl+Alt+Del + 全屏。
// 视觉 1:1 对 Vue2 components/KVM/KVMFullPage.vue `.sendkey-toolbar` 模板
// (:195-223,2026-08-02 核对)。本组件只管渲染 + emit——鼠标悬浮显隐规则(mouseenter/
// mouseleave/mousemove 那一整套状态机)、isFullscreen 的来源(document.fullscreenElement)、
// Teleport 挂载位置都归 KvmPage.vue,原因见该文件顶部注释(简述:`.console-display` 是
// ConsoleStage 组件内部的 DOM 节点,不是 KvmPage 自己的模板,本组件不关心自己被挂在哪)。
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import ctrlAltDelIcon from '../assets/ctrl-alt-del.svg'
import fullscreenIcon from '../assets/fullscreen.svg'
import exitFullscreenIcon from '../assets/exitfullscreen.svg'

type Modifiers = { ctrl: boolean; alt: boolean; shift: boolean; win: boolean }

const props = defineProps<{ modifiers: Modifiers; isFullscreen: boolean }>()

const emit = defineEmits<{
  toggle: [name: keyof Modifiers]
  key: [keysym: number]
  ctrlAltDel: []
  fullscreen: []
}>()

const { t } = useI18n()

// 全屏按钮的 title/aria-label 随 isFullscreen 切换(kvmFullscreen ⇄ kvmExitFullscreen)。
// ⚠️ 与 Vue2 的偏离(非本任务新决定,i18n/zh_cn.sp9.ts:405-408 早已登记过的既定结论,
// 这里只是照做):Vue2 全屏按钮的 title 恒为 $t('Fullscreen')(从不随 isFullscreen 切换,
// 是遗留文案 bug),alt 属性硬编码英文 "Exit Fullscreen"/"Fullscreen" 且从不走 i18n。
// 按移植纪律(界面 1:1、Vue2 的 bug 不照抄,改正确逻辑并注释登记):New-UI 让文案随
// isFullscreen 正确切换,kvmExitFullscreen 键是 zh_CN.json 里没有的、专为此新增。
const fullscreenLabel = computed(() => (t(props.isFullscreen ? 'kvmExitFullscreen' : 'kvmFullscreen')))
</script>

<template>
  <div class="sendkey-toolbar">
    <button
      class="sendkey-btn"
      type="button"
      :class="{ active: modifiers.ctrl }"
      :title="t('kvmToggleCtrl')"
      @click="emit('toggle', 'ctrl')"
    >
      <span>Ctrl</span>
    </button>
    <button
      class="sendkey-btn"
      type="button"
      :class="{ active: modifiers.alt }"
      :title="t('kvmToggleAlt')"
      @click="emit('toggle', 'alt')"
    >
      <span>Alt</span>
    </button>
    <button
      class="sendkey-btn"
      type="button"
      :class="{ active: modifiers.shift }"
      :title="t('kvmToggleShift')"
      @click="emit('toggle', 'shift')"
    >
      <span>Shift</span>
    </button>
    <button
      class="sendkey-btn"
      type="button"
      :class="{ active: modifiers.win }"
      :title="t('kvmToggleWin')"
      :aria-label="t('kvmToggleWin')"
      @click="emit('toggle', 'win')"
    >
      <!-- ⊞ 是单色文字符号占位(禁 emoji)——Vue2 用的是 casa 图标字体的
           b-icon icon="windows",New-UI 没有那套字体。与 KvmPage.vue 的 ‹/▭、
           ConsoleHeader.vue 的 ⚙/⋮ 同一批占位债务,等统一换真图标那批一起收。 -->
      <span aria-hidden="true">⊞</span>
    </button>
    <button
      class="sendkey-btn"
      type="button"
      :title="t('kvmPressTab')"
      @click="emit('key', 0xff09)"
    >
      <span>Tab</span>
      <span class="sendkey-hint">{{ t('kvmPressTab') }}</span>
    </button>
    <button
      class="sendkey-btn"
      type="button"
      :title="t('kvmPressEsc')"
      @click="emit('key', 0xff1b)"
    >
      <span>Esc</span>
    </button>
    <hr class="sendkey-divider" />
    <button
      class="sendkey-btn"
      type="button"
      :title="t('kvmPressCtrlAltDel')"
      :aria-label="t('kvmPressCtrlAltDel')"
      @click="emit('ctrlAltDel')"
    >
      <img :src="ctrlAltDelIcon" :alt="t('kvmPressCtrlAltDel')" class="sendkey-img" />
    </button>
    <button
      class="sendkey-btn sendkey-btn--fullscreen"
      type="button"
      :title="fullscreenLabel"
      :aria-label="fullscreenLabel"
      @click="emit('fullscreen')"
    >
      <img v-if="isFullscreen" :src="exitFullscreenIcon" :alt="fullscreenLabel" class="fullscreen-svg" />
      <img v-else :src="fullscreenIcon" :alt="fullscreenLabel" class="fullscreen-svg" />
    </button>
  </div>
</template>
