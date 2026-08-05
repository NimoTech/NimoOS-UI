# Task 4 报告: PlaceSpotDialog.vue + 面板内 spots 列表段

## 结论

- 新建 `src/photos/components/PlaceSpotDialog.vue` + `__tests__/PlaceSpotDialog.test.ts`(21 例)。
- 修改 `src/photos/components/PlaceDetailPanel.vue`:新增 props `activeSpotKey`/`spotBusy`、
  emits `pick-spot`/`rename`/`reset-name`/`close-spot`/`open-spot-library`,`.detail-body`
  里加了 spot 弹窗挂载点 + spots 列表段。
- 修改 `__tests__/PlaceDetailPanel.test.ts`:`mountPanel` 补两个新 prop 的默认值,追加 18 例
  (含 1 例本任务追加的"数字 key fixture"防御性用例,brief 删码清单⑤要求)。
- 全量:284 文件 / 2791 passed(基线 283/2753,净增 1 文件 + 38 例:PlaceSpotDialog 21 +
  PlaceDetailPanel 17)。color-guard 397(基线 394,+3,来自新文件扫描)。tsc 0。

## Vue2 元素清点表(PhotosPlacesView.vue:1109-1172,photos-places.scss:620-701)

| # | Vue2 元素/规则 | New-UI 落点 | 状态 |
|---|---|---|---|
| 1 | `.spot-dialog`(:1109) | `PlaceSpotDialog.vue` 根 `.spot-dialog` | 已迁,边框换 `--accent-soft-bd` |
| 2 | `.spot-dialog-head` + 13px map 图标(色 `--accent-hi`) | 同名 class;色改 `--accent-text`(brief 明示) | 已迁 |
| 3 | 非编辑态 `.spot-dialog-name` + `.one-line` + `.spot-rename-btn` | 同名 | 已迁 |
| 4 | 编辑态 `.spot-rename` input(maxlength 60/placeholder/enter/esc)+ save + cancel | 同名;save 增加 `|| busy` 守卫 | 已迁 + D8 增强 |
| 5 | `startSpotRename`(草稿=当前名,`$nextTick`+focus) | `startRename()` + `nextTick` | 已迁 |
| 6 | `watch(spotDialog){ spotEditing=false }`(:303) | `watch(() => props.spot.key, …)`——只钉"换了不同 spot"这一种情形(偏离登记 7,见文件头注释) | 部分迁移(有意收窄,已登记) |
| 7 | `.spot-dialog-coords`(写死 `° N`/`° E`,:1129) | `formatSpotCoords`(T2),按符号出 N/S/E/W;返回空串整行不渲染 | 已迁 + 偏离登记 16 修正 |
| 8 | `.spot-dialog-reset` | **不存在于 Vue2** | D8 net-new,已加注释登记 |
| 9 | `.spot-dialog-stat`(`<b>{{count}}</b>` + 文案) | 同名 | 已迁 |
| 10 | `.spot-dialog-thumbs` 单图 `v-if="spot.thumb"` | 同名,`v-if` 照搬 | 已迁 |
| 11 | `.spot-dialog-btn`(整行 accent 实底 + hover `--accent-hi`) | 同名;hover 换 `background:var(--accent);filter:brightness(1.08)`(本仓既定) | 已迁 |
| 12 | `openSpotLibrary`(:473-484,带 key/city/spotKey/spotName/spotLat/spotLon 六个字段 emit `open-spot`) | 简化为 `emit('open-library')` 零参 —— **偏离登记(见下)** | 见下方"疑问" |
| 13 | `saveSpotName`(:495-516,含 store 调用 + `loadDetail` 重拉 + 保活 dialog) | 拆分:dialog 只 `emit('rename', name)`,真正调用在容器(T8)+ store(T2) | 已按 brief 分工迁移 |
| 14 | `.detail-section h4`(:656-663) | 同名(色 `--fg-subtle`) | 已迁 |
| 15 | `.detail-section h4 .more`(:664-668,**带** `cursor:pointer`) | 拆出:基类**不带** cursor(本段静态),T5 需自加可点变体 | 见下方"分叉点选择" |
| 16 | `.spot-list` / `.spot-row`(grid 36px 1fr auto) | 同名 | 已迁 |
| 17 | `.spot-row .thumb`(写死纯黑) | 换 `--chip-bg`(登记同 `PlacesRail.vue .rail-place .thumb` 既定处置) | 已迁 + 偏离登记 |
| 18 | `.spot-row .name/.sub/.count`(monospace count) | 同名;count 字体换 `--num-font` | 已迁 |
| 19 | `<div v-for="s in spots" @click="spotDialog={spot:s}">` | `@click="emit('pick-spot', s)"` | 已迁(容器负责真正打开逻辑) |

逐项核对未发现行号/内容出入(仅确认实际路径是 `NimoOS-UI/src/views/Photos/PhotosPlacesView.vue`
与 `photos-places.scss`,brief 未写子目录,已按实际路径核实无误)。

## `.more` 手型分叉点:选了哪条路

选择 **方案 A**:把 `cursor: pointer` 从共享基类 `.detail-section h4 .more` 里整体拿掉,
本段(spots)天然是静态文本、无需覆写。留了明确注释(模板 + 样式两处)告诉 T5:如果
"查看全部 N 张"要做成真正可点,请另加一个修饰类(建议名 `.more.is-clickable`)叠加声明
`cursor: pointer`,不要改回共享基类本身——否则会连带把 spots 段这个本该不可点的 `.more`
也带上手型。

## 6 项删码验证结果(逐项一次删一处,验完用 Edit 手工切回,未用 `git checkout --`)

1. 删 `watch(() => props.spot.key, …)` → `props.spot.key 变化时退出编辑态` 用例红(1 例)。已切回。
2. 删 `submitRename` 里的 `.trim()` → 2 例红(回车提交 + 点保存,均断言 trim 后名字)。已切回。
3. 删 `canSubmitRename` 里的 `&& !props.busy` → `busy=true 时保存钮与恢复默认钮都 disabled` 红。已切回。
4. 给 `.detail-section h4 .more` 加回 `cursor: pointer` → §7c-9 守卫用例红。已切回。
5. 把 `activeSpot` 计算里的 `String(s.key) === String(props.activeSpotKey)` 改回裸 `===` →
   新增的"数字 key fixture"用例红(`spot.key` 运行时为 `number`、`activeSpotKey` 为 `string`)。已切回。
6. 删 `PlaceSpotDialog.vue` 缩略图的 `v-if="spot.thumb"` → "thumb 为空串时 img 不渲染"红。已切回。
   **额外**(非 brief 六项之一,顺带验证):`PlaceDetailPanel.vue` spot-row 的
   `v-if="s.thumb"` 同样删码验证过,红了也已切回——结构规格 B.2 明确要求行内 thumb
   也要有空值守卫。

## 测试数字前后

| | 文件数 | passed | color-guard | tsc |
|---|---|---|---|---|
| 任务前(基线,brief 声明) | 283 | 2753 | 394 | 0 |
| 任务后 | 284 | 2791 | 397 | 0 |

## 偏离登记 / 决策记录

- **偏离登记 7 实现方式**:dialog 组件不持 `spot` 的本地副本,非编辑态全部直接读
  `props.spot.*`;编辑态退出只由 `props.spot.key` 变化驱动(watch),**不**在
  "提交 rename 成功"这件事上自动退出编辑态——因为 dialog 看不到那次网络请求是否成功
  (那在容器/store 层),乐观退出会在失败时撒谎。这与 brief 测试清单完全吻合(清单没有
  要求"提交后自动退出编辑态"这条断言)。
- **`open-photo` 透传的形状转换**:`PlaceSpotDialog` 的 `open-photo` 是单参
  `(assetId: string)`;`PlaceDetailPanel` 自己既有的 `open-photo` 是 T3 定的双参
  `(assetId, list: string[])`(**不可改**)。透传时补成 `(assetId, [assetId])`,同
  `onHeroClick` 的既定处置一致。
- **`openSpotLibrary` 六字段收窄为零参 `open-library`**:Vue2 `openSpotLibrary`(:473-484)
  emit 的 `open-spot` 事件带 6 个字段(place key/city + spot key/name/lat/lon),供宿主拼
  "在 Library 里按坐标筛选"的深链。brief 的 Interfaces 一节明确写死本组件 `open-library`
  是零参(`(e: 'open-library'): void`),这是 brief 自己的接口收窄,不是我的分支决策——
  但依据"偏离登记"纪律仍记一笔:**容器(T8)要重建这 6 个字段就必须自己从
  `props.spot`(dialog 内)/`activeSpot`(面板计算属性)读,而不能指望 dialog 把它们
  塞进事件参数。** 已在此登记,供 T8 接线时参考,不属于本任务遗留缺陷。

## 遗留疑问 / 交给 T5-T8 的接口点

1. **T5 的"查看全部 N 张"可点 more**:上面已留好分叉点(方案 A),T5 需要自己加
   `.is-clickable`(或等价名)变体叠加 `cursor: pointer`,并接 `@click`。
2. **T8 容器接线**需要:
   - 把 `activeSpotKey` 接到路由/本地 state(brief 未指定持有形式,只说"容器持有")。
   - 把 `pick-spot` 接成设置 `activeSpotKey = spot.key`。
   - 把 `close-spot` 接成 `activeSpotKey = null`。
   - `rename` → `store.setSpotName(place.key, spot.key, name)`;`reset-name` →
     `store.resetSpotName(place.key, spot.key)`;`spotBusy` ← `store.spotBusy`。
   - `open-spot-library` 需要重建 Vue2 `openSpotLibrary` 的深链字段(见上一节)。
3. 未发现需要用户拍板的新决策——本任务范围内的分叉点(`.more` 手型)已按 brief §7c-9
   给出的两个可选方案之一落地,并留字面路标。

---

# Fix round 1 报告(评审 3 Important + 1 Minor)

评审结论:Spec ❌ / Needs fixes。申报的三条偏离里②(`.more` 基类剥手型)与③
(`openSpotLibrary` 六字段可由 T8 重建)独立核过成立、保留;①(重命名成功不退出编辑态)
被驳回,已按 I2 改正。

## I1:`.one-line` 补齐单行省略三件套

`PlaceSpotDialog.vue:104` 用了 `class="one-line"`,但本仓每个 SFC 都是 scoped 孤岛,
之前这个类在 `<style scoped>` 里没有任何规则,是个不生效的空壳类(长地点名会换行/溢出、
挤压右侧关闭钮)。回源核对 Vue2 `.one-line` 的实际声明:`NimoOS-UI/src/assets/scss/
common/_others.scss:55`(`display:-webkit-box; -webkit-box-orient:vertical;
overflow:hidden; text-overflow:ellipsis; word-break:break-all; -webkit-line-clamp:1`)。

**改法**:在 `PlaceSpotDialog.vue` 的 `<style scoped>` 里补了
`.spot-dialog-name .one-line { min-width:0; overflow:hidden; text-overflow:ellipsis;
white-space:nowrap; }`——沿用本仓已有先例 `src/files/viewers/ViewerShell.vue:47` 的
`.one-line` 写法(`white-space:nowrap` 版,视觉效果与 Vue2 的 `-webkit-line-clamp:1`
等价、写法更简单,该仓库另一处已经这样处理过同一个 Vue2 全局工具类),而不是逐字照抄
`-webkit-box` 写法。额外补了 `min-width:0`(flex 子项省略生效的前提,否则默认
`min-width:auto` 会撑开而不裁切)。

程序化断言:`PlaceSpotDialog.test.ts` 新增 `.one-line 单行省略(评审修复 I1)` 描述块,
读样式块原文断言 `.spot-dialog-name .one-line` 规则含 `text-overflow: ellipsis`。

## I2:重命名/恢复默认名成功后退出编辑态

评审驳回了原先"完全没有成功退出路径"的处理。回源核对 Vue2 `saveSpotName`
(`PhotosPlacesView.vue:495-516`):`await` 成功后立刻 `spotEditing = false`,只有失败
(catch 块空着)才保留编辑态。

**改法**:按评审给的推荐方案,新增 `watch(() => props.spot.name, () => { editing.value
= false })`。语义:`setSpotName` 成功后 store 就地回写 `detail.spots` 命中项的
`name`、`resetSpotName` 成功后 store `await loadDetail` 重拉——两条路径都会让父级传下来
的 `spot.name` 真的变化,这里跟着退出编辑态;失败时 name 不变,继续保持编辑态,不会
乐观撒谎。与已有的 `watch(() => props.spot.key, …)` 是两条独立的 watch,语义分工清楚
(key 变 = 换了个不同的 spot;name 变 = 当前 spot 改名成功)。

**已知边角**(评审已认可、按要求登记,不做处理):用户把草稿改成与当前名完全相同再保存,
`name` 不变,编辑态不退(Vue2 会退——它提交时无条件设 `spotEditing = false`,不区分
是否真的变了)。已在组件源码注释里登记。

同时更新了文件头"偏离登记 7"的说明,原文错误地写了"不在提交 rename 成功这件事上自动
退出编辑态"(这正是被驳回的那条),已改写为准确描述当前两条 watch 的分工。

测试:`改名成功/失败后的编辑态(评审修复 I2)` 描述块,两例——
① 改名成功(`setProps` 换新 `name`)→ 退出编辑态、非编辑态显示新名。
② 改名失败(`setProps` 传回相同 `name`,即使是新对象引用)→ 仍在编辑态。

## I3:`.spot-row:hover` 补 cssCascade 安全网

硬约束点名两处 hover 背景都要有 `winningHoverBackground` 断言,此前只补了
`.spot-dialog-btn:hover`,漏了 `PlaceDetailPanel.vue` 的 `.spot-row:hover`。已在
`PlaceDetailPanel.test.ts` 补 `hover 态背景(.spot-row,评审修复 I3)` 描述块,断言胜出
选择器含 `:hover`。

## M1:`.spot-rename-input` 边框 token 映射补注释

`.spot-rename-input` 的边框用 `--accent-soft-bd` 替代 Vue2 那条带回落值的 accent 半透明
token,是合理映射但此前没有登记。补了一行注释说明(**未写字面色值**,只描述语义——
color-guard 不剥注释,写字面色值会判红)。

## 删码验证(3 项新增守卫,一次删一处,验完用 Edit 手工切回,未用 `git checkout --`)

1. 删 `.spot-dialog-name .one-line` 规则里的 `text-overflow: ellipsis` → I1 断言用例红
   (`AssertionError: expected … to match /text-overflow:\s*ellipsis/`)。已切回。
2. 删 `watch(() => props.spot.name, …)` 整块 → I2「改名成功→退出编辑态」用例红
   (input 仍存在,`expected true to be false`)。已切回(同时保留了"改名失败仍在编辑态"
   这条对照用例始终绿,证明两条用例确实在测不同的东西)。
3. 删 `PlaceDetailPanel.vue` 的 `.spot-row:hover { background: var(--chip-bg); }` → I3
   用例红(`winningHoverBackground` 直接抛错"没有任何 background 规则命中
   .spot-row",因为规则集为空)。已切回,并确认恢复后位置与原样式表顺序一致
   (`.spot-row {} → .spot-row:hover {} → .spot-row .thumb {} …`)。

## 测试数字(fix round 1 前后)

| | 文件数 | passed | color-guard | tsc |
|---|---|---|---|---|
| fix round 1 前(task-4 原报告收尾时) | 284 | 2791 | 397 | 0 |
| fix round 1 后 | 284 | 2795 | 397 | 0 |

净增 4 例:PlaceSpotDialog.test.ts +3(I1 一例 + I2 两例)、PlaceDetailPanel.test.ts +1
(I3 一例)。color-guard 数字不变(397)——三条修复全部走 token/scoped 结构调整,未引入
新的裸颜色扫描对象。

命令:
```
pnpm exec vitest run src/photos/components/__tests__/PlaceSpotDialog.test.ts src/photos/components/__tests__/PlaceDetailPanel.test.ts src/styles/color-guard.test.ts
pnpm exec vue-tsc --noEmit
pnpm exec vitest run   # 全量:284 files / 2795 passed
```

## 遗留疑问

无新增。①的驳回已吸收进实现;②③两条偏离登记维持原状,已由评审独立核过。
