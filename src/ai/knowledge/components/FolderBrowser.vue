<!--
  SP8-P5c Task 3(半二)—— 「添加根目录」用的目录选择器。1:1 移植自 Vue2 蓝本
  `NimoOS-UI` (main@7a6ee6b7) `src/components/common/FolderBrowser.vue`(143 行,
  `git show main:` 读取 —— 治理 §1:那个仓的工作树是旧分支不可信)。

  结构对照(蓝本行 → 本文件):
    :1-29   模板整块(面包屑条 + 列表的 4 个分支)—— 逐字照抄,含 :5 的 String()
    :39-41  prop roots
    :43     data(current / entries / loading / error)
    :46     computed crumbs = crumbsFor(current, $t('Volumes'))
    :49-55  reset()
    :56-74  go(path)
    :76-78  created() { this._seq = 0 }
    :82-143 <style scoped> —— 🔴 本文件**零 <style> 块**:那 8 个 .fb* 类已由
            P5c T2a 搬进 `src/ai/styles/knowledge.scss:1647-1712`(嵌在
            .knowledge-app 下),并已过评审。本刀不碰 scss。

  【K27 / K28 —— 取数降层,本文件最容易翻车的一处】
    蓝本 :64-66 是 `folder.getList(path)` +
    `(r.data && r.data.data && r.data.data.content) || []` —— **三层**
    (HTTP 原文是 `{success,message,data:{content,…}}`,axios 再包一层 `.data`)。
    本仓共享包 `folder.ts:7-10` 已 `return unwrap<FolderListing>(res.data)`
    → `service.folder.getList()` 直接给出 **单层** `{ content: FolderEntry[] }`
    → 这里写 `listing.content || []`。K1 同族第 N 次。
    ⚠️【N7】`|| []` 兜底**不许删**(Go nil slice 序列化成 null 的必要防御)。

  【§5.2 `_seq` 竞态守卫 —— 照抄蓝本,不换写法、不抽公共 guard】
    `seq` 是**组件本地** `let`(不是模块级 —— 模块级会在多个实例间串号,
    也不是 `ref`:它不参与渲染)。`reset()` 先递增再清状态、`go()` 里
    `const mySeq = ++seq`、成功分支与 catch 各一处 `if (mySeq !== seq) return`、
    finally 那处是**正向** `if (mySeq === seq)` —— 四处顺序与形式逐字照抄。
    🔴 蓝本 `reset()` 在 `created()` 之前被调到会得到 `NaN`(`this._seq` 尚未初始化),
    但实际调用点在父组件的 `$nextTick` 里、`created` 早已跑过 → 不可达;
    Vue3 这里 `let seq = 0` 在 setup 期就有值,连不可达路径都不存在。

  【i18n】用 T1 已落地的 4 个 aiKbFb* 键(aiKbFbLoading / aiKbFbLoadFailed /
    aiKbFbNoVolumes / aiKbFbEmpty)+ crumbs 根标签 aiKbFbVolumes。**零新增键。**
-->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import KIcon from './KIcon.vue'
import { crumbsFor, dirEntries } from '../util/folderBrowser'
import type { DirEntry, PickerCandidate } from '../util/folderBrowser'

/** 蓝本 :39-41 —— `[{path, label}]`,label 可缺(模板里有 `|| r.path` 兜底)。 */
const props = withDefaults(defineProps<{ roots?: PickerCandidate[] }>(), { roots: () => [] })
const emit = defineEmits<{ (e: 'pick', path: string): void }>()

const { t } = useI18n()

/** 蓝本 :43 data()。 */
const current = ref('')
const entries = ref<DirEntry[]>([])
const loading = ref(false)
const error = ref('')

/** 蓝本 :77 `created(){ this._seq = 0 }` —— 组件本地,不是模块级。 */
let seq = 0

/** 蓝本 :46。 */
const crumbs = computed(() => crumbsFor(current.value, t('aiKbFbVolumes')))

/** 蓝本 :49-55 —— 先递增 _seq(废掉在飞的请求)再清状态,顺序照抄。 */
function reset(): void {
  seq++
  current.value = ''
  entries.value = []
  error.value = ''
  loading.value = false
}

/** 蓝本 :56-74。emit('pick') 的位置照抄:在「空 path 直接返回」之后 ——
 *  点根层面包屑(path === '')不 emit。 */
async function go(path: string): Promise<void> {
  current.value = path
  error.value = ''
  if (!path) { entries.value = []; return }
  emit('pick', path)
  const mySeq = ++seq
  loading.value = true
  try {
    const listing = await service.folder.getList(path)
    if (mySeq !== seq) return
    entries.value = dirEntries(listing.content || []) // K28:单层 + N7 兜底
  } catch {
    if (mySeq !== seq) return
    entries.value = []
    error.value = t('aiKbFbLoadFailed')
  } finally {
    if (mySeq === seq) loading.value = false
  }
}

/** 蓝本靠 `$refs.fb.reset()` 调用(父组件 SettingsView)→ Vue3 显式暴露。 */
defineExpose({ reset })
</script>

<template>
  <div class="fb">
    <div class="fb-crumbs">
      <button v-for="(c, i) in crumbs" :key="c.path || 'root'"
              class="fb-crumb" :data-last="String(i === crumbs.length - 1)"
              @click="go(c.path)">{{ c.label }}</button>
    </div>
    <div class="fb-list">
      <div v-if="loading" class="fb-stub">{{ t('aiKbFbLoading') }}</div>
      <div v-else-if="error" class="fb-stub fb-err">{{ error }}</div>
      <template v-else-if="current === ''">
        <button v-for="r in props.roots" :key="r.path" class="fb-row" @click="go(r.path)">
          <KIcon name="drive" :size="13"/>
          <span class="fb-name">{{ r.label || r.path }}</span>
          <KIcon name="chev" :size="10"/>
        </button>
        <div v-if="!props.roots.length" class="fb-stub">{{ t('aiKbFbNoVolumes') }}</div>
      </template>
      <template v-else>
        <button v-for="e in entries" :key="e.path" class="fb-row" @click="go(e.path)">
          <KIcon name="folder" :size="13"/>
          <span class="fb-name">{{ e.name }}</span>
          <KIcon name="chev" :size="10"/>
        </button>
        <div v-if="!entries.length" class="fb-stub">{{ t('aiKbFbEmpty') }}</div>
      </template>
    </div>
  </div>
</template>
