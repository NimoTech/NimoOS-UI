# Task 4 报告:设置页 AI 卡 `PhotosAiCard.vue`

## 实现内容

新增 `src/photos/components/PhotosAiCard.vue`(设置页 AI 卡组件)+
`src/photos/components/__tests__/PhotosAiCard.test.ts`(18 个测试用例)。

回源坐标:Vue2 `NimoOS-UI/src/views/Photos/PhotosSettings.vue:129-192`(模板)、
`:283-291`(`rebuildTask` watcher)、`:332-370`(`rebuildTask`/`indexing`/`indexedPct`/
`coverageCount`/`lastBuiltText`/`featureRows`)、`:458-486`(`rebuildIndex`/`doRecluster`)。

### 7 条逐条 1:1 契约的落地情况

1. **4 个功能开关顺序固定** faces→scenes→ocr→smartview(`featureRows` computed,数组字面量顺序即渲染顺序)。开关是 `.st-switch[data-on]` 形态(div + `:data-on="store.aiFeatures[f.id]"`,照抄 Vue2 的 div 结构而非复用本仓已有的 `SettingsSwitch.vue`/button 形态,因为 brief 明确点名 `.st-switch[data-on]` 这个选择器作为 hover 守卫断言目标)。
2. **`rebuildTask` 查找优先级**:先按本地记住的 `rebuildTaskId`(用 `String()` 比较,应对后端 id 可能是 string|number 的"id 铁律"),找不到再找任意 `type === 'rebuild'` 的任务,再没有就 `null`。
3. **`indexing`/`indexedPct`**:`indexing = rebuildTask?.status === 'running'`;`indexedPct = Math.round((progress || 0) * 100)`,明确注释标注后端 progress 是 0-1 小数。
4. **rebuild 完成/失败 toast**:用 `watch(rebuildTask, (task, old) => {...})` 判定 `old.status==='running' && task.status==='done'` 的跳变才弹"已重建"+重拉 `about`;`status==='error'` 弹失败(不要求跳变,与源一致)。
5. **`lastBuiltText`**:`about.indexLastBuilt` 为空 → `photosSettingsIndexNever`;否则用 `Intl.DateTimeFormat(locale.replace('_','-'), {year,month,day,hour,minute})` 格式化(**偏离登记**,见下)。
6. **`doRecluster` 3 秒防抖**:成功/失败都在 `finally` 里 `setTimeout(() => reclustering.value = false, 3000)`。
7. **`coverageCount = about?.indexCoverage ?? 0`**。

### 偏离登记(按项目铁律,Vue2 的 bug 不照抄)

**lastBuiltText 的 locale 缺陷**(brief 契约 5 已预先指出,我核对 Vue2 源确认属实):
Vue2 `:346` `new Date(iso).toLocaleString()` 不传 locale 参数,结果跟随浏览器/系统语言,
中文界面下会渲染出英文月份缩写(与 spec §7c-2/§7e-4 同类缺陷)。已改为显式跟随 i18n
locale,套用 `src/photos/util/relTime.ts:18-22`、`PlacesRail.vue:84`、
`PlaceDetailPanel.vue:120`、`PersonHero.vue:113` 的既有写法(`locale.value.replace('_','-')`
转 BCP-47 标签喂给 `Intl.DateTimeFormat`)。保留了 `toLocaleString()` 的"日期+时间"语义
(Intl 选项含 `hour`/`minute`,不是 `toLocaleDateString()` 的纯日期)。代码里已注释登记
(文件头 + `lastBuiltText` computed 上方)。

**没有发现 brief 与 Vue2 源冲突的数值**——contract 1-7 的行号、判据回源核对后与 brief 描述一致。

## 测试

`pnpm exec vitest run src/photos/components/__tests__/PhotosAiCard.test.ts --reporter=verbose`

**18/18 passing,0 `[Vue warn]`**(用 `grep -c "\[Vue warn\]"` 对同一次 verbose 输出计数确认为 0,不是凭默认 reporter 目测)。

覆盖 brief Step1 列出的全部用例(逐条对应,未跳过任何一条):
- 4 个开关顺序固定
- 点开关调 `setAiFeature(id, 新值)`;失败/成功两条分支(toast 有/无)
- `indexedPct` 0-1→百分数换算(progress 0.42→42%)
- `rebuildTask` 查找优先级(先 id 命中,再 type 兜底;补一条"id 未命中时纯靠 type 兜底"的对偏用例)
- 跳变判据:先 done(无 running 前态)零 toast → running→done 恰一条 toast → 再刷新同状态不重复弹(补齐"重复刷新不应二次弹"的显式断言)
- running→done 跳变后重拉 `about`(补一条独立断言 `fetchAbout` 恰好调用 1 次)
- running→error 弹失败 toast 附带 `task.error`
- lastBuilt 为空显示 never;`about` 为 `null`(取数前)不崩溃且 coverage 显示 0
- lastBuilt 日期跟随 i18n locale(断言不出现英文月份缩写 `Mar`)
- recluster 3 秒防抖(2999ms 仍禁用,+2ms 解禁);失败分支同样 3 秒后解禁
- rebuild-index 按钮 indexing 时禁用;点击非 409 失败时兜底 toast
- mount 时不主动取数(`fetchAiFeatures`/`fetchAbout`/`fetchTasks` 均未被调用,验证"容器统一取数"分工)
- hover 级联守卫(`.st-switch[data-on]` 变体自带 `:hover`)

## TDD 证据

**RED**(移走刚写好的实现文件,证明测试确实会因为组件不存在而失败,不是空转):
```
mv src/photos/components/PhotosAiCard.vue <scratchpad>/PhotosAiCard.vue.bak
pnpm exec vitest run src/photos/components/__tests__/PhotosAiCard.test.ts --reporter=verbose
```
输出:
```
Error: Failed to resolve import "../PhotosAiCard.vue" from
"src/photos/components/__tests__/PhotosAiCard.test.ts". Does the file exist?
Test Files  1 failed (1)
     Tests  no tests
```
预期原因:组件文件不存在,`import PhotosAiCard from '../PhotosAiCard.vue'` 直接在 Vite 转换阶段报错,连测试都无法收集——这是最直接的 RED 证据(证明测试文件真的在 exercise 那个组件,不是空壳)。

**GREEN**(移回实现文件后):
```
mv <scratchpad>/PhotosAiCard.vue.bak src/photos/components/PhotosAiCard.vue
pnpm exec vitest run src/photos/components/__tests__/PhotosAiCard.test.ts --reporter=verbose
```
第一次跑出 17/18(见下"测试自身的 bug"),修正测试 fixture 后 18/18 全绿。

### 测试自身的 bug(如实登记,不是实现 bug)

"rebuildTask 查找优先级" 用例的第一版把 rb-other(排在前面、后备命中的 type=rebuild 任务)
也写成 `status: 'running'`,导致 `indexing` 在点击前已经为真(有一个 rebuild 任务在跑),
`rebuild-index` 按钮被 `:disabled="indexing"` 禁用,`trigger('click')` 在 jsdom 里对
disabled 按钮不触发 click 监听器,组件从未调用 `store.rebuildIndex()`,断言用测试里"看到的
是 rb-other 的 10% 而不是 rb-target 的 90%"精确暴露了这个 fixture 设计缺陷。修法:把
rb-other 改成 `status: 'done'`(不占用 indexing 守卫),rb-target 才是 `running`,点击前
断言按钮未禁用,点击后再断言绑定到 rb-target。这是测试 fixture 本身的问题,不是组件逻辑
问题——组件的优先级判定逻辑本身第一次跑就是对的(只是测试没能真正驱动到"点击"这一步)。

## Step 6:变异验证(4 项,逐一执行 → 确认变红 → 手工改回,未使用 git checkout/stash)

全部通过手工编辑 + 手工改回(非 git 操作),遵守"禁止 git checkout/stash"约束。

1. **跳变判据改成 `task.status === 'done'`**(去掉 `old.status==='running'` 前置条件):
   `-t "只在"` 用例变红——`expect(wrapper.emitted('toast')).toBeFalsy()` 在"先置成 done(无
   running 前态)"这一步就失败(实际收到一条 sparkles toast,因为改坏后不需要跳变就弹)。✅ 已改回。

2. **`indexedPct` 删掉 `* 100`**:`-t "indexedPct"` 用例变红——`expect(...).toContain('42%')`
   实际收到 `'width: 0%;'`(0.42 被 `Math.round` 直接舍成 0)。✅ 已改回。

3. **3000 改成 0**:`-t "recluster 点一次后"` 用例变红——`advanceTimersByTimeAsync(2999)` 后
   断言 `disabled` 应仍存在,实际已是 `undefined`(0ms 后立刻解禁)。✅ 已改回。

4. **`toLocaleString()`/`Intl.DateTimeFormat` 传死 `'en'`**:`-t "locale"` 用例变红——
   `expect(text).not.toMatch(/\bMar\b/)` 失败,实际渲染出 `"Mar 15, 2026, 04:30 PM"`。✅ 已改回。

**追加一项(Step 5 hover 守卫的删码验证,brief 明确要求)**:删掉
`.st-switch[data-on="true"]:hover` 那条规则,`-t "hover"` 用例变红——
`winner.selector` 变成 `.st-switch:hover`(基类胜出),`expect(...).toContain('data-on')`
失败,证明守卫确实在盯这条规则而不是空转。✅ 已改回。

4 项变异验证 + 1 项 hover 删码验证均按预期变红,恢复后 `pnpm exec vitest run
src/photos/components/__tests__/PhotosAiCard.test.ts --reporter=verbose` 重跑确认
18/18 恢复全绿(输出见上方 GREEN 小节倒数第二次命令)。

## 颜色 token

**零新增 token**——全部复用既有语义 token:
- `.aic-icon`(卡头 sparkles 图标底):`var(--accent-soft)` + `var(--accent)`。
  Vue2 原值是字面量渐变 `rgba(110,91,255,.2)/(255,154,194,.2)`——比照 T3
  (`PhotosStorageCard.vue`)对 Vue2 字面量 `#6E5BFF` 就近映射到既有
  `--accent-soft`/`--accent` 而不新增 token 的先例,这里同样处理。
- `.aic-privacy`/`.aic-privacy-icon`/`.aic-privacy-title`(隐私横幅):`var(--sem-bg)`/
  `var(--sem-bd)`/`var(--sem-fg)`。Vue2 原值是精确的 iOS 绿 `rgba(52,199,89,α)`/`#34C759`,
  本仓已有通用"成功/正向"语义三件套 `--sem-bg`/`--sem-fg`/`--sem-bd`(RAID 健康态、搜索
  语义结果等多处复用,色相是青绿而非苹方绿)——判断为同一"成功/安全"语义,不再造一份
  几乎重复的 token。
- `.aic-progress > div`(重建进度条):`linear-gradient(90deg, var(--accent), var(--accent2))`。
  Vue2 原值 `linear-gradient(#6E5BFF,#B8AAFF)`,用既有强调色渐变复刻观感。
- `.st-switch` 开关本体:照搬本仓已有的 `.set-switch`(`settings/styles/settings.css`)/
  `.ss-switch`(`SnapshotSettingsDialog.vue`)惯例——关态 `var(--chip-bg)` + `var(--border)`
  描边,开态实底 `var(--accent)`,把手关态 `var(--fg)`、开态 `var(--on-accent)`。

决策依据:T3 已经证明"Vue2 字面量色值 → 就近映射到既有语义 token"是本期认可的做法
(而不是每个字面量色都新造一个几乎重复的 token),本卡延续同一判断标准。
`docs/THEMING.md` **未改动**(没有新增 token,不需要补文档条目)。

## 自查(Self-review)

- **7 条契约**:逐条核对已在上文"7 条逐条 1:1 契约的落地情况"列出,均已实现且有对应测试锁定。
- **derived state 均为 computed**:`rebuildTask`/`indexing`/`indexedPct`/`coverageCount`/
  `lastBuiltText`/`featureRows` 全部是 `computed`,唯二本地可变状态是 `rebuildTaskId`
  (`ref('')`)与 `reclustering`(`ref(false)`),与 ruling #4 一致。
- **命名**:`doRebuild`/`doRecluster`/`toggleFeature` 均是动词开头、说明动作意图。
- **纪律**:未做无关重构,未碰 `PhotosStorageCard.vue`/`settings.ts`/`timeline.ts`/i18n 文件。
- **测试验证渲染行为而非 mock 回声**:所有断言都读 `wrapper.text()`/`wrapper.get(...).attributes(...)`/
  `wrapper.emitted(...)`,没有断言"mock 被调用过"就算完事(除了专门验证"调用了哪个 action"
  的用例,那类用例同时也断言了 UI 层可观察结果,如 toast/禁用态)。
- **跳变测试genuinely 证明跳变要求**:测试显式走三段状态(先 done 无前态 → running →
  done → 再次刷新同 done),分别断言 0 条/1 条/仍 1 条 toast,不是只测"done 时弹一条"这种
  会被"状态为 done 就弹"的错误实现同样通过的弱断言。变异验证 #1 直接证实了这一点。

## 文件改动

- `/home/nimo/NimoTech/.sp7/NimoOS-New-UI/src/photos/components/PhotosAiCard.vue`(新建)
- `/home/nimo/NimoTech/.sp7/NimoOS-New-UI/src/photos/components/__tests__/PhotosAiCard.test.ts`(新建)
- `docs/THEMING.md`:未改动(零新增 token)。
- `src/styles/theme.css`:未改动(零新增 token)。

## 局部测试门(brief 要求的三项,全部跑过)

```
pnpm exec vitest run src/photos/components/__tests__/PhotosAiCard.test.ts --reporter=verbose
→ 18 passed (18), 0 [Vue warn]

pnpm exec vue-tsc --noEmit
→ 无输出(通过)

pnpm exec vitest run src/styles/color-guard.test.ts src/i18n/parity.test.ts
→ 754 passed (754)
```

未跑全量 ~5800 例套件(遵守 global-constraints.md"每个任务只跑局部测试"约定)。

## 挂账/后续

无新增挂账项。T5(容器)接线时需注意:
- 容器需在挂载时统一 `fetchAbout()`,本卡才能显示真实的 `lastBuiltText`/`coverageCount`。
- 容器需在挂载时 `timeline.fetchTasks()`(或已有轮询)才能让 `rebuildTask` 命中真实数据;
  本卡本身**不**触发任何取数(已有测试锁定这一条边界)。
- 容器承接 `@toast` 事件,渲染逻辑同 T3。

## 结论

无 brief-vs-源冲突需要上报(唯一的"缺陷"是 brief 契约 5 自己就已预先指出的 locale 缺陷,
已按铁律修正并注释登记)。DONE。
