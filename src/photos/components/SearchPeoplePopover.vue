<script setup lang="ts">
// SP7-P7a-T14: SearchPeoplePopover.vue —— 搜索栏「人物」筛选弹层。
// 结构对应 Vue2 PhotosSearchView.vue:93-122(模板)、:435-447(realPeopleList)、
// :545-549(filteredPeopleList)。样式对应 photos.scss:2689-2694(.face-* 6 条,已逐条核对)
// + 复用既有 .fpop/.fpop-search/.fpop-foot 外壳(与 T12/T13 同款,数值照抄 photos.scss)。
//
// 死代码不迁(控制器裁定,C4/A-2):Vue2 人物弹层每格头像有两个三元表达式——无封面时
// 显示首字母、否则显示一个占位问号字符;姓名区同理,已命名显示姓名、否则显示一个
// "未命名"文案键。Vue2 的 realPeopleList(:438)已 `.filter(p => p.name && p.name.trim())`
// 过滤掉未命名的人,「已命名」这个条件对搜索弹层的候选集恒真——这两个占位分支是死代码。
// New-UI 的 PersonOption(searchUnderstood.ts:11-16)只含"已命名"的人,连 named 字段都不
// 存在——没有对应状态可迁,本文件因此不出现那个问号字符字面量,也不引用那个"未命名"
// i18n 键的标识符(测试用反向断言钉住这两点,注释里也不重复写出以免自己撞上那条断言)。
// 那个 i18n 键本身**不删**:T9 的 54 键表是按 Vue2 真实 $t() 用法生成的,该键确实被 Vue2
// 用到(只是落在死分支上),表本身没错,因此不删键、不改 T9 的键数(控制器裁定,见
// task-14-report.md「C4」)。
//
// PersonAvatar 复用决定（C10，报告里有完整理由）：本仓已有的 PersonAvatar.vue（P5 建）
// 三级兜底逻辑与这里需要的"有封面显示图 / 无封面显示首字母"语义高度重合，但它的
// showImg 只看 personId!==null && !failed，不看有没有封面——直接传 p.id 会让"无封面"
// 的人也尝试发起一次图片请求（等 onerror 才退回首字母），不满足 brief 要求的"无 img
// 同步存在"断言。这里用 `personId = p.coverFaceId ? p.id : null` 复用 personId 本身当
// "要不要尝试加载真图"的开关——personId 为 null 时 PersonAvatar 直接走首字母分支，
// 不发任何图片请求，与 Vue2 的 `v-if="p.coverFaceId"` 语义等价，且不需要改动
// PersonAvatar.vue 一行代码。
//
// 偏离登记(fix round 1 · M2,此前漏登记的一处;fix round 2 · N4 修正渐变方向):
// PersonAvatar 首字母兜底态的底色走的是 `--avatar-fallback` token,而 Vue2
// `PhotosSearchView.vue:101-102` 这里的兜底底色是一个写死的双色渐变(135 度角,起点是
// 浅紫色调、终点是粉色调,不属于本仓 accent 家族的任何一档)——两者色值不同,是本
// 组件复用 PersonAvatar 时继承的既有偏离(P5 时期定的公共兜底色,不在本任务范围内改)。
//
// 偏离登记(fix round 1 · M8,加性改动):PersonAvatar 把 `alt` 设成 `name || ''`(见该
// 组件 :103),而 Vue2 这里的 `<img>` 是字面 `alt=""`(:103 同段)。由于 New-UI 的
// PersonOption 恒有非空姓名,复用 PersonAvatar 会让每张头像图片带上人名作为 alt 文本,
// 比 Vue2 的空 alt 更利于屏幕阅读器,是复用公共组件带来的加性可用性改进,不是本任务
// 刻意新写的行为——按纪律仍在此登记。
//
// PersonOption 的顺序契约(fix round 1 · M9,交接下游):Vue2 realPeopleList(:435-447)
// 以 `.sort((a,b) => b.c - a.c)` 按人脸计数降序结尾,弹层网格渲染顺序依赖这个排序。本组件
// 只透传 `people` prop、不自己排序——T16 组装 `people` 数组时必须保持这个降序,否则弹层
// 顺序会与 Vue2 不一致(详见 task-14-report.md 交接段)。
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { PersonOption } from '../util/searchUnderstood'
import PersonAvatar from './PersonAvatar.vue'

const props = defineProps<{
  people: PersonOption[]
  selected: string[]
}>()

const emit = defineEmits<{
  (e: 'update:selected', v: string[]): void
  (e: 'apply'): void
  (e: 'cancel'): void
}>()

const { t, locale } = useI18n()

// BCP-47 转换(本仓既定写法,照 SmartViewCard.vue:38 等既有先例):locale 是 'zh_cn'/'en_us'
// 下划线形式,裸传 toLocaleString 会抛 RangeError。
const localeTag = computed(() => locale.value.replace('_', '-'))

const search = ref('')

// 照搬 Vue2 filteredPeopleList(:545-549):search 为空 → 原样返回 people;否则按
// name.toLowerCase().includes(...) 大小写不敏感过滤,不 trim(Vue2 原样没有 trim)。
const filtered = computed(() => {
  if (!search.value) return props.people
  const q = search.value.toLowerCase()
  return props.people.filter((p) => p.name.toLowerCase().includes(q))
})

function isSel(name: string): boolean {
  return props.selected.includes(name)
}

// selected 存人名(照搬 Vue2 isDraftSelected('people', p.n) 的按名比对)。不原地改
// props.selected——emit 新数组(照 PhotosFilterPopover.vue 的既定不可变写法)。
function toggle(name: string): void {
  const next = isSel(name) ? props.selected.filter((x) => x !== name) : [...props.selected, name]
  emit('update:selected', next)
}

// 照搬 Vue2 Apply 按钮文案(:118):selected 非空时追加 ` (n)`。
const applyLabel = computed(() => {
  const base = t('photosSearchApply')
  return props.selected.length > 0 ? `${base} (${props.selected.length})` : base
})
</script>

<template>
  <div @click.stop>
    <!-- 2026-08-13 回退追记(Fix-3 item 7):`.fpop` 的形状/尺寸/位置/焦点环全部让 parity scss
         (vue2-parity/photos.scss:2690-2726)的裸 `.fpop` 规则生效,不再本地重复声明——parity
         的默认宽度是列表/日期两个弹层共用的 320px,本弹层唯一的偏离是 Vue2 `:94` 那处内联
         `style="width:300px"`,同样用内联 style 覆盖(不新增一条只改一个属性的 scoped 规则,
         照 PhotosFilterPopover.vue 的 width prop 已有先例——那里用 :style 覆盖,不是 CSS 类)。 -->
    <div class="fpop" style="width: 300px">
      <input
        v-model="search" class="fpop-search" data-test="people-search"
        :placeholder="t('photosSearchSearchPeople')"
      >
      <div v-if="filtered.length" class="face-pop-grid">
        <div
          v-for="p in filtered" :key="p.id" class="face-cell"
          :data-on="isSel(p.name) ? 'true' : 'false'" @click="toggle(p.name)"
        >
          <PersonAvatar
            :person-id="p.coverFaceId ? p.id : null" :name="p.name" :ver="p.coverFaceId"
            :size="48"
          />
          <div class="face-cell-name">{{ p.name }}</div>
          <div class="face-cell-count">{{ p.count.toLocaleString(localeTag) }}</div>
        </div>
      </div>
      <div v-else class="face-pop-empty" data-test="people-empty">
        {{ t('photosSearchNoPeopleDetectedYet') }}
      </div>
      <div class="fpop-foot">
        <button type="button" class="fpop-quick" data-test="people-cancel-btn" @click="emit('cancel')">
          {{ t('photosCancel') }}
        </button>
        <button type="button" class="btn btn-primary" data-test="people-apply-btn" @click="emit('apply')">
          {{ applyLabel }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 2026-08-13 回退(机主推翻 EXIF 玻璃例外,Fix-3 item 7 追加执行——本组件此前漏了这一轮
   回退,brief 明确点名"align their chrome to parity like the FilterChip/Popover treatment"):
   .fpop/.fpop-search(+:focus)/.face-pop-grid/.face-cell/.face-cell-name/.face-cell-count/
   .fpop-quick(+:hover)/.btn/.btn-primary(+:hover)这一整套颜色规则已从本组件的 scoped style
   里整体删除,交给 vue2-parity/photos.scss 的裸选择器接管(:2690-2726,.btn 系列走全局
   `.photos-root .btn`/`.photos-root .btn-primary` 家族 :290-301)——本组件不再自带一份颜色
   映射到本仓通用玻璃语义(--popup-bg/--card-border/--card-shadow-hi/--chip-bg/--fg-muted/
   --fg-subtle/--accent-text 等)的重复,那些 token 均未被 `.photos-root` 本地重定义,会落到
   theme.css 的全局蓝紫玻璃值。`@keyframes pop-in` 同理删除——parity scss 已有同名关键帧。
   留在这里的只剩 parity 没有覆盖的两处:`.face-pop-empty`(Vue2 :110-112 是内联 style,不是
   class,parity 天然没有这个选择器)与 `.face-cell :deep(.person-avatar-ring)`(+[data-on] 变体
   ,C10 裁定的 New-UI 专属选中环写法,PersonAvatar 组件内部结构,parity 无对应)、
   `.fpop-foot`(+子选择器,Vue2 这里 margin-top 是 14px,与 List/Date 两个弹层的 12px 不同,
   parity 本就没有 `.fpop-foot` 这个类,不存在"移交"的问题)。 */
.face-pop-empty {
  padding: 24px 8px;
  text-align: center;
  color: var(--text-3);
  font-size: 12px;
}

/* photos.scss:2691-2692 的选中环:C10 裁定用 :deep 挂在 PersonAvatar 的圆环元素上，不
   自绘头像。基础态统一定 2px 宽(而非 PersonAvatar 默认的 1px card-border)以便选中态只切
   颜色不跳变宽度；选中态换成 accent 描边 + 光晕(0.20 阿尔法)。
   Fix-3 item 7 token 修正:此前这里的光晕走的是本仓 theme.css 里一个全局定义的蓝色调 token
   (`.photos-root` 未本地重定义),与本页其余 accent 家族(parity 本地定义、紫色调)不是
   同一色系,是与本任务其余处同类的"全局 token 漏进 parity 页面"问题——已改用下方
   theme-exception 标记的字面量(Vue2 逐字数值),不新增 token。 */
.face-cell :deep(.person-avatar-ring) {
  border-width: 2px;
}
.face-cell[data-on="true"] :deep(.person-avatar-ring) {
  border-color: var(--accent);
  /* theme-exception: Vue2 逐字光晕值(accent 紫色系、0.20 阿尔法),与 parity 转录里
     .fchip[data-on] 边框那条同色系字面量同一处理方式,不新增 token。 */
  box-shadow: 0 0 0 2px rgba(110,91,255,0.20);
}

/* Vue2 :113 这里的脚部 margin-top 是 14px,与 SearchDatePopover.vue(Vue2 日期弹层 :84)/
   PhotosFilterPopover.vue(Vue2 列表弹层 :142)的 12px 不同——三条脚部规则各自独立声明,
   parity 本身没有 `.fpop-foot` 这个类,不合并复用。 */
.fpop-foot {
  display: flex;
  gap: 8px;
  margin-top: 14px;
}
.fpop-foot .fpop-quick,
.fpop-foot .btn {
  flex: 1;
  justify-content: center;
}
</style>
