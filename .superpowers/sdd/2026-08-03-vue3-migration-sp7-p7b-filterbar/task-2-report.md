# Task 2 报告:PhotosFilterBar.vue + 4 个 i18n 键

## 实现了什么

- `src/i18n/zh_cn.ts` / `src/i18n/en_us.ts` 各新增 4 键(`photosFilterByExif` /
  `photosFilterYear` / `photosFilterLocation` / `photosFilterCamera`),文案逐字取自
  简报表格,插在 `photosCopied` 之后、"── 相册:收藏视图 ──" 注释之前(两个文件相对位置
  一致,只追加不重排)。
- `src/photos/components/PhotosFilterBar.vue`:漏斗 + 三胶囊 EXIF 筛选条,消费 T1 的
  `photoYear`/`FilterablePhoto` 与 P7a 的 `PhotosFilterChip`/`PhotosFilterPopover` 基元。
  导出 `ChipKey`/`ExifFilterValue` 两个类型供 T4/T5 使用。5 处偏离登记(数据源外注 /
  chipKeys / F1 修复 / mounted watcher 语义 / 无 Esc)均照简报写入组件头部注释;另补了
  第 6 条(见下方"相对简报的偏离")。
- `src/photos/components/__tests__/PhotosFilterBar.test.ts`:19 个用例,覆盖展开/收起、
  facet 取值(年份倒序去重+F1 反 NaN、位置/相机取段去重排序)、草稿/提交/取消/重开快照、
  胶囊清除/清除全部、chipKeys(D19)、弹层空态文案分支、点外部关闭、卸载解绑监听、hover
  特异性硬约束。

## 测了什么、结果如何

```
pnpm exec vitest run src/photos/components/__tests__/PhotosFilterBar.test.ts src/i18n/parity.test.ts src/styles/color-guard.test.ts
```
→ 3 files / 488 tests all passed,无 stderr 警告(单独跑本文件时也确认干净:18/18 通过,
之前一次批量运行里看到的 `Vue warn: Component "i18n-t" has already been registered` 只出现
在某次失败态的中间运行,修好后复跑多次均未再出现,不视为遗留问题)。

```
pnpm exec vue-tsc --noEmit
```
→ exit 0,无输出。

### hover 断言的变异验证证据

按控制器指示的处置顺序:

1. 先读 `cssCascade.ts` 与 `PhotosFilterChip.test.ts` 的真实调用——确认
   `winningHoverBackground(styleText: string, classes: string[]): HoverBgRule`,
   第一参是 `extractStyleBlock()` 的原始样式文本(不是 `parseCssRules()` 解析后的数组),
   返回值是 `{ selector, specificity, value, order }` 对象,不能直接 `toBe` 字符串。
2. 未修改 `cssCascade.ts`。
3. 把简报里的
   `const rules = parseCssRules(extractStyleBlock(barRaw)); winningHoverBackground(rules, [...])`
   改成
   `const style = extractStyleBlock(barRaw); const winner = winningHoverBackground(style, ['exif-funnel', 'on'])`,
   断言改为 `winner.selector` 含 `:hover`/`on`,`winner.value` 等于 `'var(--accent-soft)'`。
   `classes` 参数用 `['exif-funnel', 'on']` 而非只传 `['exif-funnel']`——变体选择器
   `.exif-funnel.on:hover` 里的 `.on` 类必须在白名单内,否则 `hoverBackgroundRules` 会因为
   "选择器里出现了白名单之外的类"排除这条变体规则,只剩基类 `:hover` 可见,测不出"基类是否
   顶掉变体"这件事(与 `PhotosFilterChip.test.ts:111` 传 `['fchip']` 的道理一致——那边变体
   是属性选择器 `[data-on="true"]`,不计入 `classHits`,所以传单类没问题;我们这边变体是
   `.on` 类,必须一并传入)。

变异验证(临时删除 `.exif-funnel.on:hover` 规则块,只跑 hover 用例):

```
pnpm exec vitest run src/photos/components/__tests__/PhotosFilterBar.test.ts -t "hover"
```
删除前:PASS。
删除后:
```
AssertionError: expected '.exif-funnel:hover' to contain 'on'
Expected: "on"
Received: ".exif-funnel:hover"
```
—— winner 回退成基类 `.exif-funnel:hover`,证明测试确实在验证"变体 hover 规则存在且赢过
基类"这件事,不是摆设断言。恢复规则块后重跑,回到 PASS(已用 `diff`/重新跑三件套 + tsc
确认恢复无误、无残留改动)。

## TDD 证据

**RED**(Step 3,组件文件尚不存在):
```
pnpm exec vitest run src/photos/components/__tests__/PhotosFilterBar.test.ts
```
```
FAIL  src/photos/components/__tests__/PhotosFilterBar.test.ts [ ... ]
Error: Failed to resolve import "../PhotosFilterBar.vue" from
"src/photos/components/__tests__/PhotosFilterBar.test.ts". Does the file exist?
Test Files  1 failed (1)
     Tests  no tests
```
预期红:测试引用的组件文件还没创建,Vite 的 import 解析直接失败,是预期失败(不是断言失败,
而是"目标不存在"这类更彻底的红,符合 Step 3 的 Expected)。

**中途一次真实断言红**(不在简报步骤里,是我实现时踩到的真问题,记录在此供追溯):写完
Step 4 的组件代码后首次跑三件套,冒出两个新红:
1. `color-guard.test.ts`——组件 `<style>` 注释里逐字抄了简报的
   "白色角标文字 #fff → --on-accent"这句话,`color-guard` 不剥离 CSS 注释,凡是匹配
   `#[0-9a-fA-F]{3,8}` 的文本一律判定裸色字面量,连注释里的说明性文字都会命中。
2. `PhotosFilterBar.test.ts` 的"挂载时已有筛选值 → 自动展开"用例——简报原始实现在
   `onMounted` 里改 `expanded.value = true`,Vue3 该次改动触发的重渲染排到 microtask 才
   flush;测试是同步函数、mount() 后不 `await` 直接断言 class,读到的是挂载前的初始值。
   用最小复现例证实(见下方"自查发现")后改为 `expanded` 的初始值直接取
   `anyActive.value`(setup 阶段同步可算),`onMounted` 里仍调用 `expand()` 补上 450ms
   溢出定时器副作用。

**GREEN**(Step 5,修完上述两处后):
```
pnpm exec vitest run src/photos/components/__tests__/PhotosFilterBar.test.ts src/i18n/parity.test.ts src/styles/color-guard.test.ts \
  && pnpm exec vue-tsc --noEmit
```
```
Test Files  3 passed (3)
     Tests  488 passed (488)
```
tsc 无输出,exit 0。

## 改了哪些文件

- `src/i18n/zh_cn.ts`(+4 行)
- `src/i18n/en_us.ts`(+4 行)
- `src/photos/components/PhotosFilterBar.vue`(新建)
- `src/photos/components/__tests__/PhotosFilterBar.test.ts`(新建)

## glyph 回源核对结论

用脚本从 Vue2 `NimoOS-UI/src/views/Photos/PhotosIcon.vue` 精确抽取 `filter`/`clock`/
`map`/`settings` 四个 `name` 分支里的全部 `d="..."` 属性值,逐字符与本组件模板里对应的
`<path d="...">` 做集合比对,4 处(filter 1 条、clock 1 条、map 2 条、settings 1 条,
共 5 条 `d` 属性)全部逐字符一致,无漏抄无错抄。

## 自查发现

1. **hover 断言签名不符**(简报已预警的不确定性):按控制器给的处置顺序修正,见上方
   "hover 断言的变异验证证据"。
2. **组件 `<style>` 注释里的 "#fff" 触发 color-guard**:`color-guard.test.ts` 逐行扫描
   `<style>` 块文本、不剥离 `/* */` 注释,凡出现 `#[hex]` 形态即判定裸色字面量,不区分
   "这是真实的 CSS 值" 还是 "这只是注释里说明用的十六进制写法"。把注释里的
   "白色角标文字 #fff → --on-accent" 改写成 "角标原为写死的纯白文字 → --on-accent",
   去掉字面 hex 串,语义不变。（这是本仓 color-guard 工具本身"扫描不区分注释/实值"的已知
   粗粒度行为,其余组件里能看到类似情况都改用不写字面 hex 的说法来描述,不是本任务新增的
   规避手段。）
3. **`onMounted` 改 ref 在 Vue3 下不同步生效**:简报 Step 4 给的实现在 `onMounted` 里赋值
   `expanded.value = true`,而 Step 2 给的测试之一在 `mount()` 后不 `await` 就断言
   class——这两者按字面组合会红。用一次性最小复现例证实(`onMounted` 内改 ref、不 await
   直接断言 class → 断言不到),排除是我实现有 bug 之外的可能性后,改成初始值直接取
   `anyActive.value`(见组件"偏离登记 5"注释)。

## 相对简报的偏离(逐条)

1. **hover 断言写法**(简报已预告的不确定性,按控制器处置顺序修正):见上方详述,不改
   `cssCascade.ts`。
2. **`<style>` 注释去掉字面 "#fff"**:避免触发 color-guard 的误报,语义不变(见自查发现 2)。
3. **`expanded` ref 初始值改为 `ref(anyActive.value)`,不再是 `ref(false)` 靠 `onMounted`
   赋值生效**(组件内"偏离登记 5"):解决 Vue3 异步渲染与"挂载时已有筛选值 → 立刻展开"这条
   同步断言的冲突,行为结果与简报描述的目标态完全一致(挂载时若已有筛选值,渲染出的 DOM
   即带 `expanded`/`on` 类、角标数字正确),只是达成方式从"onMounted 里异步触发"改成
   "setup 阶段同步初始化"。`onMounted` 里仍保留 `expand()` 调用,以补上 450ms 溢出定时器
   这条必要副作用。
4. 其余(组件结构、prop/emit 接口、CHIP_DEFS 顺序、facet 逻辑、草稿/提交/清除逻辑、glyph、
   token 映射、style 数值)与简报逐字一致,无其他偏离。

## 问题与顾虑

无阻塞性问题。上述 3 处偏离均已在代码/报告里登记,且都不影响简报定义的最终行为契约
(接口签名、可见 DOM/CSS 结果、i18n 键值)。

---

# Fix round 1/5(评审回来的 2 项必修)

## 必修 1(spec ❌,人已裁定):`.exif-funnel:hover` 多了一行 Vue2 没有的 background

**改了什么**:`src/photos/components/PhotosFilterBar.vue` 的 `.exif-funnel:hover` 规则删掉
`background: var(--chip-bg-hi);` 一行,只保留 `color`/`border-color`,与 Vue2
`NimoOS-UI/src/views/Photos/PhotosFilterBar.vue:251`
(`.exif-funnel:hover { color: var(--text-1); border-color: var(--accent-glow); }`)逐字对齐。
按裁定结论:这是简报文本自身的漂移,不算"有意偏离",不补偏离登记,只在规则上方留一条
fix round 1 说明注释(改了什么、为什么、依据哪条裁定)。`.exif-funnel.on:hover` 变体规则
原样保留不动(仍显式声明 `background: var(--accent-soft)`)。

**变异验证(重跑,证据如下)**:临时把 `.exif-funnel.on:hover` 整块规则删掉,只跑 hover 用例:

```
pnpm exec vitest run src/photos/components/__tests__/PhotosFilterBar.test.ts -t "hover"
```
删除前(修复后的正常状态):PASS。
删除后:
```
FAIL  ... > hover 特异性硬约束 > .exif-funnel.on 的 hover 背景不被基类 .exif-funnel:hover 顶掉
Error: 没有任何 background 规则命中 .exif-funnel.on
  ❯ winningHoverBackground src/photos/components/__tests__/cssCascade.ts:92:33
```
（这次基类 hover 也不再声明 background 了,删掉变体后连"基类顶掉变体"的旧险情都不成立了——
`hoverBackgroundRules` 在两条规则都不匹配时直接抛"没有任何 background 规则命中"的错误,
仍然是确定性的红,证明测试仍然锚定在"`.exif-funnel.on:hover` 这条变体规则必须存在
且声明 background"这件事上,不是摆设。）
恢复规则块后重跑同一条命令,回到 PASS。

## 必修 2(Minor,补测定时器副作用):挂载即展开的用例补 450ms → `.ov` 断言

**改了什么**:`src/photos/components/__tests__/PhotosFilterBar.test.ts` 的
"挂载时已有筛选值 → 自动展开,漏斗带 .on,角标显示总数" 用例改成 `async`,末尾追加
`vi.advanceTimersByTime(450); await w.vm.$nextTick(); expect(w.get('.exif-filter').classes()).toContain('ov')`,
钉住"同步初始化 expanded 之后,`onMounted` 仍要补排 450ms 溢出定时器"这条副作用。

**变异验证(证据如下)**:临时删掉 `onMounted(() => { if (anyActive.value) expand() })`
这一行(只留 `watch(anyActive, ...)` 那条 watcher),跑该用例:

```
pnpm exec vitest run src/photos/components/__tests__/PhotosFilterBar.test.ts -t "挂载时已有筛选值"
```
删除前(修复后的正常状态):PASS。
删除后:
```
FAIL  ... > 挂载时已有筛选值 → 自动展开,漏斗带 .on,角标显示总数
AssertionError: expected [ 'exif-filter', 'expanded' ] to include 'ov'
```
—— `expanded` 类仍在(因为初始值直接取 `anyActive.value`,这条不受影响),但 450ms 后
`.ov` 类始终不出现,证明新断言确实钉住了"忘记在 mounted 时补排定时器"这条回归路径。
恢复该行后重跑同一条命令,回到 PASS。

## 覆盖测试与命令(本轮只跑受影响文件,未跑全量)

```
pnpm exec vitest run src/photos/components/__tests__/PhotosFilterBar.test.ts src/styles/color-guard.test.ts
```
```
Test Files  2 passed (2)
     Tests  481 passed (481)
```

```
pnpm exec vue-tsc --noEmit
```
→ exit 0,无输出。

## 改了哪些文件

- `src/photos/components/PhotosFilterBar.vue`(删 1 行 background,加 1 段 fix round 1 说明注释)
- `src/photos/components/__tests__/PhotosFilterBar.test.ts`(1 条用例改 async 并追加 3 行断言)

## 其余 3 条 Minor

按协调方指示,本轮未动:①角标/清除全部对不可见维度的幽灵值处理 ②卸载解绑用例验 mock
而非真行为 ③点组件内部不关弹层分支未覆盖 + wrapper 跨用例残留。均维持挂账状态。
