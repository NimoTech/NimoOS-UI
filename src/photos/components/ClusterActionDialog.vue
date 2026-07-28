<script setup lang="ts">
// Task 7 (SP7-P5 人物): ClusterActionDialog.vue —— 未命名人物三态操作弹窗(命名 / 合并 /
// 删除)。逐段照 Vue2 NimoOS-UI src/views/Photos/PhotosPeopleView.vue:237-361(模板)与
// :624-643(openXxxDialog 的 nextTick focus)移植;photos-people.scss 本身不含弹窗样式
// (Vue2 弹窗全靠内联 style),这里改成本仓惯例的 scoped <style> + theme token。
//
// 分工(照 brief 明确、同 P4 AlbumPickerDialog 的先例但反过来):本组件**只收集输入并
// emit**,不调用任何 store 或 toast —— 三条提交路径(renamePerson / mergePersonInto /
// purgePersonWithUndo)的真实调用、重入守卫、toast 全部在宿主 PhotosPeople.vue。
//
// 协调者复核修正(评审后 3 条改回 Vue2 字面写法,本期纪律"界面严格 1:1,只有 bug/竞态/
// 吞错才改"——brief 的结构清单是快照,Vue2 源码才是权威,清单没提不等于可以砍):
//  1) mode='name' 的 <label> 补上,键 photosPersonNameLabel(协调者已核 zh_CN.json:49
//     "Name": "名称" 并批准新增,en/zh 两个 locale 都加在段末,未重排既有键)。
//  2) 头部头像外圈的 2px solid var(--accent-soft) 装饰描边补上(Vue2 :246-247 的
//     border-box 48px 容器,内容区实际是 44px——这里用外层 .cad-avatar-ring 还原同一
//     几何,PersonAvatar 本身按 44 传 size)。
//  3) 删除确认按钮改回 Vue2 的实底红填充(:351-357):渐变走 --remove-fg/--remove-bg
//     两个既有 token(同 PhotosTrash.vue:446 `.trash-btn-cta.danger` 的既定惯例,不是
//     新发明),前景钉死白色 + theme-exception(理由见该处样式注释,不用 --on-accent——
//     它只在背景确为 var(--accent) 饱和实底时才可读,这里背景是危险红渐变,不满足前提)。
//
// 评审必修 1(第二轮):delete 模式实际是**三句不同文案**分属三个槶位,逐字核对
// Vue2 :259-262(头部标题)与 :337-343(警示条自己的标题行 + 灰色小字正文)才发现之前
// 把警示条的标题行("删除这个人物分组？")错放进了头部标题槶位,导致头部真正该显示的
// "Delete face cluster" 整句消失、警示条自己的标题行也丢了。新增头部专用键
// photosPersonDeleteClusterTitle(en 逐字 'Delete face cluster';zh 不照抄 zh_CN.json
// 的"删除面部集群"——"集群"触犯本期术语红线,改"删除这组人脸"),警示条恢复
// "标题行 + <br/> + 灰色小字正文" 的两行结构,三句各自归位。
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import PersonAvatar from './PersonAvatar.vue'
import { mergeConfidencePct, type Person } from '../util/peopleView'

type DialogMode = 'name' | 'merge' | 'delete'

const props = defineProps<{
  open: boolean
  mode: DialogMode
  person: Person | null
  candidates: Person[]
}>()
const emit = defineEmits<{
  (e: 'update:open', v: boolean): void
  (e: 'submit-name', name: string): void
  (e: 'submit-merge', targetId: string | number): void
  (e: 'submit-delete'): void
}>()

const { t } = useI18n()

const nameInput = ref('')
const mergeQuery = ref('')
const nameInputRef = ref<HTMLInputElement | null>(null)
const mergeInputRef = ref<HTMLInputElement | null>(null)

// 铁律:按 id 比较一律 String() 归一。
function sameId(a: string | number, b: string | number): boolean {
  return String(a) === String(b)
}

const titleKey = computed(() => {
  if (props.mode === 'name') return 'photosPersonNameTitle'
  if (props.mode === 'merge') return 'photosPersonMergeTitle'
  // 评审必修 1:delete 模式的头部标题槶位对应 Vue2 :262 $t('Delete face cluster'),
  // 与警示条内部自己的标题行(photosPersonDeleteTitle,:341)是两句不同文案,不能共用键。
  return 'photosPersonDeleteClusterTitle'
})

const subtitleText = computed(() => {
  if (!props.person) return ''
  const n = props.person.count
  const pct = mergeConfidencePct(props.person.confidence)
  // 未新增合并键:Vue2 是一整句 "{n} photos · confidence {pct}%",本仓 locale 没有对应的
  // 单一合体键,拼接两个已有键(photosPeoplePhotosCount / photosPersonMergeSuggestConfidence)
  // 用 " · " 连接,与 PhotosPeople.vue 里横幅副行同款拼接惯例(:t + .sep)一致。
  return `${t('photosPeoplePhotosCount', { n })} · ${t('photosPersonMergeSuggestConfidence', { n: pct })}`
})

const canSaveName = computed(() => nameInput.value.trim().length > 0)

// 候选:排除自身 → 按 count 降序、同 count 按 name 升序(偏离登记 12,brief 明确)→
// 空查询取前 6、有查询(小写 includes)取前 8。排序 → 过滤 → 截断,过滤放在弹窗内部
// (它持有 query,brief 定案)。
const sortedCandidates = computed(() => {
  const selfId = props.person?.id ?? null
  const pool = props.candidates.filter((p) => selfId === null || !sameId(p.id, selfId))
  return [...pool].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count
    return a.name.localeCompare(b.name)
  })
})
const filteredCandidates = computed(() => {
  const q = mergeQuery.value.trim().toLowerCase()
  if (!q) return sortedCandidates.value.slice(0, 6)
  return sortedCandidates.value.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 8)
})

function close(): void {
  emit('update:open', false)
}

// Esc 一律 document 级监听,watch(open) 挂/摘;分支内 stopPropagation(本仓浮层规范,
// 照 AlbumPickerDialog.vue:70-100 的先例)。点遮罩 @click.self 关闭。
function onDocumentKeydown(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return
  e.stopPropagation()
  close()
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      nameInput.value = ''
      mergeQuery.value = ''
      document.addEventListener('keydown', onDocumentKeydown)
      // 照 Vue2 openNameDialog/openMergeDialog :624-637 的 $nextTick + focus(+select,brief
      // 明确要求;输入框此刻为空,select() 是无操作但保留以照 brief 字面描述)。
      void nextTick(() => {
        if (props.mode === 'name') {
          nameInputRef.value?.focus()
          nameInputRef.value?.select()
        } else if (props.mode === 'merge') {
          mergeInputRef.value?.focus()
        }
      })
    } else {
      document.removeEventListener('keydown', onDocumentKeydown)
    }
  },
  { immediate: true },
)
onUnmounted(() => document.removeEventListener('keydown', onDocumentKeydown))

function submitName(): void {
  const name = nameInput.value.trim()
  if (!name) return
  emit('submit-name', name)
}
function pickCandidate(p: Person): void {
  emit('submit-merge', p.id)
}
function submitDelete(): void {
  emit('submit-delete')
}
</script>

<template>
  <div v-if="open" class="cad-overlay" data-test="cad-overlay" @click.self="close">
    <div class="cad-panel" data-test="cad-panel">
      <div class="cad-head">
        <div class="cad-avatar-ring" data-test="cad-avatar-ring">
          <PersonAvatar :person-id="person?.id ?? null" :name="person?.name" :ver="person?.coverFaceId ?? null" :size="44" />
        </div>
        <div class="cad-head-text">
          <div class="cad-title" data-test="cad-title">{{ t(titleKey) }}</div>
          <div class="cad-subtitle" data-test="cad-subtitle">{{ subtitleText }}</div>
        </div>
        <button type="button" class="cad-close" data-test="cad-close" :aria-label="t('photosClose')" @click="close">×</button>
      </div>

      <template v-if="mode === 'name'">
        <label class="cad-label" data-test="cad-name-label">{{ t('photosPersonNameLabel') }}</label>
        <input
          ref="nameInputRef"
          v-model="nameInput"
          type="text"
          class="cad-input"
          data-test="cad-name-input"
          :placeholder="t('photosPersonNamePlaceholder')"
          @keydown.enter="submitName"
        >
        <div class="cad-hint" data-test="cad-name-hint">
          {{ t('photosPersonNameHint', { n: person?.count ?? 0 }) }}
        </div>
        <div class="cad-actions">
          <button type="button" class="cad-btn" data-test="cad-cancel" @click="close">{{ t('photosCancel') }}</button>
          <button
            type="button"
            class="cad-btn cad-btn-primary"
            data-test="cad-save-name"
            :disabled="!canSaveName"
            @click="submitName"
          >{{ t('photosPersonSaveName') }}</button>
        </div>
      </template>

      <template v-else-if="mode === 'merge'">
        <input
          ref="mergeInputRef"
          v-model="mergeQuery"
          type="text"
          class="cad-input"
          data-test="cad-merge-input"
          :placeholder="t('photosPersonMergeSearch')"
        >
        <div class="cad-candidates">
          <button
            v-for="p in filteredCandidates"
            :key="p.id"
            type="button"
            class="cad-candidate"
            data-test="cad-candidate"
            :data-id="p.id"
            @click="pickCandidate(p)"
          >
            <PersonAvatar :person-id="p.id" :name="p.name" :ver="p.coverFaceId" :size="32" />
            <span class="cad-candidate-info">
              <span class="cad-candidate-name">{{ p.name }}</span>
              <span class="cad-candidate-count">{{ t('photosPeoplePhotosCount', { n: p.count.toLocaleString() }) }}</span>
            </span>
          </button>
          <div v-if="filteredCandidates.length === 0" class="cad-empty" data-test="cad-empty">
            {{ t('photosPersonNoMatch') }}
          </div>
        </div>
        <div class="cad-actions">
          <button type="button" class="cad-btn" data-test="cad-cancel" @click="close">{{ t('photosCancel') }}</button>
        </div>
      </template>

      <template v-else>
        <!-- 评审必修 1:警示条恢复 Vue2 :337-343 的两行结构 —— 第一行是警示条自己的标题
             (photosPersonDeleteTitle,"删除这个人物分组？"),<br/> 换行后才是灰色小字正文
             (photosPersonDeleteBody)。这两句和头部标题(titleKey)是三句不同文案,分属
             三个不同的槶位,不能互相顶替。 -->
        <div class="cad-warning" data-test="cad-delete-warning">
          <span data-test="cad-delete-warning-title">{{ t('photosPersonDeleteTitle') }}</span><br>
          <span class="cad-warning-body" data-test="cad-delete-warning-body">{{ t('photosPersonDeleteBody') }}</span>
        </div>
        <div class="cad-actions">
          <button type="button" class="cad-btn" data-test="cad-cancel" @click="close">{{ t('photosCancel') }}</button>
          <button type="button" class="cad-btn cad-btn-danger" data-test="cad-confirm-delete" @click="submitDelete">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>
            {{ t('photosPersonConfirmDelete') }}
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.cad-overlay {
  position: fixed;
  inset: 0;
  z-index: 220;
  background: var(--overlay-bg);
  backdrop-filter: var(--overlay-blur);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 24px;
}

/* P2 血泪(brief 明确点名):面板底色须用 --popup-bg,不用 --card-bg(深色主题下
   --card-bg 近透明,叠在暗底上会看穿)。 */
.cad-panel {
  width: 440px;
  max-width: 100%;
  background: var(--popup-bg);
  border: 1px solid var(--card-border);
  border-radius: 16px;
  padding: 22px;
  box-shadow: var(--card-shadow-hi);
}

.cad-head { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
/* Vue2 :246-247 的头像外圈装饰环:48px border-box 容器 + 2px 描边,内容区实际 44px——
   PersonAvatar 按 size=44 传,这里只负责外圈几何,不改组件契约。 */
.cad-avatar-ring {
  width: 48px; height: 48px; box-sizing: border-box; flex: 0 0 auto;
  border-radius: 50%; border: 2px solid var(--accent-soft); overflow: hidden;
  display: flex; align-items: center; justify-content: center;
}
.cad-head-text { flex: 1 1 auto; min-width: 0; }
.cad-title { font-size: 15px; font-weight: 600; color: var(--fg); }
.cad-subtitle { font-size: 11.5px; color: var(--fg-muted); margin-top: 2px; }
.cad-close {
  flex: 0 0 auto;
  width: 24px; height: 24px; border-radius: 50%; border: 0; background: transparent;
  color: var(--fg-muted); font-size: 15px; line-height: 1; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
}
.cad-close:hover { background: var(--hover); color: var(--fg); }

.cad-input {
  width: 100%; height: 36px; padding: 0 12px; margin-bottom: 12px;
  background: var(--chip-bg); border: 1px solid var(--chip-border); border-radius: 8px;
  color: var(--fg); font: inherit; font-size: 13px; outline: none;
}
.cad-input:focus { outline: 2px solid var(--accent); outline-offset: 1px; }

.cad-label { display: block; font-size: 11.5px; color: var(--fg-muted); margin-bottom: 6px; }

.cad-hint { font-size: 11px; color: var(--fg-muted); line-height: 1.5; padding: 8px 0 16px; }

.cad-actions { display: flex; gap: 10px; padding-top: 6px; border-top: 1px solid var(--divider); }
.cad-btn {
  flex: 1; height: 38px; border-radius: 10px; background: var(--chip-bg);
  border: 1px solid var(--chip-border); color: var(--fg); font: inherit; font-size: 13px;
  font-weight: 500; cursor: pointer;
}
.cad-btn:hover { background: var(--chip-bg-hi); }
.cad-btn-primary {
  flex: 1.4; background: var(--accent); border-color: var(--accent); color: var(--on-accent); font-weight: 600;
}
.cad-btn-primary:hover:not(:disabled) { filter: brightness(1.08); }
.cad-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
/* 照 Vue2 :351-357 的实底红填充(不是描边)——渐变复用 PhotosTrash.vue:446
   `.trash-btn-cta.danger` 的既有惯例(--remove-fg → --remove-bg),不是新配色。 */
.cad-btn-danger {
  flex: 1.4; border: 0; font-weight: 600;
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  background: linear-gradient(135deg, var(--remove-fg), var(--remove-bg));
  color: #fff; /* theme-exception: 危险渐变胶囊按钮文字,背景恒为危险红渐变
    (--remove-fg/--remove-bg),两套主题下白字对比度都稳定——同 PhotosTrash.vue
    .trash-btn-cta.danger 惯例,不用 --on-accent(它只在背景确为 var(--accent) 饱和
    实底时才可读,这里背景不是 accent) */
  box-shadow: 0 4px 14px color-mix(in srgb, var(--remove-bg) 35%, transparent);
}
.cad-btn-danger svg { color: #fff; /* theme-exception: 同上,图标随按钮文字钉死白色 */ }
.cad-btn-danger:hover { filter: brightness(1.08); }

.cad-candidates {
  max-height: 260px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px;
  margin-bottom: 14px;
}
.cad-candidate {
  display: flex; align-items: center; gap: 10px; padding: 8px 10px;
  background: var(--chip-bg); border: 1px solid var(--chip-border); border-radius: 8px;
  color: var(--fg); font: inherit; font-size: 12.5px; cursor: pointer; text-align: left;
}
.cad-candidate:hover { background: var(--chip-bg-hi); }
.cad-candidate-info { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.cad-candidate-name { font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cad-candidate-count { font-size: 11px; color: var(--fg-muted); }
.cad-empty { padding: 24px; text-align: center; color: var(--fg-muted); font-size: 12px; }

/* 危险色调(Vue2 的删除警示条是半透明红,不是 --warn-* 那套琥珀色 —— 那套是"人脸识别
   关闭"这类非破坏性提示用的语义,删除警示要用 --remove-fg 危险红族)。 */
.cad-warning {
  padding: 14px; background: color-mix(in srgb, var(--remove-fg) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--remove-fg) 25%, transparent); border-radius: 10px;
  font-size: 12.5px; color: var(--fg); line-height: 1.55; margin-bottom: 16px;
}
/* Vue2 :342 的内层灰色小字正文(照 var(--text-3)/11.5px)。 */
.cad-warning-body { color: var(--fg-muted); font-size: 11.5px; }
</style>
