# Task 3 报告:SmartViewCard.vue —— 拼贴卡 + D15 占位态

状态:**DONE**
Commit:`65330b5`(单个 commit,含组件 + 测试)

## 改了哪些文件

- 新建 `src/photos/components/SmartViewCard.vue`
- 新建 `src/photos/components/__tests__/SmartViewCard.test.ts`
- `src/styles/theme.css` / `docs/THEMING.md`:**未改动**——grep 后确认本任务用到的所有
  token(`--chip-bg` `--fg-subtle` `--fg-muted` `--fg` `--card-bg` `--card-border`
  `--card-shadow-hi` `--radius-sm` `--font` `--bg` `--chip-radius` `--accent`
  `--accent-text` `--success`)在两套主题块里都已有值,不需要新增。

## 必含用例 → it 对应关系

| brief 必含用例 | 测试文件里的 `it` |
|---|---|
| 结构清点(7 个 class 存在) | `结构清点 > 渲染 .sv-collage / ...` |
| seeds 0/1/2/≥3 条 → 占位/img 计数 | `D15 占位态 > seeds.length === 0/1/2/>=3` 四条 |
| thumbnailUrl(seedId, 'large') 参数 | `D15 占位态 > thumbnailUrl 被调用的参数是...` |
| conds 2/3/7 条 chips | `条件 chips` 下三条 |
| 状态 pill live=true/false | `状态 pill` 下两条 |
| addedThisWeek 0/>0 | `本周新增` 下两条 |
| 点卡片 emit open,字符串 id(含数字 7→'7') | `点卡片 → emit open` 下两条 |
| 千分位跟 locale(源文本正则退化断言) | `千分位跟 locale > toLocaleString( 后面有参数` |
| 前景色合规(--on-accent 缺席 + theme-exception 注释干净) | `前景色合规` 下两条 |
| 名称截断(ellipsis + 父级 min-width:0) | `.sv-name 单行省略` |
| 渐变遮罩(linear-gradient) | `.sv-collage-overlay 渐变遮罩` |

共 21 个 `it`,均通过。另加一条非 brief 明确要求、但为完整性补的用例:两个 locale 下
`count=1234` 都渲染成 `1,234`(数值本身仍需一条断言兜底,只是不能靠它区分是否传了
locale 参数——这条本身在测试里加了注释说明为何只能钉数值不能钉 locale)。

## 7 条删码清单逐条验证结果

全部**逐个手工删除 → 跑测试确认变红 → Edit 手工还原**(未用 `git checkout --`)。

1. **①占位态 v-if/v-else 三处任取一处删** —— 结构选择:三个格子用 `v-for` 遍历
   `collageSlots`(而非 Vue2 那样三段各自手写的 img),故"删一处"操作上等价于把
   `v-else` 改成 `v-if="false"`(让占位分支永不渲染)。删后 3 条 seeds 长度用例
   (=0/=1/=2)全部变红(=3/≥3 那条因为本来就 0 占位,不受影响,符合预期)。**成立**,已还原。
2. **②`+N` 的 v-if 删** —— 删掉 `v-if="props.sv.conds.length > 3"` 后 `conds.length===2`
   与 `===3` 两条用例变红(多渲染出一个空的 `+N` chip)。**成立**,已还原。
3. **③`slice(0,3)` 删** —— `conds.length===7` 那条变红(渲染出 7 个 chip 而非 4 个)。
   **成立**,已还原。
4. **④`emit('open', String(...))` 的 `String()` 删** —— 数字 id(`7`)那条变红
   (`emitted` 收到 `[[7]]` 而非 `[['7']]`)。**成立**,已还原。
5. **⑤`toLocaleString` 的 locale 参数删** —— **第一次验证时踩了一个真实假阴性坑,详见
   下方"验证过程中发现并修的自身缺陷"**。修完测试后重新验证:删掉真实模板里的
   `localeTag` 参数,对应用例变红。**成立(修测试后)**,已还原实现。
6. **⑥`.sv-name` 的 `text-overflow` 删** —— 截断用例的第一条断言变红。**成立**,已还原。
7. **⑦`.sv-meta` 的 `min-width: 0` 删** —— 截断用例的第二条断言变红。**成立**,已还原。

**本任务 7 条删码清单全部成立,没有"不成立"的条目**(与 T1/T2 不同)。

## 验证过程中发现并修的自身缺陷(诚实登记)

删码验证 ⑤ 第一次跑,发现测试**没有变红**——即便我已经把模板里的
`toLocaleString(localeTag)` 改成裸 `toLocaleString()`。排查后发现两个独立问题,都已修:

1. **源文本正则的扫描范围过宽**:测试最初直接对整份 `SmartViewCard.vue?raw` 源文件做
   `/toLocaleString\(\s*[a-zA-Z]/` 正则,而组件头部的中文注释里恰好写了一句
   `sv.count.toLocaleString(locale)` 作为设计说明——这句注释本身就能让正则命中,导致
   即使模板里的真实参数被删掉,断言依然通过(假阴性)。**改法**:把断言范围收紧到
   `<template>` 块内的文本,不再扫 `<script>` 里的注释。
2. **收紧范围时用非贪婪正则又踩了一次 Minor-11 同型坑**:本组件模板内部还有一个
   `<template v-for="(slot, i) in collageSlots">` 循环包装标签——用非贪婪
   `<template[^>]*>([\s\S]*?)<\/template>` 去提取"外层 SFC 模板块"时,正则会在**内层**
   那个 `<template>` 的 `</template>` 处就提前收尾,截出一段不到内层循环结束、根本不含
   `.sv-stats`/`toLocaleString` 的残缺文本——断言因此对着一段不相关的文本做检查,同样
   会产生假阴性。**改法**:改用贪婪匹配 `[\s\S]*`(不带 `?`),取文件里**最后一个**
   `</template>`,即整个 SFC 模板块的真实结束标签。

这两处都已在测试文件里用注释登记(见 `describe('千分位跟 locale...')` 块内的注释),
不是事后无痕修复。修完后重新完整跑了一遍全部 7 条删码验证,确认无回归。

## 回源核对结论

- **模板(Vue2 `PhotosSmartViewsView.vue:244-285`)**:逐段核对,结构、字段读取
  (`sv.seeds[0]`/`slice(1)` 等价于 `seeds[1]`/`seeds[2]`)、`conds.slice(0,3)` +
  `+N`、`sv.count.toLocaleString()`、`sv.addedThisWeek > 0` 分支、`sv.threshold`
  阈值文案,全部一致。**出入**:
  - `photoUrl(seed)` 的数字索引回落分支(`:350-358`,时间线照片顶替空位)刻意不迁,
    已在组件头部注释登记为 D15 唯一的行为性偏离。
  - `emit('open', sv)` 改为 `emit('open', String(sv.id))`,已在组件头部与 brief §7e-2
    对齐登记。
- **样式(`photos-smartview.scss:26-117`)**:逐条核对 `.sv-card`/`.sv-collage`/
  `.sv-collage-main`/`.sv-collage-overlay`/`.sv-collage-badge`/`.sv-collage-status`/
  `.live-dot`/`[data-paused="true"]`/`.sv-meta`/`.sv-name`/`.sv-conds`/`.sv-cond`/
  `.sv-stats`/`.sv-stats b`/`.sv-thresh-mini`,数值(padding/font-size/gap/border-radius
  等)全部照搬。**出入**(均已在组件里逐条注释登记):
  - `.sv-card` 的 `border-radius` Vue2 是字面 `14px`,本仓无逐值对应 token,按 brief
    的 token 映射表就近取 `--radius-sm`(18px),不留裸字面量。
  - `.sv-card:hover` 的 `border-color` 变化(Vue2 用 `--line-strong`)本仓没有对应
    token(grep 确认两套主题块均无此 token 也无等价物),故只保留 transform + 阴影
    抬升,不引入未定义 token 或裸色字面量。
  - 徽标/状态背景色:Vue2 用 `rgba(var(--accent-rgb), 0.85)` / `rgba(0,0,0,0.55)`——
    本仓没有 `--accent-rgb`(plan Global Constraints §33),徽标背景改用
    `color-mix(in srgb, var(--accent) 85%, transparent)`(token 驱动,不需要
    theme-exception);状态背景保留字面 `rgba(0, 0, 0, 0.55)` + theme-exception(照
    `PhotosGrid.vue` `.tile-vid` 视频徽标的既有先例)。
  - `.sv-cond`/`.sv-thresh-mini` 的圆角、`--surface-2`/`--surface-3` 统一映射到本仓
    唯一的 chip 相关 token(`--chip-bg`/`--chip-radius`),因为本仓没有区分
    surface-2/surface-3 两档。
  - `.live-dot` 与暂停态点色:Vue2 字面 `#34C759`/`#FF9F0A` 保留字面值 +
    theme-exception(判断依据:这两个点始终叠在固定深色徽标底 `rgba(0,0,0,0.55)`
    之上,与页面明暗主题无关,若改用 `--dem-fg` 这类随主题变化的语义 token,浅色主题下
    该 token 会变成深棕色,叠在恒定暗底上会看不清——这是仅针对"叠在固定暗底 chrome
    上"这个特殊场景的判断,不是否定 Global Constraints §34 提到的
    `#34C759`/`#FF9F0A` → 语义 token 这条通用映射规则,那条规则用在了别处
    (`.sv-added`,见下)。
  - `.sv-stats` 的"本周新增"绿色:Vue2 内联 `style="color:#34C759"`,这里改用
    `--success` token(SearchDialog.vue `.media-acc-num` 的既有先例),因为这个 span
    在 `.sv-meta` 的普通卡片背景上,不是压在照片上的 chrome,可以正常走随主题变化的
    语义 token。

## 新增 token

**没有新增任何 token。** 动手前 grep `theme.css` 确认以下全部已存在且两套主题都有值:
`--chip-bg` `--fg-subtle` `--fg-muted` `--fg` `--card-bg` `--card-border`
`--card-shadow-hi` `--radius-sm` `--font` `--bg` `--chip-radius`(单值,非颜色,
两套主题共享)`--accent` `--accent-text` `--success`。因此 `docs/THEMING.md` 无需改动。

## 测试小结

- 新增 21 例,`SmartViewCard.test.ts` 全部通过。
- `pnpm exec vitest run`:292 个测试文件、3056 例全部通过(含新增文件)。
- `pnpm exec vue-tsc --noEmit`:exit 0。
- `pnpm exec vitest run src/styles/color-guard.test.ts`:绿(413 例,含
  `SmartViewCard.vue 无裸颜色字面量` 这一条——过程中发现并修了一处：解释性注释里写了
  字面 `#34C759` 触发误判,已改成文字描述"iOS 系统绿",不再写字面 hex)。
- `pnpm exec vitest run src/i18n/parity.test.ts`:绿(本任务零 i18n 改动,只读用了
  Task 1 已加好的 5 个键,确认 grep 到的拼写与 brief 一致,无需回退到"既有键"名单)。

## 偏离登记汇总(便于下游任务查阅)

1. D15 占位态(核心交付,已在组件头部大段注释登记)。
2. `emit('open', id)` 只传字符串 id,不传整个 sv 对象(§7e-2)。
3. `sv.count.toLocaleString(locale)` 需要把本仓 `zh_cn`/`en_us` 转成 BCP-47 标签
   (`locale.value.replace('_','-')`)才能安全调用——踩到的真实坑:裸传 `'zh_cn'`
   给 `Intl`/`toLocaleString` 会抛 `RangeError: Incorrect locale information
   provided`(下划线不是合法 BCP-47 分隔符)。已按本仓既定写法(`PlacesRail.vue:84`
   / `PersonHero.vue:113` / `relTime.ts:21` 等先例)加 `localeTag` computed 转换,
   brief 原文没提到这个坑,补充登记供其余任务(T4 及后续消费 locale 的组件)参考。
4. `.sv-name` 单行省略三件套 + 父级 `.sv-meta` `min-width: 0`(Vue2 无对应)。
5. `.sv-card` 圆角就近取 `--radius-sm`、hover 边框色改变不迁移(见"回源核对"部分)。
6. `.sv-added`(本周新增绿色 span 的 class 名)是本组件新起的名字,Vue2 无对应 class
   (只有内联 style),这是net-new 命名,不是照搬。

## Concerns

无。
