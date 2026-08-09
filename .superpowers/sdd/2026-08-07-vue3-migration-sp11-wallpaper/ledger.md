# SP11 壁纸/主题选择器 —— 执行台账(收尾关账)

> 计划:`NimoOS-UI/docs/superpowers/plans/2026-08-07-vue3-migration-sp11-wallpaper.md`
> 仓库:`/home/nimo/NimoTech/NimoOS-New-UI`,分支 `master`(无 worktree —— 全局约束禁止在本工作树
> `checkout`/`stash`,工作树里永久 staged 着 3 个 `design-export/*.html` 的删除)。
> 起点(Task 1 开工前):`693c88a`。终点(Task 11 收尾时):`819d2ab`。
> 本文件是 Task 11(收尾门 + 台账与 roadmap 关账)的产出,写于 2026-08-08。
> `.superpowers/sdd/.gitignore` 是一行 `*`,本文件与全部 brief/report **不进 git**(预期行为,不是遗漏)。

---

## 1. 11 个任务的提交对照

| 任务 | 提交 | 说明 |
|---|---|---|
| T1 | `c4e63bd` | 壁纸记录模型 + URL 派生 + DOM 应用 + 两张内置 JPEG(2.2MB/848KB,原样拷贝自 Vue2) |
| T2 | `91816ac` | `<html>` 壁纸层(`theme.css`)+ `main.ts` 里挂载前应用(防闪烁) |
| T3 | `0046f5c` | 共享包 `packages/service/`:`uploadImage` / `setImageFromPath` |
| T4 | `5d9b549` → `8a186a2` | Pinia store(服务端读写 + 预览/回滚);`8a186a2` 是评审第一轮修复(见 §5) |
| T5 | `aaf912d` | 弹窗骨架:四个预设 + 实时预览 + 取消/应用 |
| T5x(**计划外**) | `8fd3cc0` → `206b13a` | OSS 导出泄漏守卫的按内容分类修复 + 13 条白名单(见 §7) |
| T6 | `ad5fc9d` | 弹窗接上传与「从 NAS 选择」 |
| T7 | `6326a21` | 弹窗挂载 `App.vue` 全局 + 设置行解禁(债务 D5 还清) |
| T8 | `f16c7ba` | 顶栏三档(蓝色/白色/照片…) |
| T9 | `628de2e` → `f327414` | 桌面空白处右键入口;`f327414` 是评审第一轮修复(见下) |
| T10 | `b7b9681` → `819d2ab` | 文件区右键「设为壁纸」;`819d2ab` 是 OSS 白名单跟进提交 |

Task 11(本次)未在 New-UI 产生新的功能提交 —— 只跑收尾门、写本台账,并在 `NimoOS-UI` 仓做
roadmap/审计文档关账(见该仓的独立提交)。

---

## 2. Step 1:收尾门实测结果(全部通过)

跑于 `/home/nimo/NimoTech/NimoOS-New-UI`,HEAD `819d2ab`。**以下数字是本次实测,不是抄计划或旧台账**——
本期间 master 分支的用例数确实又变过。

### `pnpm vitest run`

```
 Test Files  645 passed (645)
      Tests  10396 passed (10396)
   Start at  00:16:25
   Duration  160.64s
```

0 失败。运行中 stderr 会打印若干 `Error: Not implemented: navigation (except hash changes)`
与一行 `/tmp/nimoos-www-... 不存在或当前用户不可写` —— 来自 `src/photos/stores/favorites.ts`
的 `exportZip` 在 jsdom 下触发 `location.href = ...` 的已知噪音(该测试本身是通过的,不是本期
引入),不是失败。

### `pnpm exec vue-tsc --noEmit`

exit 0,无输出。

### `pnpm build`

`rm -rf dist && pnpm build` —— 成功,`✓ built in 17.30s`,exit 0。关键产物行:

```
dist/assets/wallpaper02-DZn-raxl.jpg           848.37 kB
dist/assets/wallpaper01-S0HR-c5b.jpg         2,281.37 kB
dist/assets/index-CLeWXsVc.js                7,323.33 kB │ gzip: 2,053.19 kB
```

(entry chunk 7.3MB 是本仓早就存在的状况——没有配置 `manualChunks`,与 SP11 无关,只是恰好在
这次 build 输出里可见。)

### `node oss/export.mjs`(**安全形式,三件套参数**)

`--dry-run` 参数**不存在**(`oss/export.mjs` 里没有这个 flag 的定义)。经过一次事故(见 §9)
后确认的正确「不写真实产物」调用形式是:

```bash
node oss/export.mjs --out <scratch 目录> --no-commit --allow-dirty-oss
```

实测:

```
node /home/nimo/NimoTech/NimoOS-New-UI/oss/export.mjs \
  --out /tmp/claude-.../scratchpad/oss-sp11-final --no-commit --allow-dirty-oss

[oss] 1/6 前置检查
[oss]   New-UI 819d2ab7(共享包已内联,不再取第二个仓)
[oss] 2/6 取源
[oss] 3/6 应用清单(DELETE 71 · REPLACE 4 · PATCH 252)
[oss] 4.5/6 重算 lockfile(package.json 的依赖已被清单改动)
[oss] 5/6 泄漏守卫
[oss]   ⚠ 3 个文件未做内容扫描(二进制/符号链接,预期内,不计入泄漏判定):
[oss]     ⚠ 未扫描:src/assets/wallpaper/wallpaper01.jpg —— 判定为二进制,未扫描
[oss]     ⚠ 未扫描:src/assets/wallpaper/wallpaper02.jpg —— 判定为二进制,未扫描
[oss]     ⚠ 未扫描:src/home/apps/icons/settings.png —— 判定为二进制,未扫描
[oss]   零真实泄漏命中(3 个预期内跳过已记录,见上方与 .export-report.txt)
[oss] 6/6 落盘
[oss] 完成 → /tmp/claude-.../scratchpad/oss-sp11-final
```

`--no-commit` 使脚本止步于把产物树落到 `--out` 指定的临时目录、不做 `git init`/`git commit`,
所以这次调用**没有**碰任何真实的 `.git` 历史。验证完毕后已 `rm -rf` 清理临时目录
(9.3MB,不留存)。

**Step 1 结论:四道门全绿,任何一门都没有红。**

---

## 3. Step 2:首屏体积核对(controller 修正后的判据)

计划原文与 Task 7 brief 里写的 `grep -c "wallpaper0" dist/assets/index-*.js == 0` **做不到,
且不该被当成失败**——`main.ts` 从 Task 2(`91816ac`)起就在 `app.mount()` 之前
`eager import` 了 `stores/wallpaper`(为了防止默认渐变闪一下再切换成壁纸),这必然让 entry
chunk 携带两个内置壁纸的 URL 字符串常量。Task 7 的评审在构建产物上独立复现了同一个结论。
本次收尾按 controller 给出的修正判据重新核实:

```bash
grep -o "wallpaper0[^\"'\`]*" dist/assets/index-CLeWXsVc.js | sort -u
```
```
wallpaper01=
wallpaper01-S0HR-c5b.jpg
wallpaper01,w02:wallpaper02};function builtinUrl(o){return BUILTIN_URLS[o]}function recordUrl(o){return o.kind===
wallpaper02=
wallpaper02-DZn-raxl.jpg
```

```bash
grep -c "wallpaper0" dist/assets/index-*.js
```
只有 entry chunk `index-CLeWXsVc.js` 命中(计数 1),其余 11 个 `index-*.js` 分片全部是 0。

```bash
grep -o "wallpaper0[0-9]=\"[^\"]*\"" dist/assets/index-CLeWXsVc.js
```
```
wallpaper01="/app/assets/wallpaper01-S0HR-c5b.jpg"
wallpaper02="/app/assets/wallpaper02-DZn-raxl.jpg"
```

两处命中都是约 45 字节的短字符串赋值,附近没有任何 base64/二进制数据。且:

```bash
ls -la dist/assets/wallpaper0*.jpg
```
```
-rw-rw-r-- 1 nimo nimo 2281371 dist/assets/wallpaper01-S0HR-c5b.jpg   # ≈2.2MB
-rw-rw-r-- 1 nimo nimo  848369 dist/assets/wallpaper02-DZn-raxl.jpg   # ≈828KB
```

两张内置图都作为独立的落地文件存在。

**Step 2 结论(修正判据下):PASS。** entry chunk 只携带两条壁纸资源 URL 字符串,从未携带图片
字节;约 3MB 的图像数据始终是独立发出的静态资源,不在首屏 JS 里。

---

## 4. Task 2 的强制变异验证(CSS 位置守卫)

**背景**:`theme.css` 的浅色主题在文件较早处有一条 `body::before, body::after { background:
none; }` 重置规则;SP11 的壁纸规则块必须排在这条重置之后(源码序决定优先级相同规则的胜负),
否则壁纸会被这条重置吃掉,且这类失效对 `vue-tsc`/`build`/jsdom 全部不可见。`wallpaper.css.test.ts`
钉死了这个顺序。

**变异操作**:用脚本把整段 SP11 壁纸规则块从文件末尾原样剪切,粘贴到浅色主题重置规则**之前**
(制造顺序颠倒),变异前保留了原文件的逐字节备份用于精确还原。

**变异后跑测试的真实输出**:
```
 ❯ src/styles/wallpaper.css.test.ts (6 tests | 1 failed) 10ms
     × the scrim rule is ordered AFTER the light theme zeroes body::after 3ms

 FAIL  src/styles/wallpaper.css.test.ts > scrim > the scrim rule is ordered AFTER the light theme zeroes body::after
AssertionError: expected 24871 to be greater than 24986
 ❯ src/styles/wallpaper.css.test.ts:50:19
     48|     const scrim = CSS.indexOf(':root[data-wallpaper] body::after')
     49|     expect(lightKill).toBeGreaterThan(-1)
     50|     expect(scrim).toBeGreaterThan(lightKill)

 Test Files  1 failed (1)
      Tests  1 failed | 5 passed (6)
```
只有「顺序」这一条断言变红,其余 5 条不受影响——证明这条位置检查是独立生效的,不是连带一大片
断言一起崩掉的假阳性。

**还原后重跑**:`diff` 确认文件与变异前逐字节一致,`pnpm vitest run
src/styles/wallpaper.css.test.ts src/styles/color-guard.test.ts` → `2 passed / 1038 tests
passed`,`vue-tsc --noEmit` 再次 exit 0。

---

## 5. Task 4 的强制变异验证(回滚快照)

Task 4 评审第一轮(`8a186a2`)在计划文字本身沉默、但仓库已有约定「异步写共享 state 必须带过期
守卫」的前提下,修了三处发现,其中两处补了变异验证。

**发现 1(`commit()` 过期写入)**:`commit()` 在一次 `await` 前后两次读 `record.value`;若
`preview()` 在保存请求在途时又被调用一次,缓存里会留下一个从未真正发给服务端的记录。修法:
`await` 前把 `record.value` 捕获进局部变量 `toSave`,服务端写入与本地缓存都用这同一份局部值。

**发现 2(`load()` 覆盖在途预览)**:`load()` 曾无条件应用服务端读取结果,慢请求可能在用户已经
做了预览之后才落地、把预览覆盖掉。修法:加一个 store 级 `epoch` 计数器,`preview()` 每次调用
自增;`load()` 发起请求前记下 `startEpoch`,请求落地时若 `epoch !== startEpoch` 直接放弃,不
应用也不写缓存。

**计划自带的变异样例是假阳性,已在报告里记录并绕开**:计划 Step 5 给出的变异建议是把
`beginPreview` 里的快照弱化成 `{ record: record.value, theme: 'blue' }`。按字面尝试后**没有**
让测试变红——因为该测试场景本身以 `theme.setTheme('blue')` 开局,硬编码的 `'blue'` 恰好与测试
期望的最终值重合,属于会让人误信"这个守卫不重要"的假阳性变异。改用真正禁用 `cancelPreview` 里
主题回滚语句的变异(功能等价于"快照只记录 record,主题字段形同虚设"):

```ts
function cancelPreview(): void {
  if (!snapshot) return
  preview(snapshot.record)
  // MUTATION-VERIFICATION-TEMP: 主题回滚被禁用,用于证明该守卫不是空转。
  // useThemeStore().theme = snapshot.theme
  // applyTheme(snapshot.theme)
  snapshot = null
}
```

**变异后跑测试的真实输出**:
```
× src/stores/wallpaper.test.ts > wallpaper store > cancelPreview rolls back BOTH the record and the theme 13ms
  → expected 'light' to be 'blue'

AssertionError: expected 'light' to be 'blue'
Expected: "blue"
Received: "light"
 ❯ src/stores/wallpaper.test.ts:193:25
   expect(theme.theme).toBe('blue')
```

还原两行注释代码后重跑全文件:`27 passed (27)`,`vue-tsc --noEmit` exit 0。

（发现 1/2 各自新增的两个测试也各自做过一次"临时回退实现→跑红→再改回"的验证,详见
`task-4-report.md`;此处只记录了 brief 明确要求的"回滚快照"这一条完整的变异证据链。）

---

## 6. Task 3:三个错误码的真实取值

计划文本里给的是占位符,brief 要求从真实源码取值。实际来源文件:
`/home/nimo/NimoTech/NimoOS-Common/utils/common_err/e.go`(**不是** brief 里写的
`NimoOS-Common/model/common_err/` —— 那个目录提示是过时的,实际包在 `utils/common_err/`)。

| 常量名 | 数值 | 来源行 | 对应消息(源码里的英文文案) |
|---|---|---|---|
| `FILE_DOES_NOT_EXIST` | `60001` | `e.go:48` | `"File does not exist"`(`e.go:102`) |
| `NOT_IMAGE` | `10009` | `e.go:20` | `"Not an image"`(`e.go:75`) |
| `IMAGE_TOO_LARGE` | `10010` | `e.go:21` | `"Image is too large"` |

`FILE_DOES_NOT_EXIST`(60001)恰好与计划占位符一致;`NOT_IMAGE`/`IMAGE_TOO_LARGE` 的占位符
(10017/10018)被替换成了真实值 10009/10010。测试断言钉的是 `message`(mock 里写的字符串),
不是这几个数值本身——`users.test.ts` 里 mock 用的是 `'Image too large'`(少一个 "is"),与后端
真实文案 `'Image is too large'` 不完全一致,是一处自指的措辞差异(mock 只需要和断言自洽),不
影响真实性,已在 Task 3 报告里作为 deferred minor 记录。

---

## 7. Task 5x(计划外任务):OSS 泄漏守卫的分类修复

**为什么需要**:`oss/forbidden.mjs` 的 `scanTree()` 原逻辑是"文件超过 `MAX_BYTES`(2MB)一律
归类为『超过上限』"——这是一种**预期外、致命**的跳过,会让 `oss/export.mjs` 直接拒绝导出。
Task 1 加入的内置壁纸 `wallpaper01.jpg`(2,281,371 字节)撞上了这条 2MB 上限,而它本质上只是一
张普通的二进制图片资源,和仓库里那些远小于 2MB、被正常跳过并标记为 `SKIP_REASON_BINARY`(预期
内、非致命)的 PNG/SVG 图标没有本质区别——只是恰好体积更大。这个问题堵住了 Task 11 要跑的收尾
oss 门,不是 SP11 计划原本安排的一项工作,是执行过程中冒出来的阻塞项,由 controller 裁定插入一
个走完整 TDD 流程的修复任务。

**修法**:调整 `scanTree()` 的判断顺序——文件超过 `MAX_BYTES` 时,不再直接判定为"超过上限",
而是先只读取 `looksBinary()` 实际会检查的开头字节(`SNIFF_BYTES`,约 8KB,用
`fs.openSync`/`fs.readSync`,绝不读整个超大文件)判断是否为二进制:
- 开头像二进制 → 归为 `SKIP_REASON_BINARY`(预期内,不管体积多大都一视同仁)。
- 开头不像二进制(即一个超过 2MB 的**文本**文件)→ 仍然归为"超过上限"(预期外、致命)——这是
  故意保留的,一个异常巨大的文本文件仍然可能在没人读到的区域里藏着泄漏,不能因为改了二进制判断
  就连带放宽这一类。
- 开头读取本身失败(比如权限问题)→ 仍然如实报「读取失败」,不静默吞掉。

`oss/forbidden.test.mjs` 按 TDD 顺序补了三个用例(先红后绿),`MAX_BYTES`/`DIST_MAX_BYTES`/
任何白名单条目/内置图片本身都没有被这次修复触碰。

**修复本身让另一个被掩盖的问题浮出水面**:2MB 硬跳过取消之后,`export.mjs` 第一次真正跑到了完
整的泄漏扫描阶段,发现 13 处真实命中——全部来自已经提交的 SP11 壁纸相关文件(`91816ac`、
`0046f5c`、`5d9b549`、`8a186a2`、`aaf912d`),且全是通用英文单词(`photo`/`gallery`/`search`/
`照片`)在正常代码/注释/测试断言里的自然出现,不是真泄漏。经 controller 确认后逐条添加
`exactLine()` 精确白名单(不放宽词表、不做路径级豁免、不改动这 13 行源码本身),提交
`206b13a`。收尾验证:`node oss/export.mjs --out /tmp/... --no-commit --allow-dirty-oss` 干净
通过,`pnpm vitest run oss/` = 6 文件/141 例全绿。

（此后 Task 6/8/10 各自的新增测试代码又零星撞上同一类"通用英文单词误判"若干次,各自跟进了同样
风格的 `exactLine()` 白名单提交——这是 T5x 建立的处置方式在延续使用,不是新问题。）

---

## 8. 与计划/spec 不符之处(实测覆盖,不美化)

1. **Step 2 的字面判据不可达(见 §3)**——`grep -c "wallpaper0" dist/assets/index-*.js` 永远
   不会是 0,是 Task 2 防闪烁设计的必然代价。controller 给出并采纳了修正判据。
2. **`oss/export.mjs --dry-run` 不存在**——brief 要求核实这一点,核实结果是没有这个 flag;
   正确的"不落地真实产物"调用是 `--out <scratch> --no-commit --allow-dirty-oss` 三件套(见
   §2、§9)。
3. **Task 4 计划自带的变异验证样例是假阳性**(见 §5)——按字面执行不会让测试变红,已换用真正
   有效的变异方式,并在报告与本台账里都留了记录,防止未来有人重跑计划原文的那个样例又被误导。
4. **Task 5 的"四个入口按钮"与"`<slot name="sources">`"两种写法冲突**——计划 Step 2 的测试断
   言两个具名按钮存在,Step 4 的组件代码却只给了一个具名插槽。controller 在开工前裁定:Task 5
   直接实现两个真实按钮(`wp-upload`/`wp-nas`),删掉插槽;点击行为留给 Task 6 接。
5. **Task 6 的散文与代码块不一致**——brief 正文要求 `onNasPick` 成功后调
   `wp.beginPreview()` 重置回滚快照(因为后端此时已经把文件落盘,取消不该假装能回滚),但给出
   的代码示例漏掉了这一行。裁定以正文为准,实现里补上了这一调用。
6. **Task 7 的 `App.vue` 是合并进去的,不是覆盖**——brief 代码片段只展示壁纸相关的三处增量,
   真实文件已经有 `AppToast`、`useSessionStore`/`useLocaleStore` 门控的 `onMounted` 等既有内
   容,实现按"只插入三处增量"处理,不是拿 brief 片段整体替换文件。
7. **Task 9 的 `display: contents` 包装元素在真实浏览器里会破坏桌面网格布局**——评审第一轮
   Critical 发现:`useGridMeasure.ts` 读 `grid.parentElement.clientWidth`,而
   `display: contents` 元素在任何遵循规范的浏览器里都不产生盒模型、`clientWidth` 恒为 0,导致
   桌面图标网格永远塌成最小格子;jsdom 没有布局引擎,对好坏两种实现给出的都是同一个假绿。修复
   为改用无包装元素的渲染函数方案(`cloneVNode` 把监听器直接合并到插槽自身的根 vnode 上,借鉴
   reka-ui 内部 `Slot` 原语的同一手法),并新增一条纯 DOM 树结构断言
   (`grid.parentElement === home-screen`)作为可在 jsdom 下生效的结构性回归守卫。
8. **Task 9 报告曾包含一句未经验证的"已验证"表述**——原报告声称 `display: contents` 方案已
   通过 `Home.integration.test.ts` 的 cols/rows/cell 数值验证过不影响布局,但该文件里根本没有
   这类断言,这句话是错的、已在评审时纠正(见 T9 报告"Gating approach used"一节的更正记录)。
9. **Task 10 报告曾误报新增测试数量**——报告称新增"7 个测试(6 个 SP11 + 1 个附加)",经
   controller 用 `git diff` 核实实际只新增了 6 个测试、全部在新的
   `describe('set as wallpaper (SP11)')` 块内,不存在额外的第 7 个;覆盖面没有缺口(brief 要
   的正是这 6 条),但报告本身的自述数字不可直接采信,已在报告里就地订正。
10. **本次 Task 11 执行中的 `oss/export.mjs` 误写事故**——见下一节,是本期最严重的一处偏离,
    单独成节记录。

---

## 9. 事故记录:`oss/export.mjs` 无识别参数会静默写入公开镜像仓

**经过**:Task 11 执行期间,为核实 `--dry-run` 是否真的存在,先用
`node oss/export.mjs --help` 探测——`--help` 不是脚本认识的参数,而脚本对**任何**未识别参数
一律静默忽略,不报错、不提示,直接按默认设置继续跑。默认设置里 `--out` 缺省值是
`oss/manifest.mjs` 里写死的 `DEFAULT_OUT = path.resolve(HERE, '../../NimoOS-Web')`——也就是
真实的公开镜像仓 `/home/nimo/NimoTech/NimoOS-Web`;`--no-commit` 也没给,默认会提交。脚本执行
了 `rsync -a --delete` 把导出树整个覆盖过去,再 `git add -A` + `git commit --amend --no-edit`
(该仓固定保持零历史/单提交设计,已有 HEAD 时一律走 `--amend`)。只有在**提交完成之后**,脚本
才检查 `rev-list --count HEAD == 1`;由于那个仓当时实际有 2 个提交,检查失败、脚本以退出码 1
终止——但 amend 已经生效。

**后果范围**:本地 `NimoOS-Web` 仓的 HEAD 从 `4957653`("Expand the deployment section of the
README")变成了 `548e53c`(同名但被 amend 过),差异 83 个文件、+5339/-2619 行,相当于把
SP1-SP11 至今全部未发布的 New-UI 工作(含本期尚未经机主验收的壁纸功能)一次性糊进了那个提交。
**没有任何内容推送到 GitHub**——核实时读到的 `origin/main` 缓存引用还停在最早的 `748aa8f`,说
明连事故发生前的 `4957653` 本身都只存在于本地,从未推送过。

**处置**:机主确认后执行了 `cd /home/nimo/NimoTech/NimoOS-Web && git reset --hard 4957653`,
该仓已复原到事故前状态(`4957653` → `748aa8f`,`origin/main` 仍是 `748aa8f`,工作树 clean)。
坏提交 `548e53c` 仍留在该仓的 reflog 里,未做进一步清理。

**根因与今后的强制调用形式**:`oss/export.mjs` 对未识别命令行参数**没有校验、没有报错**,这是
脚本本身的一个陷阱,不是用户操作失误的孤立事件——本工作区历史上已经因为同一个"不带 `--out` 直
接跑会往公开仓真实路径写、且默认会提交"的问题被记录过一次(见
`NimoOS-UI/docs/vue3-pending/05-设置与KVM与搜索-SP9.md` 的 A12 条目),这是第二次真的因此耗费
时间。**今后调用这个脚本,一律只用三件套完整参数**:

```bash
node oss/export.mjs --out <scratchpad 下的临时目录> --no-commit --allow-dirty-oss
```

**禁止**:裸调用(不带 `--out`)、用任何未识别 flag(包括 `--help`)去探测该脚本的行为、以及把
`--out` 指向除 scratchpad 临时目录之外的任何路径。这条连同上面这段完整经过,就是本条目存在的
目的——不再让这件事停留在口头教训层面。

---

## 10. 验收指引(供机主验收用,不代替实机点击)

Task 11 不做真机部署与验收——按 SP9/SP10/SP13 的既有惯例,验收方式是起 dev server
(`pnpm dev --host --port 5273`),**不是** `deploy.sh`(本期不是跨应用绞杀的 cutover 期)。
完整的 17 条点击路径验收清单在 `task-11-brief.md` 的 Step 6 一节,此处不重复照抄——按那份清单
逐条走即可。**两仓均未部署、未推 origin。**

---

## 补记:终审修复波(控制器补写,2026-08-08)

关账时 `ledger.md` 写在整支终审之前,以下是终审及其修复的结果,一并入账。

**终审(Opus,693c88a..819d2ab)** 出 1 Critical + 2 Important + 9 Minor,并对 15 条挂账 minor 逐条裁定、按机主 17 步验收清单排了风险序。

- **C1(Critical)**:`packages/service/src/users.ts` 的 `uploadImage` 把 FormData 当 JSON 发。共享 axios 实例默认 `Content-Type: application/json`,而 axios 1.18.1 在已有 JSON content-type 时会把 FormData 拍平成 JSON,`File` 序列化成 `{}`,后端 `ctx.FormFile("file")` 直接失败 —— **真机上每一张合法图片上传都会报「上传失败,请重试」**。包里另外四处 FormData 调用(`ai.ts:120`、`photos.ts:365/371`、`sys.ts:106`)早就显式覆写了这个头,只有 SP11 新加的这处没有。原测试看不见:它 mock 掉 `http.post` 并断言 `body instanceof FormData`,而这在调用点为真 —— 出事的转换发生在 mock 之下的 axios 内部。**这是本期第三个「因为错的理由而通过」的测试**。
- **I1(Important)**:壁纸没有登录/登出生命周期。`load()` 只在 `App.vue` 的 `onMounted` 里按当时的 `session.isAuthed` 跑一次。登出是 SPA hash 跳转不重载文档,`session.clear()` 只清 localStorage 缓存键,不摘 `<html data-wallpaper>` ⇒ **上一个用户的照片会一直留在登录页上**(且 `GET /v1/users/image` 后端设计上就不校验 JWT);新登录同样不重挂 `App.vue` ⇒ 缓存为空时不刷新就没有壁纸。验收第 17 条两半都会挂。
- **I2(Important)**:`cancelPreview` 不还原 `localStorage.theme`。两个预设入口在**预览**阶段就调了会写盘的 `setTheme`,所以取消时 localStorage 里躺的恰恰是未确认值、快照里才是已确认值 —— 蓝色 → 选白色底板 → 取消(看着对)→ F5 → 被取消的主题回来了。T4 挂账那条 minor 钉的是反的不变量,已作废。

**修复波第一轮(819d2ab..f6da89f,4 提交)**:C1 补 multipart 头并把头写进断言;I1 用 `App.vue` 里一个 `session.isAuthed` 的 watcher 收口两半;I2 取更忠于本期概念的那种改法 —— 弹窗预设改走新的 `previewTheme()`(只动内存+DOM),落盘交给「应用」,顶栏保持一步到位;M2/M3/M5/M6/M7/M8 一并修掉。

**修复波第二轮(f6da89f..bbbd5e6)**:定向复审逮到第一轮自己引入的回归 —— `commit()` 末尾无条件 `setTheme(themeStore.theme)`,对「应用」是对的,但 `setFromNasPath` 这条一次性路径也走 `commit()`,于是「开弹窗 → 点白色底板(仅预览)→ 改主意点从 NAS 选择 → 选图」会把用户从没应用过的主题偷偷落盘,正好捅穿 I2 要保的那条不变量。改法:`commit()` 只管壁纸记录,主题确认移到 `WallpaperDialog` 的 `apply()`。复审结论 ADDRESSED,四个 `commit()` 调用点逐个点过,无新增破坏。

**最终门**:`pnpm vitest run` 646 文件 / 10412 例 / 0 失败 · `vue-tsc --noEmit` exit 0 · `pnpm build` 成功 · `oss/export.mjs`(三参数安全形式)干净。

**最终状态**:New-UI master `bbbd5e6`(自 693c88a 起 21 个提交),NimoOS-UI `c2fb858f`。**未部署、未推 origin**。

---

## 验收轮(2026-08-08,机主实机)

机主改口要求直接 `./scripts/deploy.sh` 部署到 80 端口验收(不是关账时写的「起 dev server」)。已部署,仍未推 origin。

### 缺陷 1:浅色主题下开壁纸,整个界面雾成一片白 —— `08a5898`(+ `41813a0` oss 白名单)

**现象**:切到白色主题后设置壁纸,卡片、按钮、正文全被冲淡约 55%,近黑的纸感文字变成灰色。

**根因**:白纱盖错了层。`theme.css` 里的氛围层 `body::after` 是 `position: fixed; inset: 0; z-index: 0`,而 `#app` 是 `position: static` —— 按 CSS 绘制顺序,带定位且 z-index:0 的元素画在**所有非定位内容之上**。默认主题下这层只是 6% 白柔光 + 贴底暗角,看着像氛围,所以这个「盖在全部内容上」的事实一直没暴露。SP11 把同一个元素复用成壁纸白纱(`:root[data-wallpaper] body::after { background: var(--wallpaper-scrim) }`),而浅色 scrim 是铺满全屏的 `rgba(255,255,255,0.55)` 实心白 ⇒ 照片和界面一起被蒙。

白纱的设计用途(见 spec)是**提亮照片、让近黑文字压在深色照片上仍可读**,所以它必须夹在照片与界面之间,而不是盖在最上面。

**修法**:`:root[data-wallpaper] body::after { z-index: -1 }`(仅壁纸态,非壁纸态的 `body::after` 一行未动)。`body` 不产生层叠上下文 ⇒ 伪元素参与根层叠上下文,负 z-index 让它排在 canvas(承载 `<html>` 的壁纸背景)之后、所有块级后代之前。

**为什么测试没拦住**:jsdom 没有布局也没有绘制,「谁盖在谁上面」这一整类缺陷五道门全绿也照不出来。守卫只能写成**结构性**的 —— `wallpaper.css.test.ts` 断言该规则必须带负 z-index;拿掉那行守卫变红(已验证)。取证用无头 Chromium 加载**设备上真实部署的那份 CSS** 做三组对照渲染:浅色+壁纸(复现全屏雾白)· 深色+壁纸(正常,因为深色 scrim 很淡)· 加上修复(照片留白纱、文字卡片恢复对比度)。

> 教训与 [[newui-css-invisible-failure-guards]] 同源但更进一层:那条记的是「源文本正确、解析后规则消失」,这条是「规则完全生效、但画在了错误的层」。两者都只有真浏览器能取证。

**顺带**:`2302ef3` 修掉修复提交里注释的一处错误说法(原文写成「负 z-index 把伪元素放到 canvas 壁纸**之后(behind)**」,那样白纱就完全看不见了;实际是排在 canvas 之后、块级后代之前)。

### 缺陷 2(非缺陷,机主口味):白纱浓度 55% → 15% —— `1055df9`

55% 换来的可读性余量在多数场景用不上:纸感主题自己的卡片、chip、顶栏已经垫在照片与几乎所有正文之间,真正需要白纱兜底的只有**桌面上直接压在照片上的图标标签**。

**遗留观察项**:换特别亮或特别花的照片时,桌面标签的近黑字可能不好认。真碰上了,给标签文字本身加描边/阴影比把整张照片再提亮更划算 —— 后者是拿全局观感换局部可读性。
