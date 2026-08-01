<script setup lang="ts">
// folder-permissions 的「添加文件夹 / 添加排除」弹窗。
// 对位 Vue2 FolderPermissions.vue L157-174(b-modal + FolderBrowser + 手输框)。
//
// ⚠️ 本期(SP9-P4)按 spec §3.1 政策三:**弹窗打得开、选择器和手输框都在,但「添加」按钮
// 恒 disabled**,不触发任何写操作。接线时(债务 D11)去掉那个 disabled、换成
// Vue2 L169 的 `:disabled="!newPath.startsWith('/')"`,并把点击接到面板的 confirmAdd 上,
// 界面不用重做。
//
// ⚠️ 本期 roots 恒为 pickerRoots([]) 的回退三根(/DATA、/media、/mnt),因为快照的
// candidates 是空的(那份数据来自 wiki.getCandidates,wiki 域挂账 = 债务 D12)。
// 根按钮因此也是 disabled:点进去要 folder.getList 列目录,那是接线时的事,本期不发请求。
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Dialog from '../../../components/ui/Dialog.vue'
import type { PickerRoot } from '../../util/folderBrowser'
import '../../styles/settings.css'

const props = defineProps<{ open: boolean; title: string; roots: PickerRoot[] }>()
const emit = defineEmits<{ 'update:open': [boolean] }>()

const { t } = useI18n()
const newPath = ref('')

// Vue2 openAdd() 每次打开都重置 newPath —— 照抄这个行为(不让上次输入残留)。
watch(
  () => props.open,
  (v) => {
    if (v) newPath.value = ''
  },
)
</script>

<template>
  <Dialog :open="open" :title="title" @update:open="emit('update:open', $event)">
    <div data-test="fp-picker-body">
      <div class="set-fp-picker-roots">
        <button
          v-for="r in roots"
          :key="r.path"
          class="set-fp-picker-root"
          type="button"
          data-test="fp-picker-root"
          disabled
        >
          {{ r.label }}
        </button>
      </div>
      <div class="set-net-field" data-test="fp-picker-field">
        <input v-model="newPath" class="set-input" type="text" placeholder="/DATA">
      </div>
    </div>
    <template #footer>
      <button class="ui-btn" type="button" data-test="fp-picker-cancel" @click="emit('update:open', false)">
        {{ t('settingsCancel') }}
      </button>
      <!-- 政策三:本期恒禁用。接线时改成 :disabled="!newPath.startsWith('/')"(Vue2 L169)。 -->
      <button class="ui-btn" type="button" data-test="fp-picker-add" disabled>
        {{ t('settingsFpAddFolder') }}
      </button>
    </template>
  </Dialog>
</template>

<style scoped>
.set-fp-picker-roots { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; }
.set-fp-picker-root {
  padding: 8px 12px; border-radius: 10px; font-size: 13px; cursor: not-allowed;
  background: var(--chip-bg); border: 1px solid var(--chip-border); color: var(--fg-muted);
}
</style>
