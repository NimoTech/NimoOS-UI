<!--
  SP8-P2b Task 3 —— 设置区弹窗外壳。

  Vue2 的三处弹窗(McpTokensSection 令牌明文 / ChannelsSection 加机器人 + 配对码)
  是手写 `.sk-modal-bg` 裸 div + `@click.self` 关闭,没有焦点陷阱、Esc 也没接。
  本仓改用 reka Dialog(用户 2026-07-28 拍板;先例见 src/files/components/ 下
  对话框、src/components/ui/Dialog.vue),视觉规则仍是 Task 1 移植进 sk-shared.scss
  的 `.sk-modal*`,故用户看不出结构换了。

  【D1 关键约束】必须 portal 回设置页根元素 `.set-app`。AI 区 token 定义在
  `.agent-app` 作用域(src/ai/styles/tokens.scss:31),reka DialogPortal 默认把内容
  传送到 document.body —— 传出去就不在作用域里,`var(--bg-elevated)` / `var(--line)`
  一类全部解析失败,弹窗会变成透明底/错色。`defer` 打开是为了让 Teleport 在目标
  元素挂载后再解析选择器(设置页根元素与本组件同一棵树,顺序上安全,但 defer 不花钱)。
-->
<script setup lang="ts">
import { DialogRoot, DialogPortal, DialogOverlay, DialogContent, DialogTitle } from 'reka-ui'
import AgentIcon from '../icons/AgentIcon.vue'

const props = withDefaults(
  defineProps<{ open: boolean; title: string; portalTo?: string }>(),
  { portalTo: '.set-app' },
)
const emit = defineEmits<{ (e: 'update:open', v: boolean): void }>()
// SP8-P3b Task 5 —— 加一个可选的 footerLeft 插槽。Vue2 AddSkillModal.vue:96-108 的底栏是
// 两栏:左边 `.save-note`(保存说明 + check 图标)、右边 `.right`(取消/创建两个按钮),
// sk-shared.scss:139-150 的 `.sk-modal-foot` 本来就同时支持 `.save-note` 与 `.right`
// (后者 `margin-left: auto`),但本组件原先把 `#footer` 插槽整个塞进 `.right` 里 ——
// AddSkillModal 若只用现成插槽,「保存在本机」那行会被推到右边贴着按钮,与 Vue2 视觉不符。
// 纯增量:footerLeft 缺省不传时 <slot name="footerLeft" /> 不渲染任何内容,现有三个消费方
// (ChannelsSection 两处、McpTokensSection 一处)只传 #footer,行为不变。
const slots = defineSlots<{ default?: () => unknown; footer?: () => unknown; footerLeft?: () => unknown }>()
</script>

<template>
  <DialogRoot :open="props.open" @update:open="emit('update:open', $event)">
    <DialogPortal :to="props.portalTo" defer>
      <DialogOverlay class="sk-modal-bg">
        <DialogContent class="sk-modal" :aria-describedby="undefined">
          <div class="sk-modal-head">
            <DialogTitle class="sk-modal-title">{{ props.title }}</DialogTitle>
            <button type="button" class="sk-x" @click="emit('update:open', false)">
              <AgentIcon name="x" :size="14" />
            </button>
          </div>
          <div class="sk-modal-body"><slot /></div>
          <!-- v-if 同时看两个插槽:只传 footerLeft 不传 footer 这条件在逻辑上也要立得住
               (哪怕本期没有消费方这么用),不能写一个只覆盖 footer 单侧的条件。 -->
          <div v-if="slots.footer || slots.footerLeft" class="sk-modal-foot">
            <slot name="footerLeft" />
            <div class="right"><slot name="footer" /></div>
          </div>
        </DialogContent>
      </DialogOverlay>
    </DialogPortal>
  </DialogRoot>
</template>

<style scoped>
/* 关闭按钮:Vue2 里是 McpTokensSection.vue:241-244 的 .mcp-x 与
   ChannelsSection.vue:395-398 的 .chan-x 两份一模一样的 scoped 样式,这里收成一份。 */
.sk-x {
  width: 28px; height: 28px;
  display: inline-grid; place-items: center;
  border: 0; background: transparent;
  border-radius: 8px; cursor: pointer;
  color: var(--text-secondary);
  transition: background 100ms ease, color 100ms ease;
}
.sk-x:hover { background: var(--bg-chip); color: var(--text-primary); }
</style>
