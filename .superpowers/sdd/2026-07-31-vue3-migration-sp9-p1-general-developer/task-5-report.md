# Task 5 report — 壁纸 / 语言 / 时区 / 硬盘待机 四行

## 实现内容

新建 8 个文件(均按 brief 逐字实现,未改动导出符号名/组件文件名/CSS class):

- `src/settings/util/timezones.ts` — `TIMEZONES`(61 项),逐字抄自 `NimoOS-UI/src/components/settings/SettingsPanel.vue` L871-933(`diff` 校验内容完全一致,只去掉了 Vue2 侧的 `timezones: [ … ]` 包裹行)。
- `src/settings/util/standby.ts` — `STANDBY_OPTIONS`(9 项)+ `parseStandbyMinutes()`。
- `src/settings/util/standby.test.ts` — brief 给定的 7 个用例,先跑失败(模块不存在)确认后再实现。
- `src/settings/panels/general/WallpaperRow.vue` — 按钮禁用 + hint 说明(债务 D5:New-UI 无壁纸系统)。
- `src/settings/panels/general/LanguageRow.vue` — 只列 `zh_cn`/`en_us`(债务 D6),切换经 `useLocaleStore().persist()`,不自己写 system blob。
- `src/settings/panels/general/TimezoneRow.vue` — `onMounted` 只读不写;用户 change 才 `patchSystemConfig({ timezone })`。
- `src/settings/panels/general/DiskStandbyRow.vue` — `onMounted` 只读不写、不下发指令;用户 change 才 `patchSystemConfig` + `service.sys.setDiskStandby()`,下发失败 toast 提示但不回滚 select。
- `src/settings/panels/general/rows.test.ts` — brief 给定的共享测试文件,四行 16 个用例。

四行组件均无 props、无 emit,各自读写自己那一份配置,符合 brief 接口约定。

## 移植纪律落实

1. **加载不回写**:`TimezoneRow`/`DiskStandbyRow` 的 `onMounted` 只调用 `readSystemConfig()` 赋值给本地 `ref`,从不调用 `patchSystemConfig`。测试 `挂载**不**回写配置` 断言 `blob` 挂载后原样(`{ timezone: 'UTC' }`),通过。
2. **加载不下发指令**:`DiskStandbyRow` 的 `onMounted` 不调用 `service.sys.setDiskStandby`,只在 `onChange` 里调用。测试 `挂载后选中服务端值,且**不**下发 standby 指令` 断言 `standbyCalls` 为空数组,通过。
3. 两处均在代码注释里点名 Vue2 深度 watcher 的问题(见组件文件头注释)。

## 行号核对(纠正 brief 中的两处不准确引用)

- Vue2 `parseStandbyMinutes` 实际在 L1886-1890(非 brief 草稿里写的 L1093-1098),`disk_standby` watcher 在 L1230-1237(brief 引用准确),`standbyOptions` 定义在 L989-997。已在 `standby.ts` 注释里使用核实后的准确行号。
- 后端 400 校验实际在 `NimoOS/route/v1/system.go` 的 `PutDiskStandby`(L606-628),已核实存在(`minutes must be an integer` 分支),注释按此改写。
- 四个组件头部注释里的 Vue2 行号引用(L102-116 Wallpaper / L119-135 Language / L138-154 Timezone / L157-173 DiskStandby)经与源文件比对,均准确对应各自的 `<!-- … Row -->` 块。

## 命令与结果

```
pnpm test src/settings/util/standby.test.ts        # 实现前:1 file failed(模块不存在)
pnpm test src/settings/util/standby.test.ts        # 实现后:7 passed (7)
pnpm test src/settings/panels/general/rows.test.ts # 实现前:1 file failed(组件不存在)
pnpm test src/settings/panels/general/rows.test.ts # 实现后:16 passed (16)
pnpm test src/settings                             # 15 files passed, 128 tests passed
pnpm test                                           # 277 files passed (277), 2014 tests passed (2014)
pnpm exec vue-tsc --noEmit                          # 无输出 = 0 错误
```

**任务门**:baseline 275 files / 1987 tests → 现在 277 files / 2014 tests,文件数与用例数均超过 baseline,达标。`vue-tsc --noEmit` 零错误。

## Git

- `git status --short` 提交前确认:3 条 `design-export/*.html` 的 `D` 行存在且未被本次操作触碰;另有一条无关的 untracked `docs/superpowers/plans/....md` 同样未触碰。
- 仅用显式路径 `git add`/`git commit`,未用 `-A`/`-a`。
- Commit SHA:`3dc1bd9` — `feat(settings): general 壁纸/语言/时区/硬盘待机四行(SP9-P1)`,8 files changed, 435 insertions(+)。
- 提交后 `git status --short` 复核:3 条 `D` 行和那条 untracked plan `.md` 依然原样存在,无其它改动。

## 对 brief 的疑问 / 风险点

- brief Step 2 里 `standby.test.ts` 引用的 Vue2 行号(L989-999 / L1093-1098)与实际源码位置有偏差(实际是 L989-997 和 L1886-1890),已在实现里用核实后的准确行号,不影响测试断言本身(断言的是行为,不是行号)。
- 没有发现需要新增 i18n key 的情况 —— brief 列出的 key 在 `zh_cn.sp9.ts`/`en_us.sp9.ts` 里全部已存在。
- 没有发现其它风险;四行组件都是纯读改写窄接口,未触碰任何共享状态之外的东西。

---

## Fix round 1(评审 Important #1/#2/#3)

评审逐一核实为真:两条断言不够硬(vacuous)、一条缺交错防护。三处都已修。

### Important 1 — "挂载不回写"断言是空判(vacuous)

原断言 `expect(blob).toEqual({ timezone: 'UTC' })` 只能验证内容没变,验证不了"没被调用" ——
如果 `onMounted` 回归成把刚读到的值原样 `patch` 回去(经典 Vue2 深度 watcher 那个 bug),
`apply()` 算出的 `next` 跟已有内容字节相同,`toEqual` 照样通过,抓不到回归。

**修法**:`setCustomStorage` 从裸箭头函数改成 `vi.fn()`,`beforeEach` 里 `mockClear()`。
`TimezoneRow` 的挂载不回写用例、`DiskStandbyRow` 的挂载不下发指令用例,都加了
`expect(setCustomStorage).not.toHaveBeenCalled()`。原有的 `toEqual` 断言保留(不影响正确性)。

### Important 2 — "下发失败时提示"从没验证真的提示了

原用例只检查 select 没回滚,没检查 `toast.show(...)` 真的被调用、文案对不对 ——
删掉那行代码或写错 i18n key,这条测试都不会红。

**修法**:引入 `useToast()`,在 `setActivePinia` 之后取实例,断言 `toast.toasts` 长度为 1、
`toast.msg` 等于 `i18n.global.t('settingsSaveFailed')`(用同一个测试用 i18n 实例取译文,
key 打错真的会让断言失败,不是硬编码字符串兜底)。

### Important 3 — 缺交错(interleaving)防护

`TimezoneRow`/`DiskStandbyRow` 的 `onMounted` 是真实网络请求(测试里是即时 mock,掩盖了这个坑)。
若用户在读取返回**之前**手动改了选项,读取回调后来居上把显示值冲回服务端旧快照 ——
和记忆库 `newui-async-stale-guard`(异步写共享 state 缺过期守卫)是同一类坑,评审要求当成
"已知的坑"而不是假设性风险来处理。

**修法**:两个组件各加一个模块级局部变量 `let touched = false`;`onChange` 里先 `touched = true`
再做别的事;`onMounted` 的 `await readSystemConfig()` 之后先检查 `if (touched) return`。
按评审要求,**没有**抽公共 composable/helper —— 就地写、加注释说明原因(仓库里此前已有定论:
这个守卫抽象为时过早)。

**回归测试(交错路径,不是顺序路径)**:用可手动 resolve 的 `deferred` 替换 `getCustomStorage`
的一次返回值,`mount` 之后**趁它还 pending** 就改选 select,再 resolve 一份"改选前拍的旧快照",
断言最终显示值是用户的选择而不是服务端旧值。

踩过一次坑:第一版实现里 `deferred.resolve({ ...blob })` 是在 `flushPromises()` **之后**才读
`blob`,这时候 `blob` 已经被用户自己触发的 `patchSystemConfig` 改成新值了 —— 相当于"旧快照"
其实已经是新值,测试即使没有 `touched` 守卫也会碰巧通过。修正为在改选**之前**就 `const
staleSnapshot = { ...blob }` 拍快照,`resolve(staleSnapshot)` 时用这份真正意义上的旧值。

### 负向验证(按第 3 步要求执行)

临时手工去掉两个组件 `onMounted` 里的 `if (touched) return`(保留 `let touched`/`touched = true`
不变,只删守卫判断那一行),重跑 `rows.test.ts`:

```
Test Files  1 failed (1)
     Tests  2 failed | 16 passed (18)

 FAIL  TimezoneRow > 挂载的服务端读取尚未返回时用户先改选…
   AssertionError: expected 'Europe/Paris' to be 'UTC'
 FAIL  DiskStandbyRow > 挂载的服务端读取尚未返回时用户先改选…
   AssertionError: expected '1h' to be '10m'
```

两条新用例如预期失败(显示值被冲回服务端旧快照),其余 16 条无关用例照常通过。随后用备份
(`cp` 回原文件)恢复了 `if (touched) return`,重跑确认 18 条全绿。

### 命令与结果

```
pnpm test src/settings/panels/general/rows.test.ts   # 修复前(缺 touched 守卫时故意验证):2 failed | 16 passed (18)
pnpm test src/settings/panels/general/rows.test.ts   # 修复后:18 passed (18)
pnpm test                                            # 277 files passed (277), 2016 tests passed (2016)
pnpm exec vue-tsc --noEmit                           # 无输出 = 0 错误
```

**任务门**:277 files / 2016 tests ≥ 要求的 277/2014,达标。`vue-tsc` 零错误。

### Git

- `git status --short` 提交前确认:3 条 `design-export/*.html` 的 `D` 行仍在,未被触碰;
  修改范围仅 `DiskStandbyRow.vue`/`TimezoneRow.vue`/`rows.test.ts` 三个已跟踪文件(`M`)。
- 仅用显式路径 `git commit <path>...`,未用 `-a`/`add -A`/`stash`。
- Commit SHA:`3025d6c` — `fix(settings): 补测试断言 + 交错防护(task-5 评审 fix round 1)`,
  3 files changed, 86 insertions(+), 3 deletions(-)。
- 提交后复核:3 条 `D` 行、untracked 的 plan `.md` 依然原样存在。

### 未处理项(评审明确标记"暂不处理")

按评审要求原样保留,未改动:
- `patchSystemConfig` 失败只 `console.warn`、`setDiskStandby` 失败才 toast 的不一致。
- 三个行组件里对 `settings.css` 的重复 import(`SettingsRow.vue` 已 import 过)。
- `settingsStandbyNever` 文案是 `'从未'`(非 Vue2 的 `'从不'`)—— 此前已拍板过的文案对齐,不是本轮引入的偏差。
