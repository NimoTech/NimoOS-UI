<!--
  1:1 移植自 Vue2 src/views/AI/Agent/shell/SlashMenu.vue(全 70 行)。
  纯展示/交互组件:props 驱动 folders,emit init(target)/close——composer 负责
  在输入里检测单独的 "/" 并挂载/卸载本组件,以及处理 init 事件触发 store 的
  sendInit action。本任务不接线,也不加 Vue2 没有的 Escape 关闭(见下方说明)。

  机械转换清单(对应 .superpowers/sdd/p1c1-task-8-brief.md Step 3):
  1. data() { picking, initTarget } (Vue2:31) → ref('') / ref(null)。
  2. methods onPickInit/confirmInit(Vue2:33-40)→ 同名函数,逻辑逐字照抄。
  3. $emit('close')/$emit('init', ...)(Vue2:2,17,39)→ defineEmits<{...}>()。
  4. v-model="initTarget"(Vue2:13)在 Vue3 里对 radio input 同样成立,直接照抄。
  5. $t(...)(Vue2:6,10,17,18)→ 仓库 aiXxx 扁平 key:aiSlashInitDesc/aiSlashNoFolders/
     aiCancel(复用既有键)/aiSlashInitialize。

  Vue2 没有 Escape 关闭斜杠面板,也没有键盘方向导航——这是一个 UX 缺口,不是缺陷,
  遵照用户 2026-07-27 决定的移植纪律保持 1:1,不在本任务加。composer 拥有键盘
  处理,后续任务若做键盘一致性可以统一补上。

  三处裸色换 token(见 src/ai/styles/tokens.scss):
  - 遮罩的透明黑(alpha 0.3)→ var(--modal-scrim-soft)。
    Final review fix(2026-07-27):这里原先复用了 --modal-scrim(alpha 0.5),
    比 Vue2 字面值 alpha 0.3 明显更暗,是一处未申报的可见视觉偏离——1:1 铁律不
    允许。改为新增的 --modal-scrim-soft(alpha 0.3,两套主题同值),精确对齐
    Vue2 字面量;--shadow-pop 那处差异经复审判定可忽略,原样保留不动。
  - 卡片阴影(0 16px 48px,透明黑 alpha 0.18)→ var(--shadow-pop)。
  - .primary 的白色文字 → var(--text-on-accent)。
  半径:Vue2 硬编码 14px/8px/6px。--r-md 恰好是 14px,--r-xs 恰好是 6px——两处精确
  相等,替换为 token。.slash-row 的 8px 在 --r-xs(6px)和 --r-sm(10px)之间,没有
  精确匹配的 token;按"视觉 1:1 优先"原则保留原始像素值 8px,不做近似替换。
-->
<template>
  <div class="slash-menu" @click.self="$emit('close')">
    <div class="slash-card">
      <div class="slash-row" @click="onPickInit">
        <span class="slash-name">/init</span>
        <span class="slash-desc">{{ $t('aiSlashInitDesc') }}</span>
      </div>
      <div v-if="picking === 'init'" class="slash-init">
        <div v-if="folders.length === 0" class="slash-status">
          {{ $t('aiSlashNoFolders') }}
        </div>
        <label v-for="f in folders" :key="f.id || f.path" class="slash-init-row">
          <input type="radio" :value="f.path" v-model="initTarget" />
          {{ f.path }}
        </label>
        <div class="slash-init-actions">
          <button @click="$emit('close')">{{ $t('aiCancel') }}</button>
          <button :disabled="!initTarget" class="primary" @click="confirmInit">{{ $t('aiSlashInitialize') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface SlashFolder {
  id?: string | number
  path: string
}

const props = withDefaults(defineProps<{ folders?: SlashFolder[] }>(), {
  folders: () => [],
})

const emit = defineEmits<{ init: [target: string]; close: [] }>()

const picking = ref<string | null>(null)
const initTarget = ref('')

function onPickInit(): void {
  picking.value = 'init'
  if (props.folders.length === 1) initTarget.value = props.folders[0].path
}

function confirmInit(): void {
  if (!initTarget.value) return
  emit('init', initTarget.value)
}
</script>

<style scoped>
.slash-menu {
  position: fixed; inset: 0; background: var(--modal-scrim-soft);
  z-index: 1000; display: flex; align-items: flex-end; justify-content: center;
  padding-bottom: 90px;
  /* Re-enable clicks: ancestor .composer-wrap is pointer-events:none */
  pointer-events: auto;
}
.slash-card {
  width: min(520px, 90vw);
  background: var(--bg-elevated); color: var(--text-primary);
  border: 1px solid var(--line); border-radius: var(--r-md); padding: 8px;
  box-shadow: var(--shadow-pop);
}
.slash-row { display: flex; gap: 12px; padding: 8px 12px; border-radius: 8px; cursor: pointer; }
.slash-row:hover { background: var(--bg-chip); }
.slash-name { font-family: var(--font-mono); font-weight: 600; color: var(--text-primary); }
.slash-desc { color: var(--text-secondary); font-size: 13px; }
.slash-init { padding: 8px 12px; display: flex; flex-direction: column; gap: 4px; border-top: 1px solid var(--line); margin-top: 4px; }
.slash-init-row { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text-primary); }
.slash-init-actions { display: flex; gap: 8px; justify-content: flex-end; padding-top: 4px; }
.slash-init-actions button { padding: 4px 12px; border-radius: var(--r-xs); border: 1px solid var(--line); background: transparent; cursor: pointer; color: var(--text-primary); }
.slash-init-actions .primary { background: var(--accent); color: var(--text-on-accent); border-color: transparent; }
.slash-init-actions .primary:disabled { opacity: 0.4; cursor: not-allowed; }
.slash-status { font-size: 12px; color: var(--text-tertiary); padding: 4px 0; }
</style>
