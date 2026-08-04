# P5d · T4 报告 —— tiptap 依赖(K37/§14)+ `NotesMarkdownEditor.vue`

起点 HEAD `d144cf6`。分支 `sp8-ai`,仓 `/home/nimo/NimoTech/.sp8/NimoOS-New-UI`。

## §T4 DoD 1–7 逐条

### 1. 装依赖(裁定 R2 覆盖治理 K37/A-7)

```bash
pnpm add "@tiptap/vue-3@^2.27.2" "@tiptap/starter-kit@^2.27.2" "@tiptap/pm@^2.27.2" "tiptap-markdown@^0.8.10"
```

`pnpm list` 真实解析:

```
dependencies:
@tiptap/pm 2.27.2
@tiptap/starter-kit 2.27.2
@tiptap/vue-3 2.27.2
tiptap-markdown 0.8.10
```

四个都是 `2.x` / `0.8.x`(**不是**治理 K37/A-7 写的 `0.6.1`——按裁定 R2/E-36,`^0.6.1` 已作废,蓝本
`package.json:74` 实际就是 `^0.8.10`;装 v3 才是 Critical,`tiptap-markdown@0.9.0` 的 peer 才是
`@tiptap/core@^3.0.1`,本次装的 `0.8.10` peer 仍是 `@tiptap/core@^2.0.3`,v2 线未破)。
`@tiptap/core` 解析到 `2.27.2`(peer,自动装,未显式声明)。`markdown-it` 未被触碰,仍 `14.3.0`。

`git diff --stat package.json pnpm-lock.yaml`:
```
package.json   |   4 +
pnpm-lock.yaml | 522 +++++++++++++++++++++++++++++++++++++++++++++++++++++++++
2 files changed, 526 insertions(+)
```
`package.json` diff 只有 4 行新增(`@tiptap/pm`/`@tiptap/starter-kit`/`@tiptap/vue-3`/`tiptap-markdown`),
`dependencies` 其余一字未动,无 `devDependencies`/`scripts`/`version` 改动。**未装** `extension-highlight`
/`extension-typography`(P5d 三个蓝本文件零引用,不需要)。

**Dev server `:5288` 重起(现查证据)**:装完依赖后 `kill` 掉旧 pid(`784743`/`784744`,装依赖前用
`ss -ltnp | grep 5288` 现查得到),`nohup pnpm dev --host --port 5288 &` 重起,新 pid 现查:
```
$ ss -ltnp | grep 5288
LISTEN ... users:(("node",pid=788096,fd=21))
$ pgrep -af "vite.*5288"
788095 sh -c vite --host --port 5288
788096 node .../vite.js --host --port 5288
```
提交前复查 `:5277`(SP7,pid 15948)与 `:5299`(NimoOS-Web,pid 299874)均未被触碰,仍是各自原 pid。

### 2. K38 三件事(v-model 契约 + emits)

`@tiptap/vue-2`→`@tiptap/vue-3`;`beforeDestroy`→`onBeforeUnmount`;`value`/`input` v-model 契约
→`modelValue`/`update:modelValue`,**且保留 `input`**。`onUpdate` 里同时 `emit('update:modelValue', md)`
与 `emit('input', md)`(`NotesMarkdownEditor.vue:50-51`)。

**变异证据**(cp 备份→sed 注入→md5 校验还原,全程未用 `git checkout`):
- 注掉 `emit('input', md)` → 用例「真敲一次内容后,两个 emit 各有一条」报红(`expected undefined
  to be truthy`,命中 `inputEmits` 那行)。还原后 md5 与备份一致。
- 注掉 `emit('update:modelValue', md)` → 同一用例改在 `updateEmits` 那行报红。还原 md5 一致。

### 3. §5.3 防回环

`watch(() => props.modelValue, (v) => { if (editor.value && v !== editor.value.storage.markdown
.getMarkdown()) editor.value.commands.setContent(v) })`(`:66-73`)。

🔴 **踩坑记录(报告里如实登记,供 T7 参考)**:
1. `editor.commands` 是 getter,每次访问都现造一个新的绑定函数对象(`@tiptap/core`
   `get commands()` 用 `Object.fromEntries` 现场生成)——`vi.spyOn(ed.commands, 'setContent')`
   spy 不到 watch 内部重新取到的另一个对象,实测恒记 0 次调用,是假阴性,已放弃这个写法。
2. 改用 `onTransaction` emit 计数作信号也不可靠 —— 实测约 1/5 概率在「同值写回」分支也多算出
   1 次 transaction(jsdom 下 ProseMirror 的 selection/focus 事件会派发不改文档的 transaction,
   与 mount 后的异步收尾有时序竞争),已放弃。
3. 直接 `setProps({ modelValue: 挂载时的初始值 })` 测不出这条守卫 —— Vue 的 `watch` 在新旧值
   `Object.is` 相等时根本不会调用回调,与生产代码里比对与否无关;实测过一次,删掉比对后这种
   写法仍然全绿,零判别力。
最终写法:真敲字触发 `onUpdate`(内容变化)→ 模拟父组件 v-model 把 `update:modelValue` 的值原样
回写(prop 确实从初始值变成了敲字后的新值,Vue 会调用 watch)→ 断言 `editor.state.doc`(ProseMirror
不可变文档树)引用不变 + markdown 不变;再写入真正不同的值 → 断言引用改变 + markdown 跟着变。

**变异证据**:把比对条件替换成 `true /* MUTATED-OUT: ... */` → 用例在
`expect(ed.state.doc).toBe(docBeforeEcho)` 报红,且捕获到一个有意思的副作用:
mutated 后重新 `setContent` 把 markdown-it 序列化后的内容变成了 `"morestart"`(丢了原本
`" morestart"` 的前导空格)—— 印证「即使内容语义相同,setContent 仍是真替换、非幂等」。
还原后 md5 与备份一致。

### 4. `onTransaction`→`emit('transaction')`;`mounted` 末尾 `emit('ready', editor)`

顺序照抄:`onMounted` 内 `new Editor({...onUpdate, onTransaction})` → `editor.value = ed` →
`emit('ready', ed)`(`:44-58`)。裁定 R5:附录 D §D.6.1 的「N29 tbTick」结论不适用本组件(N29
在 `NoteEditPane.vue`,归 T7),但本组件自己涉及 `transaction` 的断言仍附变异证据 ——
注掉 `onTransaction: () => { emit('transaction') }` → 用例「真敲内容触发至少一次 transaction
emit」报红(`expected undefined to be truthy`)。还原后 md5 一致。

### 5. K44:`.vue` 侧零 `<style>` 块 + 不需要 side-effect import

`NotesMarkdownEditor.vue` 全文零 `<style>` 块(样式已在 T2 搬进 `knowledge.scss` 的顶层
`.nme-content .ProseMirror` 例外段,`knowledge.scss:2080-2101`)。**为什么不需要 side-effect
import**:`knowledge.scss` 是本仓**既有的常驻全局样式表**,早已由 `KnowledgeLayout.vue:43` 
`import '../../styles/knowledge.scss'` 挂进依赖图并在整个知识库区常驻生效;本组件的规则
(K44 那段)随 T2 的改动一起已经在那份文件里,不需要本组件再重复 import 一次去"激活"它
——这与 P5c 的 `parser-styles.scss` 不同:那是**新建**的样式文件,在 T2 那次除了写 scss
本身还得靠某个消费组件显式 `import` 才会被 Vite 打进依赖图(否则永远不会被加载);
`knowledge.scss` 不存在这个"从未被 import 过"的问题,它从 P5a 起就是常驻文件。
变异证据(RED 探针,证明「零 `<style>` 块」这条断言真有判别力):往文件末尾临时追加
`<style>.mutated{color:red;}</style>` → 用例「本文件零 `<style>` 块」报红(`toMatch` 命中
`/^<style/m`)。还原后 md5 一致。

### 6. 测试写法(附录 D §D.6 结论,真 `Editor`,不 mock)

`NotesMarkdownEditor.test.ts` 全程用真 `@tiptap/vue-3` `Editor` + 真 `EditorContent`,
`attachTo: document.body`,等待时机 `await nextTick(); await flushPromises()`。8 条用例:
挂载渲染 `.nme-content .ProseMirror` + markdown 一致、`ready` payload 是真 Editor、K38 两个 emit、
§5.3 防回环、`onTransaction`、`onBeforeUnmount` 销毁(`vi.spyOn(ed, 'destroy')`,`destroy` 是
实例方法非 getter,spy 有效)、K44 零 `<style>` 块、缺口③模板零裸色。三条 🔴 项(K38/§5.3/
transaction)均已附变异证据(见上,GREEN→RED→还原,`git status` 全程干净,md5 逐字节比对)。

### 7. 缺口③

`NotesMarkdownEditor.test.ts` 补了「`<template>` 块内(剥离 `var()` 后)零裸 hex/rgb/hsl」定向
断言(手法照抄 `FolderBrowser.test.ts` 现状写法,覆盖度自检靠 `toContain('class="nme"')` /
`toContain('nme-content')`)。RED 探针:临时在模板里加 `style="color: #fff"` → 报红后已还原
(此探针未落盘保存,验证后立即撤销,`git status` 干净)。

## 🔴 意外触发的连带改动:`knowledgeStyles.test.ts` +1 行

`pnpm test` 首次全量跑出 1 个红:该文件已有的「守卫缺口③′」中央测试(P5c/P5b 产出,覆盖
`src/ai/knowledge/**/*.vue` 全部文件)有一条 `KNOWLEDGE_VUE_FILES` 显式清单 + 集合相等防漂移
断言 —— 新增的 `components/NotesMarkdownEditor.vue` 未登记，该断言按其设计意图正确报红
（"新增视图必须显式进清单"）。这是该守卫的既定行为，不是测试环境問題。补的动作 = 在
`KNOWLEDGE_VUE_FILES` 数组里按字母序加一行 `'components/NotesMarkdownEditor.vue'`
（`knowledgeStyles.test.ts:1034`），零其它改动。

**基线复现**（cp 备份→还原成 d144cf6 版本→跑通过→cp 恢复我的版本，md5 逐字节校验一致）：
把新文件临时移出 `src/`（mv 到 scratchpad，非 `git rm`）+ 把 `knowledgeStyles.test.ts` 临时还原
成 `d144cf6` 版本，跑出 **328 文件 / 3595 例**（与治理基线逐字一致）；移回 + 恢复我的版本后
md5 比对逐字节一致，`git status` 只剩预期的 3 个改动 + 2 个新文件。

`knowledgeStyles.test.ts` 单独重跑：51 例（基线,含前 3 期已有文件）→ 53 例（+2，新增文件被
两个 `it.each(KNOWLEDGE_VUE_FILES)` 块各多跑一次）。

## 三门 + 算式

```
pnpm test:      Test Files  329 passed (329)  /  Tests  3606 passed (3606)
vue-tsc --noEmit: exit 0
vite build:       exit 0
```

- **文件数**:328 + 1(`NotesMarkdownEditor.test.ts`) = **329** ✅
- **`.vue` 总数**:179 + 1(`NotesMarkdownEditor.vue`) = **180** ✅(color-guard.test.ts 按
  `**/*.vue` 全量动态生成、每新增一个 `.vue` +1 例,贡献了下面算式里的 1)
- **测试例数**:3595 + 11 = **3606**。11 = 8(`NotesMarkdownEditor.test.ts` 自身新用例)+
  2(`knowledgeStyles.test.ts` 的 `KNOWLEDGE_VUE_FILES` 登记后,两个 `it.each` 块各新增一次
  迭代)+ 1(全仓 `color-guard.test.ts` 对新增 `.vue` 自动 +1 例)。三项均已逐一现测验证
  （非套用计划书算式,已用「临时移出新文件 + 还原被改文件」的方式复现基线 328/3595 后
  再恢复现状,逐字节 md5 确认还原正确）。

已知噪声(`persist.test.ts`/`AgentComposer.test.ts`)本轮未触发,全程零复跑。

## 命中的 K/N 编号

- **K37**(裁定 R2 覆盖):四包锁 v2 线,版本按裁定 R2/附录 D §D.6.3 终值,不按治理原文 `^0.6.1`。
- **K38**:v-model 契约改写 + 双 emit,已落地 + 变异证据。
- **K44**:零 `<style>` 块 + 不需要 side-effect import,已落地 + 说明 + 变异证据。
- 未命中 N 系列(N23-N32 均属 T3/T6/T7 范围,本组件无对应蓝本行为需要"照抄不改"的争议点)。

## fixture / mock 说明

本刀零后端调用,不涉及 `service.notes.*` mock,不适用 §4.1 的 fixture 表。

## 文件改动清单

- 改:`package.json`(+4 行)、`pnpm-lock.yaml`(+522 行,均为四包及其传递依赖)、
  `src/ai/styles/knowledgeStyles.test.ts`(+1 行,登记新 `.vue` 进 `KNOWLEDGE_VUE_FILES`）。
- 新建:`src/ai/knowledge/components/NotesMarkdownEditor.vue`(74 行）、
  `src/ai/knowledge/components/NotesMarkdownEditor.test.ts`(211 行,8 例）。
- 零 `any`(`grep -n '\bany\b'` 两个新文件均无命中，已现测）。

## git 自查

提交前 `git status` 应只剩上述 3 个改动文件 + 2 个新文件（无残留探针/临时文件）。

---

## 修复轮 1(评审反馈)

**问题**:评审指出「spy `setContent` 走不通」这个结论下得太宽 —— `vi.spyOn(ed.commands,
'setContent')` 确实失效(getter 每次访问重建对象,原因诊断本身评审复核成立),但评审找到
一个可行写法:**实例级 `Object.defineProperty(ed, 'commands', {...})` 遮蔽原型链上的
getter**,内部包一层 `Proxy` 拦截 `setContent` 调用次数。计划书 §T4-3 / brief §3-② 原文
规定的判据("拿掉比对 → `setContent` 调用次数从 0 变 1")其实可以落地,不应写成"做不到"。

### 已验证 Proxy 遮蔽写法可行(隔离脚本,先于改测试文件之前跑通)

```
descriptor found on direct prototype? false undefined
found at depth 1 true
calls after 1 setContent: 1 changed
```
(`ed` 的直接原型没有 `commands` getter,往上一层 —— `@tiptap/vue-3` 的 `Editor` 继承的
`@tiptap/core` `Editor` 原型 —— 才找到,与预期一致:`@tiptap/vue-3` 的 `Editor` 是
`@tiptap/core` `Editor` 的子类,没有重写 `commands`。)

### 新增用例:直接断言 `setContent` 调用次数(两侧都断言)

补进 `NotesMarkdownEditor.test.ts` 的 `§5.3 防回环` describe 块,**保留**原有的
`editor.state.doc` 引用同一性用例不删(两条从不同层面守同一件事,均有判别力)。
新增一个可复用的 `spySetContentCalls(ed)` 辅助函数(实例级 `defineProperty` + `Proxy`,零
`any`,类型用 `@tiptap/vue-3` 再导出的 `SingleCommands`)。

🔴 **踩坑记录(已在测试用例的注释里登记,供 T7 参考)**:第一版新用例写的是
`mountEditor('same value')` 后直接 `setProps({ modelValue: 挂载时那个值本身 })` —— 与最初
写引用同一性用例时踩的坑**是同一个坑**:Vue 的 `watch` 源在新旧 prop 值 `Object.is` 相等
时根本不会调用回调,不管生产代码里有没有写比对逻辑,`spy.count()` 恒为 0,零判别力
(已用 mutation 实测坐实:删掉 `:69` 比对后这种写法的新用例仍然全绿,而同一轮 mutation 下
旧的引用同一性用例正确报红,两者结果不一致,证明新用例的第一版判据是假的)。改成与旧用例
同款写法 —— 先真敲字(让回写值与挂载初始值不同,确保 Vue 真的会调用 watch)—— 后,
mutation 才能正确命中两条用例。

### 变异证据(cp 备份 → sed 行首锚定注入 → 先证真落盘 → cp 覆盖还原 → md5 逐字节比对)

**GREEN(修复前,先确认新用例本身通过)**:
```
Test Files  1 passed (1)
Tests  9 passed (9)
```

**注入**(`NotesMarkdownEditor.vue:69` 的比对条件替换成 `true`,`sed -n '66,72p'` 确认真的
落盘):
```
watch(
  () => props.modelValue,
  (v) => {
    if (editor.value && true /* MUTATED-OUT: v !== editor.value.storage.markdown.getMarkdown() */) {
      editor.value.commands.setContent(v)
    }
  },
```

**RED**(两条用例都报红,新用例精确指出调用次数从期望 0 变成实际 1):
```
 × 用户敲字后父组件把同一个值经 v-model 写回,不重设内容(文档引用不变);写入真正不同的值时才重设
 × 用户敲字后父组件把同一个值经 v-model 写回,setContent 调用 0 次;写入真正不同的值时调用 1 次
...
AssertionError: expected 1 to be +0 // Object.is equality
- Expected
0
+ Received
1
...
Test Files  1 failed (1)
Tests  2 failed | 7 passed (9)
```

**还原**(`cp` 备份覆盖,md5 逐字节比对一致,`git diff -- .../NotesMarkdownEditor.vue` 为空):
```
$ md5sum src/ai/knowledge/components/NotesMarkdownEditor.vue /tmp/.../NME.vue.orig
b84f70494ffc68e6a375d37357fea0ef  src/ai/knowledge/components/NotesMarkdownEditor.vue
b84f70494ffc68e6a375d37357fea0ef  /tmp/.../NME.vue.orig
$ git diff -- src/ai/knowledge/components/NotesMarkdownEditor.vue
(empty)
```

### 连跑稳定性(≥5 次要求)

修复后的完整测试文件(9 例)连跑 **7 次,7/7 全绿**,无 flaky:
```
Test Files  1 passed (1)  /  Tests  9 passed (9)   ×7(逐次一致)
```

### 措辞订正

`NotesMarkdownEditor.test.ts` 里「spy 走不通」那条注释已按协调者要求订正为精确表述:
「`vi.spyOn(ed.commands, 'setContent')` 无效,因为 `commands` 是每次访问都重建 bound
function 的 getter;可行写法是实例级 `Object.defineProperty(ed,'commands',{get:...})`
遮蔽该 getter,内部包一层 `Proxy`(见 `spySetContentCalls`)」。`onTransaction` 计数
~1/5 flaky 那条注释**保留原样未动**(评审已复核成立)。

### 产品代码仅注释变动的自证

本轮**未改动**任何生产代码 —— `git diff -- src/ai/knowledge/components/NotesMarkdownEditor.vue`
输出为空(见上,与 HEAD `8897d5e` 逐字节一致)。所有变异注入均通过 `cp` 备份 + 覆盖式还原,
全程未使用 `git checkout`/`git restore`。

### 三门(全量,本轮落盘)

```
$ pnpm test                  > /tmp/p5d-t4-fix-test.log; echo exit=$?
Test Files  329 passed (329)
Tests  3607 passed (3607)
exit=0

$ pnpm exec vue-tsc --noEmit > /tmp/p5d-t4-fix-tsc.log; echo exit=$?
(no output)
exit=0

$ pnpm build                 > /tmp/p5d-t4-fix-build.log; echo exit=$?
✓ built in 13.01s
exit=0
```

**算式**:3606 + 1(新增的 `setContent` 调用次数用例)= **3607** ✅。文件数不变(329,只改
既有文件,零新建/删除文件)。

### git 改动(本轮)

```
$ git status --short
 M src/ai/knowledge/components/NotesMarkdownEditor.test.ts
```
只有测试文件被改(+88 行/−6 行:新增 `spySetContentCalls` 辅助函数 + 新用例 + 订正注释）。

### dev server

本轮未装依赖,未重起 `:5288`(协调者已确认 pid 788096 在监听,遵嘱不动)。
