<script setup lang="ts">
// Task 7 (SP7-P5 人物): ClusterActionDialog.vue —— 未命名人物三态操作弹窗(命名 / 合并 /
// 删除)。逐段照 Vue2 NimoOS-UI src/views/Photos/PhotosPeopleView.vue:237-361(模板)与
// :624-643(openXxxDialog 的 nextTick focus)移植;photos-people.scss 本身不含弹窗样式
// (Vue2 弹窗全靠内联 style),这里改成本仓惯例的 scoped 样式块 + theme token。
// (注:注释里刻意不写字面的 style 开标签 —— color-guard.test.ts 的样式块提取正则是
//  非贪婪匹配,注释里的假开标签会让它从这里一路吃到文件末尾的真闭标签,把整个 script +
//  template 都当成样式块扫描。详见该测试文件的 no-fake-style-tag 用例。)
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
//
// Plan D Task 4(scoped 清零):本组件类名不改(Task 1 已按现名 .cad-* 落 parity —— Vue2
// 这整个弹窗靠 :style 绑定搭出来,没有类可以锚)。文件末尾原有的整段本地 scoped 样式块
// 已删除:每条规则在 src/photos/styles/vue2-parity/photos-people.scss 里都能找到逐条比对
// 过的对应规则(diff 过程中补的两个真缺口——.cad-input:focus、.mrd-side 头像方形约束——
// 与顺手修正的两处本地对 Vue2 的漂移——.cad-overlay 内边距、.cad-btn-primary:disabled 的
// 视觉——都已经写进 parity 文件那几条规则自己的注释里)。parity 是纯全局样式表,本组件不
// 再带任何本地 scoped 规则之后,也就没有谁能在 specificity 上压过 parity 内部自身的声明
// 顺序了——删掉的那些 hover 修复注释(:hover 被基类 hover 抢背景)本就是"本地 scoped 规则
// 自带 specificity 加成"导致的,scoped 整体清零之后这个前提不再成立,不会复现。
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import PersonAvatar from './PersonAvatar.vue'
import { findNamedDuplicate, mergeConfidencePct, type Person } from '../util/peopleView'

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
// Task 7(Plan D,重名 dupconfirm):非 null 时 mode='name' 的模板切到 dupconfirm 子状态
// (照 Vue2 PhotosPeopleView.vue confirmName() :774-785 把整个 clusterDialog.mode 换成
// 'dupconfirm'——这里只是子状态,不是新的顶层 mode,因为 open/mode props 由宿主拥有,
// 本组件只在内部私有 ref 里切换视图)。
const dupConfirm = ref<{ name: string; existing: Person } | null>(null)
const dupConfirmRef = ref<HTMLElement | null>(null)

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

// Task 7(Plan D,重名 dupconfirm):dupConfirm 非空时(mode==='name' 子状态),头部标题槽位
// 换成"已存在同名人物"的插值文案(照 Vue2 PhotosPeopleView.vue:317
// `$t('A person named "{name}" already exists.', { name: clusterDialog.pendingName })`);
// 头像/副标题(subtitleText)保持不变——它们描述的是这次命名的原始人物簇,不随子状态切换。
const headTitle = computed(() => {
  if (props.mode === 'name' && dupConfirm.value) {
    return t('photosPersonDupExistsTitle', { name: dupConfirm.value.name })
  }
  return t(titleKey.value)
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
      dupConfirm.value = null
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

// Task 7:重名检测接入(照 Vue2 confirmName :774-785 —— findNamedDuplicate(peopleNamed, name)
// 命中就把 mode 换成 'dupconfirm' 并 focus 那个盒子,不命中才真的 applyName)。`candidates`
// 已经是宿主传下来的 people.named 全量列表(合并模式复用的同一份),命名场景不需要 excludeId
// ——这个 mode 只从未命名簇触发,簇本身不在 candidates(全量已命名列表)里,不会误判自身。
function submitName(): void {
  const name = nameInput.value.trim()
  if (!name) return
  const dup = findNamedDuplicate(props.candidates, name)
  if (dup) {
    dupConfirm.value = { name, existing: dup }
    // 照 Vue2 focusDlg() 的"dupconfirm 子状态下 focus 盒子本身"语义(:740-743)。
    void nextTick(() => dupConfirmRef.value?.focus())
    return
  }
  emit('submit-name', name)
}
// "Name anyway"(照 Vue2 dupNameAnyway :791-796):无视重名,照样提交这个名字。
function dupNameAnyway(): void {
  if (!dupConfirm.value) return
  emit('submit-name', dupConfirm.value.name)
}
// "Merge into existing"(照 Vue2 dupMergeInto :797-802):改道合并到已存在的那个人物。
function dupMergeInto(): void {
  if (!dupConfirm.value) return
  emit('submit-merge', dupConfirm.value.existing.id)
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
          <div class="cad-title" data-test="cad-title">{{ headTitle }}</div>
          <div class="cad-subtitle" data-test="cad-subtitle">{{ subtitleText }}</div>
        </div>
        <button type="button" class="cad-close" data-test="cad-close" :aria-label="t('photosClose')" @click="close">×</button>
      </div>

      <template v-if="mode === 'name'">
        <!-- Task 7:重名 dupconfirm 子状态 —— 照 Vue2 PhotosPeopleView.vue:396-419,替换掉
             输入框/提示/常规操作栏,换成三个动作。头部(头像/副标题)不变,只有这一块内容切换。 -->
        <template v-if="!dupConfirm">
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
            >
              <!-- 终审 Minor 1:Vue2 PhotosPeopleView.vue:293 钮内有 check 图标(size 13),
                   原实现漏了。同文件同一排的删除键(:235)与 MergeReviewDialog 的 accept 都有,
                   三兄弟只有它是纯文字 —— 内部不自洽。 -->
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
              {{ t('photosPersonSaveName') }}
            </button>
          </div>
        </template>
        <template v-else>
          <div ref="dupConfirmRef" class="cad-dupconfirm" data-test="cad-dupconfirm" tabindex="-1">
            <button type="button" class="cad-dup-primary" data-test="cad-dup-merge" @click="dupMergeInto">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9z"/></svg>
              {{ t('photosPersonDupMergeInto') }}
            </button>
            <button type="button" class="cad-dup-secondary" data-test="cad-dup-name-anyway" @click="dupNameAnyway">
              {{ t('photosPersonDupNameAnyway') }}
            </button>
            <button type="button" class="cad-dup-cancel" data-test="cad-dup-cancel" @click="close">
              {{ t('photosCancel') }}
            </button>
          </div>
        </template>
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
            <!-- 终审 Minor 2:Vue2 :322 行尾有 chevR(size 12,--text-3 → 本仓 --fg-muted),
                 原实现漏了。点这一行**直接执行合并**且不可撤销,少了这个"还有下一步"的箭头之后
                 整行只剩 hover 背景一个提示。 -->
            <svg class="cad-candidate-chev" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>
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
