# SP8-P5a Task 3 报告 —— KIcon.vue

## 文件改动

- 新建 `src/ai/knowledge/components/KIcon.vue`
- 新建 `src/ai/knowledge/components/KIcon.test.ts`

## 蓝本对照

蓝本:`git show main:src/components/common/KIcon.vue`(NimoOS-UI 仓,只读,未碰工作树)。

- Vue2 `<template>` 的 `<svg :width :height viewBox="0 0 20 20" fill="none" :stroke :stroke-width stroke-linecap="round" stroke-linejoin="round" v-html="pathHtml"/>` → New-UI `<template>` 逐属性照抄(顺序、取值方式一致)。
- Vue2 `props: { name:{required:true}, size:{default:16}, color:{default:'currentColor'}, strokeWidth:{default:1.6} }` → `withDefaults(defineProps<{...}>(), { size: 16, color: 'currentColor', strokeWidth: 1.6 })`,`name` 无默认值(必填),逐字对应。
- Vue2 `computed: { pathHtml() { return PATHS[this.name] || '' } }` → `const pathHtml = computed(() => PATHS[props.name] || '')`,逻辑等价的 Options API → `<script setup>` 机械替换(不属于需要申报的行为偏离,纯语法形态转换)。

## 42 条 glyph 逐字校验办法(不是眼看)

1. `git show main:src/components/common/KIcon.vue` 落盘到 scratchpad。
2. `awk '/^const PATHS = \{/{flag=1; next} flag && /^\}/{flag=0} flag'` 精确切出蓝本 `PATHS` 对象体(排除组件自身 `name:'KIcon'`/`props`/`computed` 那几行 —— 这正是「43 误数」的成因)。
3. 对该切片 `grep -c "^  [a-zA-Z]*:"` 计数 = **42**,确认协调者预核事实(不是 43)。
4. 新文件写完后,用同一个 `awk` 规则(锚点改成 `Record<string, string>`)切出新文件里的 `PATHS` 对象体。
5. `diff` 两份切片 → **完全一致(0 行差异)**,`grep -c` 再次确认新文件也是 42 条。
   这样比对的是脚本抽取的文本,不依赖人眼逐行核对坐标。

## 新增的正向断言

`K4` 用例原只有负向断言 `expect(d('code')).not.toContain('M11 4l-2 12')`(判别力弱:把 KIcon 的 code 换成任意其它字符串都能通过)。补了一条配对的正向断言:
```ts
expect(d('code')).toContain('M7 6l-4 4 4 4')   // 正向:钉住 KIcon 自己的 code path
```
负向那条保留(它单独表达「不是 AgentIcon 那一笔」的语义)。

## RED 探针(K4 判别力验证)

**破坏**:临时互换 `settings` 与 `user` 两条 path 的值(备份原文件到 scratchpad,`Edit` 两次完成互换)。

**RED 结果**:
```
 FAIL  src/ai/knowledge/components/KIcon.test.ts > KIcon > 六个与 AgentIcon 同名异形的图标保持 KIcon 自己的形状(K4 防回归)
AssertionError: expected '<g><circle cx="10" cy="7" r="3"></cir…' to contain 'r="2.5"'
Received: "<g><circle cx="10" cy="7" r="3"></circle><path d="M3 17a7 7 0 0 1 14 0"></path></g>"
 Test Files  1 failed (1)
      Tests  1 failed | 3 passed (4)
```
`settings` 断言精确报红(互换后 `settings` 槽位装的是 `user` 的形状,不再含 `r="2.5"`),其余 3 条用例不受影响(全绿),证明该分支断言有判别力。

**还原**:`cp` 备份文件覆盖回去,`diff` 备份与当前文件 → 无输出,`echo "RESTORED IDENTICAL"` 已打印确认。`git status` 全程干净(互换与还原都发生在 `git add`/`commit` 之前,提交里没有混入探针改动)。

## 三门终值

```
pnpm test                  → Test Files 304 passed (304) / Tests 2724 passed (2724)   exit=0
pnpm exec vue-tsc --noEmit → 无输出,exit=0
pnpm build                 → vite build 成功,只有既有 >500KB chunk 警告,exit=0
```
算术核对:基线 303 文件/2719 例 → 新增 1 个 `.vue`(KIcon.vue,color-guard +1 例)+ 本文件 4 条用例 = **304 文件 / 2719+4+1=2724 例**,与实测完全吻合。无已知噪声用例(`persist.test.ts` IndexedDB flaky / `AgentComposer.test.ts` teardown 竞态)在本次全量里出现红。

## 偏离申报

命中 §3 已授权偏离表:
- **K4**(本任务的核心授权偏离):`KIcon` 移植成独立组件,不复用 `AgentIcon`。文件头注释已按 brief Step 4 原文写入,说明六个同名异形 glyph(code/download/grid/pause/settings/user)与 P3a/P4 D3(SkillIcon 统一进 AgentIcon)在本例不成立的理由。

无其它未授权偏离。两处协调者数字订正已直接采纳,不算新偏离:
1. brief Step 1 提到的「43」按 §3(governance 文件明示)与本任务书正文均已写 42,本报告用脚本二次坐实为 42,未发现任何出入。
2. 测试第 3 条用例的注释「18 个」→ 已改成「22 个」(数组本身 brief 给的就是 22 项,只是注释数字错;我按协调者指示顺手订正了这处注释文案,断言逻辑未改)。

## §3.5「照抄不改」核对

本任务不涉及 §3.5 列出的任何一条(N1-N8 都是 knowledgeStore/DashboardView 相关的后端字段与竞态处理,KIcon 是纯展示叶子组件,不读任何后端数据)。

## 其它

- 零 `<style>` 块(符合硬约束)。
- `v-html` lint:项目里搜索未发现任何 `.eslintrc*`/`eslint.config*` 配置文件,仓库当前无 ESLint 门禁(测试门只有 `pnpm test`/`vue-tsc`/`pnpm build` 三项)。`AgentIcon.vue` 自身的 `v-html` 用法也没有任何 `eslint-disable` 注释——即"既有做法"就是不做特殊处理,KIcon.vue 照此办理,未额外添加注释。
- import 全部相对路径(`import { computed } from 'vue'` 是包名导入,符合 brief 允许的例外)。
- 未改动 `AgentIcon.vue` 一个字符(已用 `git status`/`git diff --stat` 确认全程只新增了两个文件)。

## git 自查(初次提交)

```
commit 3d44a67f0eb770077f4294d7a1353296dcee4d38
    feat(knowledge): SP8-P5a KIcon 移植(42 glyph,不复用 AgentIcon)

 src/ai/knowledge/components/KIcon.test.ts | 46 ++++++++++++++++++
 src/ai/knowledge/components/KIcon.vue     | 80 +++++++++++++++++++++++++++++++
 2 files changed, 126 insertions(+)

$ git status
On branch sp8-ai
nothing to commit, working tree clean
```

---

# 评审收尾轮 —— 开放发现 1(Important):42 glyph 全量快照

评审独立复核结果:Spec 合规 ✅、任务质量通过,42 条 path 逐字节比对(`awk` + `diff` + 排序后 `md5sum`,两侧 `442ad5d8…` 一致,0 差异)、props 默认值、svg 骨架 8 项、未命中行为、零 `<style>`、`v-html` 既有做法、`AgentIcon.vue` 未碰 —— 全部独立核过通过。唯一 Important:评审用「互换 `history`/`layers`」探针发现,42 个 glyph 里只有 8 个(`check`/`code` 正向 + 六条异形断言覆盖的 `grid`/`settings`/`user`/`pause`/`download`)有判别力保护,其余约 35 个只被「非空」弱断言覆盖,坐标写错/串位测不出。

## 补的用例原文

追加到 `src/ai/knowledge/components/KIcon.test.ts`(位于原有四条用例之后):

```ts
  // 评审 Important 开放发现 1:上面几条只覆盖 8 个 glyph(check/code 正向 + 六条异形),
  // 「22 个 name 全部存在」那条只查非空 —— 其余约 35 个 glyph 互相串位/坐标写错都测不出。
  // 这条快照【不是】用来验证「移植对不对」——那件事已经由实现者与评审各自独立对蓝本做过
  // 逐字节 diff(见 p5a-task-3-report.md,两侧 md5sum 一致,0 差异),移植正确性已经证明过了。
  // 这条快照锁的是【那个已验证状态】,防的是【将来】有人改动 KIcon.vue 时无意中改错坐标、
  // 或把两个 glyph 的 path 串了位——42 个键名全列(不是 T10/T12 用到的 22 个子集,
  // 那 22 个恰好是已有保护的,漏掉的 20 个才是这条快照真正要保护的对象)。
  it('42 条 glyph 全量快照(防未来误改漂移)', () => {
    const names = [
      'plus', 'folder', 'search', 'chev', 'check', 'x', 'play', 'pause', 'trash', 'settings',
      'edit', 'file', 'drive', 'history', 'refresh', 'home', 'grid', 'user', 'arrowRight', 'download',
      'hourglass', 'spinner', 'danger', 'test', 'rocket', 'eye', 'info', 'target', 'clock', 'code',
      'chevDown', 'chevLeft', 'arrowDown', 'sort', 'tomb', 'layers',
      'sparkle', 'bot', 'copy', 'paperclip', 'upload', 'funnel',
    ]
    expect(names.length).toBe(42)
    const dump = Object.fromEntries(names.map((n) => [
      n, mount(KIcon, { props: { name: n } }).get('svg').element.innerHTML,
    ]))
    expect(dump).toMatchSnapshot()
  })
```

快照文件 `src/ai/knowledge/components/__snapshots__/KIcon.test.ts.snap` 已随代码一并提交(非首次运行自动生成后遗留)。

## 42 个键名怎么取全并核对数量

未凭记忆/眼看列表,走的是脚本核对:
1. 复用同一份从蓝本切出的 `PATHS` 对象体切片(`scratchpad/PATHS_body.txt`,前一轮已用 `awk` 精确切边界生成),`grep -oP "^\s*\K[a-zA-Z]+(?=:)"` 抽出全部键名并排序,存为 `keys_blueprint_sorted.txt`。
2. 把测试里手写的 42 个 `names` 数组用 `node -e` 排序后写入 `keys_test_sorted.txt`。
3. `diff keys_blueprint_sorted.txt keys_test_sorted.txt` → **无输出**,打印 `"SET IDENTICAL - all 42 keys match"`。
4. 另外 `names.length` 断言写死 `toBe(42)`,防止今后有人往数组里漏加/多加而不自知。

即:42 个键名的集合与蓝本 `PATHS` 对象的键集合做过程序化的集合相等性核对,不是数出来的。

## RED 探针(互换 `history`/`layers`,复现评审做法)

**破坏**:备份当前 `KIcon.vue` 到 scratchpad,`Edit` 两次将 `history` 与 `layers` 两条 path 值互换(`history` 装入原 `layers` 的六边形分层图案,`layers` 装入原 `history` 的表盘图案)。

**RED 结果**(`pnpm test src/ai/knowledge/components/KIcon.test.ts`):
```
 ❯ src/ai/knowledge/components/KIcon.test.ts (5 tests | 1 failed) 111ms
     × 42 条 glyph 全量快照(防未来误改漂移) 36ms

 FAIL  src/ai/knowledge/components/KIcon.test.ts > KIcon > 42 条 glyph 全量快照(防未来误改漂移)
Error: Snapshot `KIcon > 42 条 glyph 全量快照(防未来误改漂移) 1` mismatched

- Expected
+ Received

@@ -16,15 +16,15 @@
    ...
-   "history": "<g><circle cx="10" cy="10" r="7"></circle><path d="M10 6v4l3 2"></path></g>",
+   "history": "<g><path d="M10 3l7 4-7 4-7-4 7-4z"></path><path d="M3 11l7 4 7-4M3 15l7 4 7-4"></path></g>",
    ...
-   "layers": "<g><path d="M10 3l7 4-7 4-7-4 7-4z"></path><path d="M3 11l7 4 7-4M3 15l7 4 7-4"></path></g>",
+   "layers": "<g><circle cx="10" cy="10" r="7"></circle><path d="M10 6v4l3 2"></path></g>",
    ...

 Tests  1 failed | 4 passed (5)
```
互换后**精确报红**在快照用例上,且报红的 diff 恰好定位到 `history`/`layers` 两个字段(其余 40 个键完全一致,证明快照对单个键的改动有像素级判别力),其余 4 条既有用例不受影响(全绿)。**互换后不是全绿** —— 满足验收判据。

**还原**:`cp` 备份文件覆盖回去,`diff` 备份与当前文件 → 无输出,`echo "RESTORED IDENTICAL"` 已打印。随后单跑该测试文件确认 5 条全绿;`git status` 显示互换/还原全程只留下预期的两处改动(`KIcon.test.ts` 修改 + 新快照目录),没有 `KIcon.vue` 的残留改动。

## 重跑后三门终值

```
pnpm test                  → Test Files 304 passed (304) / Tests 2725 passed (2725)   exit=0
pnpm exec vue-tsc --noEmit → 无输出,exit=0
pnpm build                 → vite build 成功,只有既有 >500KB chunk 警告,exit=0
```
算术:上一轮 304 文件/2724 例 → 新增快照用例 +1(快照文件本身不算测试文件,文件数不变)= **304 文件 / 2725 例**,与实测吻合。全量里未出现任何已知噪声(`persist.test.ts` IndexedDB flaky / `AgentComposer.test.ts` teardown 竞态)红项。

## 新提交

```
commit 9a3e93868c31141d4c484e64f53c729c7d5f72a9
    test(knowledge): KIcon 补 42 glyph 全量快照(评审 Important 收尾)

 src/ai/knowledge/components/KIcon.test.ts          | 22 ++++++++++
 .../components/__snapshots__/KIcon.test.ts.snap    | 48 ++++++++++++++++++++++
 2 files changed, 70 insertions(+)

$ git status
On branch sp8-ai
nothing to commit, working tree clean
```

未生产代码改动(`KIcon.vue` 字节与初次提交完全一致,互换只是探针,已还原),未削弱/删除任何既有断言。
