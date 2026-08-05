# P5e Task 6 报告 —— `SearchView.vue` 上半(搜索框 + 高级面板 + `run()` + 四态)

实现者:sonnet。起点 HEAD `da9f818`(自测确认,`git log --oneline -1`)。

## 0. 改动的文件(仅 3 个 + 本报告)

| 文件 | 性质 |
|---|---|
| `src/ai/knowledge/views/SearchView.vue` | 新建(288 行) |
| `src/ai/knowledge/views/SearchView.test.ts` | 新建(796 行,34 条用例) |
| `src/ai/styles/knowledgeStyles.test.ts` | 只改 1 行(`KNOWLEDGE_VUE_FILES` 数组插入 `'views/SearchView.vue'`) |

`git diff --stat`:
```
src/ai/styles/knowledgeStyles.test.ts | 1 +
1 file changed, 1 insertion(+)
```
(另两个是新建文件,`git status --short` 只有这 3 处改动 + 本报告。)

## 1. 范围自证

- ✅ **未写**结果卡列表(蓝本 `:121-156`)——`phase === 'results'` 分支是空容器 `<div v-else-if="phase === 'results'" class="k-results" />`,零内容。
- ✅ **未写**两个子组件的挂载 markup(蓝本 `:164-172`)——模板末尾只有一行注释说明归 T7。
- ✅ **未写** `fetchBlobUrl`/`openOriginal`/`downloadFile`/`onDrawerToast` 四个函数。
- ✅ **未 import `KFileViewer`**(`grep -c KFileViewer src/ai/knowledge/views/SearchView.vue` = 0,只在注释里提过)。
- 测试文件里有一条永久用例（"范围自证"describe 块）程序化钉住上述前三点(`git show --stat` 附对应用例名)。

## 2. 逐段对照(蓝本 `file:line` → New-UI)

| 蓝本 | New-UI | 备注 |
|---|---|---|
| `:1-176` 模板(除 :121-156/:164-172) | 模板全段 | 1:1,`$t(...)` → `t(...)`(照本仓既定写法,`useI18n()` 解构) |
| `:186-219` script 常量 | `SAMPLE_QUERIES`/`FILE_TYPES`/`MIME_PREFIXES`/`MTIMES`/`WEEK_MS`/`MONTH_MS`/`YEAR_MS` | 逐字照抄;`SAMPLE_QUERIES`/`MTIMES.label` 存 i18n **键名**(不是蓝本那种"英文短语当 key"写法) |
| `:224-244` data() | 对应 `ref` 声明 | 机械替换(`Vue.observable`→`ref`),含 `openFile`/`viewerFile`(N39 要求本刀声明) |
| `:247-249` `advEnabled` | `computed` | 逐字(N34) |
| `:250` `totalChunks` | `computed` | 逐字 |
| `:252-261` watch | `watch(() => route.query.q, ..., {immediate:true})` | N40,响应式 watch 不是 `onMounted` 单次读 |
| `:264` `clear()` | `clear()` | N39,含 `openFile`/`viewerFile` |
| `:265-268` `quickSearch` | `quickSearch()` | 逐字 |
| `:269-274` `toggleSet` | `toggleSet()` | K51,`Set` 复制再整体赋值 |
| `:275-289` `buildFilters` | `buildFilters()` | N35/N36 |
| `:290-316` `run()` | `run()` | 分支逐字 + 新增过期守卫(治理 §5.2) |
| `:317-326` `relLevel`/`relLabel` | **不适用** | 本刀模板范围不渲染结果卡,不消费这两个函数(已由 T3/T4 在 `searchAggregate.ts` 落地并测过) |

## 3. K/N 条目命中申报

- **K44**:`.vue` 侧零 `<style>` 块。用例 + RED 探针(见 §5)。
- **N33**:`SAMPLE_QUERIES` 五词照抄且过 `t()`。用例:点第一个 chip → 输入框值变译文"甲状腺" + `store.runSearch` 收到 `query:'甲状腺'`。
- **N34**:`advEnabled` 判据 `types.size < FILE_TYPES.length`(全选=未启用)。5 条用例(全选侧 + 四个 or 分支各一)。
- **N35**:`MIME_PREFIXES` 逐字,不补 docling 变体。3 条用例(全选不发 / 取消一类按声明序发 / 只留 code 验证 txt 只有 `text/plain`)。
- **N36**:`buildFilters` 的 `1m`=30 天、`1y`=365 天(假时钟)。4 条用例(any/1w/1m/1y 各钉确切 `mtime_after_ms`)。
- **N37**:catch 不清 `ms`。1 条用例(先成功拿 `ms=123`,再失败,断言 `ms` 仍是 123)。
- **N38**:`showRerankWarn` 假时钟 5000ms。2 条用例(正向 + 反向,F4 warnings 非空但不含 `rerank_unavailable`)。
- **N39**:`clear()` 清 `openFile`/`viewerFile`。1 条用例(用 `w.vm` 直读写驱动,理由见 §4)。
- **N40**:`?q=` 深链,watch(immediate)+ 条件 `v && v !== q`。3 条用例,详见 §6。
- **K51**:`toggleSet` 响应性(复制 Set 再整体赋值)。1 条用例(toggle 后 `advEnabled` 指示器立即翻转,再切回验证可逆)。
- **治理 §5.2 run() 过期守卫**(蓝本无,本期新增,K15 同族第 9 次):2 条用例(逻辑交错 + 两实例交错),详见 §5。
- **裁定 R25**:本文件 `import FileDetailDrawer` 但不挂载 markup(见 §7)。
- **K48 相关函数**(`highlight`/`fmtMtime`/`relLevel`/`relLabel`):本刀模板范围(`:1-119`+`:158-162`)**不消费**这四个函数,故未 import,不适用于本刀。

## 4. 用了 w.vm 直读的三处 —— 理由与先例

结果卡列表(`phase==='results'` 分支的内容、`ms` 的渲染)归 T7,T6 没有可点击的 UI 入口能到达
"phase 变成 results 且 ms/results 有真实值"这个显示。技术先例:
`IndexedFilesView.test.ts:618-621`(`errorBanner`)/ `AgentPage.test.ts:295`(`storage`)——
`<script setup>` 顶层 ref 即便未 `defineExpose`,`@vue/test-utils` 的 `wrapper.vm` 在测试环境下
仍可读写(`instance.proxy` 走 `setupState` 双向读写)。用到的三处:
1. "有结果 → phase=results" 用例读 `vm.phase`/`vm.results`/`vm.totalChunks`。
2. N37 用例读 `vm.ms`。
3. N39 `clear()` 用例**写** `vm.openFile`/`vm.viewerFile`(制造非空态,因为本刀没有 UI 入口能把它们设为非空)后驱动 `clear()`,再读回验证清空。

## 5. `run()` 过期守卫 —— 两条 RED 探针(治理 §5.2)

### ① 逻辑交错(发 A 挂起 → 发 B 立即回 → A 后回,最终状态是 B 的)

```bash
cp src/ai/knowledge/views/SearchView.vue /tmp/SearchView.vue.orig
md5sum src/ai/knowledge/views/SearchView.vue
# edbfab91c77f0a4ebcce4c521e03da69  src/ai/knowledge/views/SearchView.vue
sed -i 's/if (myEpoch !== runEpoch) return/if (false) return \/\/ RED-PROBE-DISABLED/' src/ai/knowledge/views/SearchView.vue
pnpm test -- src/ai/knowledge/views/SearchView.test.ts --reporter=verbose
```
输出(节选):
```
 × ... 🔴 ① 逻辑交错:发 A(alpha,挂起)→ 发 B(beta,立即回)→ B 先落地 → A 后落地,最终状态是 B 的
 ✓ ... 🔴 ② 两实例交错守作用域...
FAIL ... 🔴 ① 逻辑交错 ...
Tests  1 failed | 33 passed (34)
```
→ **①报红,②不受影响**(②测的是另一个维度,见下)。还原:
```bash
cp /tmp/SearchView.vue.orig src/ai/knowledge/views/SearchView.vue
md5sum src/ai/knowledge/views/SearchView.vue /tmp/SearchView.vue.orig
# edbfab91c77f0a4ebcce4c521e03da69  两边一致
```
复跑确认转绿:`Tests 34 passed (34)`。

### ② 两实例交错守作用域(判据:`runEpoch` 挪到模块级共享 → 必须报红)

`<script setup>` 顶层声明的 `let runEpoch = 0` 本身就是组件实例局部闭包变量(每次 `setup()`
各一份),不需要额外动作即为正确形态。为证明"若挪到模块级会报红",手工在 SFC 里加一个
**非 setup 的 `<script lang="ts">` 块**(其顶层绑定在整个模块只求值一次、被同一 SFC 的所有
实例共享),把 `runEpoch` 换成这个共享对象:

```bash
python3 - <<'EOF'
import re
path = 'src/ai/knowledge/views/SearchView.vue'
src = open(path).read()
probe_block = '<script lang="ts">\nexport const __redProbeEpoch = { v: 0 }\n</script>\n'
src = probe_block + src
src = src.replace("let runEpoch = 0\n", "// removed\n")
src = re.sub(r'(?<![A-Za-z0-9_])runEpoch(?![A-Za-z0-9_])', '__redProbeEpoch.v', src)
open(path, 'w').write(src)
EOF
pnpm test -- src/ai/knowledge/views/SearchView.test.ts --reporter=verbose
```
输出(节选):
```
 ✓ ... 🔴 ① 逻辑交错 ...
 × ... 🔴 ② 两实例交错守作用域...
FAIL ... 🔴 ② 两实例交错守作用域(判据:runEpoch 挪到模块级共享 → 必须报红...)
AssertionError: expected 'loading' to be 'empty'
Tests  1 failed | 33 passed (34)
```
→ **②报红,①不受影响**(实例 1 只发过一次 `run()`,单实例内不存在过期,验证了两条用例
各自钉住不同维度:①钉逻辑正确性,②钉变量作用域)。还原:
```bash
cp /tmp/SearchView.vue.orig src/ai/knowledge/views/SearchView.vue
md5sum src/ai/knowledge/views/SearchView.vue /tmp/SearchView.vue.orig
# edbfab91c77f0a4ebcce4c521e03da69  两边一致
```
复跑确认转绿:`Tests 34 passed (34)`。

## 6. N40 深链 —— 三条用例的 RED 探针

### ② 判据:降级成只在 `onMounted` 读一次 → 必须报红

```bash
# 把响应式 watch 换成 onMounted 单次读(不再响应后续 query 变化)
python3 - <<'EOF'
path = 'src/ai/knowledge/views/SearchView.vue'
src = open(path).read()
old = '''watch(
  () => route.query.q,
  (v) => {
    if (v && v !== q.value) {
      q.value = v as string
      run()
    }
  },
  { immediate: true },
)'''
new = '''onMounted(() => {
  const v = route.query.q
  if (v && v !== q.value) {
    q.value = v as string
    run()
  }
})'''
src = src.replace(old, new)
src = src.replace("import { computed, ref, watch } from 'vue'", "import { computed, onMounted, ref, watch } from 'vue'")
open(path, 'w').write(src)
EOF
pnpm test -- src/ai/knowledge/views/SearchView.test.ts --reporter=verbose
```
输出(节选):
```
 ✓ ... ① 挂载时 query 已有 → 立即搜(immediate 生效)
 × ... ② 挂载后改 query → 再搜(🔴 判据:降级成只在 onMounted 读一次 → 必须报红...)
 ✓ ... ③ 🔴 query 与当前 q 相同时不重复搜...
FAIL ... ② 挂载后改 query → 再搜...
AssertionError: expected "wrappedAction" to be called 1 times, but got 0 times
Tests  1 failed | 33 passed (34)
```
→ **②报红,①③不受影响**。还原 + md5sum 核对(同上手法,一致)。

### ③ 判据:去掉 `v !== q.value` 条件 → 必须报红

```bash
sed -i "s/if (v && v !== q.value) {/if (v) {/" src/ai/knowledge/views/SearchView.vue
pnpm test -- src/ai/knowledge/views/SearchView.test.ts --reporter=verbose
```
输出(节选):
```
 ✓ ... ① 挂载时 query 已有 → 立即搜(immediate 生效)
 ✓ ... ② 挂载后改 query → 再搜...
 × ... ③ 🔴 query 与当前 q 相同时不重复搜...
FAIL ... ③ query 与当前 q 相同时不重复搜...
AssertionError: expected "wrappedAction" to not be called at all, but actually been called 1 times
Tests  1 failed | 33 passed (34)
```
→ **③报红,①②不受影响**。还原(`cp` + `md5sum` 一致)。

🔴 **③ 用例的判别力设计说明**(治理 §9.14-3):路由初始 query 无 `q`(`undefined`),
先手动把 `q.value` 设为 `'manual'`(模拟用户直接在搜索框打字,不经过路由),再 push
**同一个值** `'manual'` 到路由 query——此时 watch 的**源**从 `undefined` 变成 `'manual'`,
是一次真实变化(watch 会调用 handler),但 handler 内部 `v !== q.value` 应为 `false`
(`'manual' === 'manual'`)。这正确地把"watch 源没变化因而不触发"与"handler 内部条件挡住"
两件事分开测了后者——若直接 push 两次相同值,Vue `watch` 会在源头就去重,handler 根本不
被调用,该用例会在"守卫被整个拿掉"时也照样绿(零判别力),已避开这个陷阱。

## 7. 裁定 R25 —— 两条自动上膛守卫的证据

### T5 DoD-12 的守卫(位于 `FileDetailDrawer.test.ts:645-653`,非本刀所写)

现在**走"已存在"分支且已满足**:本文件存在(`views/SearchView.vue`)且含
`import FileDetailDrawer from '../components/FileDetailDrawer.vue'`,该文件路径
逐字匹配该守卫的正则 `/FileDetailDrawer\.vue/`。已运行 `FileDetailDrawer.test.ts`
确认全绿(见 §8 全量结果)。

### T6 自建的守卫(本文件"自动上膛守卫"describe 块)

**惰性证明**(永久用例,`--reporter=verbose` 见 passed 列表,非 skip/todo):
```
 ✓ SearchView —— 自动上膛守卫(T6 自建)... > 🔴 现在模板不含 <FileDetailDrawer(markup 归 T7)⇒ 惰性通过,非 skip/todo
```

**上膛证明(手工探针,不落进永久测试文件)**:

1. 注入零监听的 markup → 必须报红:
```bash
python3 -c "
path = 'src/ai/knowledge/views/SearchView.vue'
src = open(path).read()
marker = '      <!-- 两个子组件挂载归 T7'
inject = '      <FileDetailDrawer v-if=\"openFile\" :file=\"openFile\" :query=\"lastQuery\" />\n'
open(path,'w').write(src.replace(marker, inject + marker))
"
pnpm test -- src/ai/knowledge/views/SearchView.test.ts --reporter=verbose
```
输出:
```
 × ... 范围自证 ... 模板不含 <FileDetailDrawer/<KFileViewer markup ...
 × ... 自动上膛守卫(T6 自建) ... 🔴 现在模板不含 <FileDetailDrawer...
AssertionError: 模板含 <FileDetailDrawer 时必须同时接 @close: expected false to be true
Tests  2 failed | 32 passed (34)
```
(两条同时报红是预期的:"范围自证"钉住"T6 不许写 markup",与"自动上膛守卫"是两条独立断言,
都应该在这一步报红。)

2. 补全四个监听 → 自动上膛守卫转绿(范围自证仍报红,预期,证明它是独立的两条断言):
```bash
python3 -c "
path = 'src/ai/knowledge/views/SearchView.vue'
src = open(path).read()
old = '<FileDetailDrawer v-if=\"openFile\" :file=\"openFile\" :query=\"lastQuery\" />'
new = '<FileDetailDrawer v-if=\"openFile\" :file=\"openFile\" :query=\"lastQuery\" @close=\"openFile = null\" @open=\"() => {}\" @download=\"() => {}\" @toast=\"() => {}\" />'
open(path,'w').write(src.replace(old, new))
"
pnpm test -- src/ai/knowledge/views/SearchView.test.ts --reporter=verbose
```
输出:
```
 ✓ ... 自动上膛守卫(T6 自建) ... 🔴 现在模板不含 <FileDetailDrawer...
 × ... 范围自证 ... 模板不含 <FileDetailDrawer/<KFileViewer markup ...
Tests  1 failed | 33 passed (34)
```
→ **自动上膛守卫转绿,范围自证仍报红**(符合预期:范围自证是"T6 不许写 markup"的
永久钉子,只要 markup 存在就该红,与 markup 是否接了 4 个监听无关)。

3. 还原:
```bash
cp /tmp/SearchView.vue.orig src/ai/knowledge/views/SearchView.vue
md5sum src/ai/knowledge/views/SearchView.vue /tmp/SearchView.vue.orig
# edbfab91c77f0a4ebcce4c521e03da69  两边一致
```
复跑确认全绿(34/34)。

## 8. 三门完整终值

```
Test Files  335 passed (335)
     Tests  4215 passed (4215)
vue-tsc --noEmit  exit=0
vite build        exit=0
```

- 算术:`.vue` 总数 **182(起点)→183(T4)→184(T5)→185(T6,本刀)**(`find src -name "*.vue" | wc -l` = 185,实测)。
- `color-guard.test.ts` 用例数 **184→185→186→187(本刀)**(`pnpm test -- src/styles/color-guard.test.ts` = 187 passed,实测)。
- 测试文件数 **334→335**(新增 `SearchView.test.ts` 一个文件)。
- 用例总数 **4176(T5 收官基线)→4215**,delta=39 = `SearchView.test.ts` 新增 34 条
  + `knowledgeStyles.test.ts` 因 `KNOWLEDGE_VUE_FILES` 多一个文件而在 4 个
  `it.each(KNOWLEDGE_VUE_FILES)` 循环里各 +1(4 条)+ `color-guard.test.ts` 動态生成 +1 条
  = 34+4+1=39,逐项核对无缺口。
- 已知噪声(`persist.test.ts`/`AgentComposer.test.ts`)本次全量跑未触发,无需复跑。

## 9. mock 形状与 fixture 出处

`store.runSearch` 全程 mock 在 store action 层(`vi.spyOn(store, 'runSearch')`),返回值
= 后端原始 snake_case(`hits`/`files`/`stats`/`warnings`),`toFileResults` 之后才是 camelCase
——未搞反。

| Fixture | 出处标签 | 用途 |
|---|---|---|
| `F1-search-text.empty.REAL.json` | REAL | idle 之外多数场景的默认成功 mock、empty 态 |
| `F4-search-text.no_accessible_roots.REAL.json` | REAL | N38 反向断言(非空 warnings 但非 rerank_unavailable) |
| `F11-rerank-warning.CONSTRUCTED.json` | CONSTRUCTED(D-6 模具,已删 3 个 `_` 前缀键) | N38 正向断言 |
| `F5b-search-text.multifile.REPLAYED.json` | REPLAYED(8 条 `preview.text` 全部截到真实前 70 字符,附完整 len/sha256,零条完整正文,符合 R9-3) | results 态、run() 过期守卫两条用例、N39 |

## 10. 内联 style=/:style=/color= 逐处判定(E-57,本刀范围内 12 处,零色字面量)

蓝本 401 行全文共 **16 处**(`grep -n 'style="\|color="' 蓝本` 逐行核实,与 E-57 结论一致),
按 T6/T7 范围切分:**T6(本刀,`:1-119`+`:158-162`)= 12 处;T7(`:121-156`)= 4 处(`:124`/`:149`/
`:151`/`:152`,留给 T7 报告逐处判定)**。

本刀 12 处(New-UI 行号 → 蓝本行号 → 判定):

| New-UI 行 | 蓝本行 | 内容 | 判定 |
|---|---|---|---|
| 264 | `:8` | `color="var(--text-tertiary)"`(KIcon) | 已是 token,照抄 |
| 284 | `:26` | `style="color: var(--accent); font-weight: 600"` | color 已是 token;`font-weight` 纯排版,N24 同族照抄 |
| 356-364 | `:84` | 多属性 style(`font-size`/`color: var(--text-quaternary)`/`text-transform`/`letter-spacing`/`font-weight`/`margin-top`) | color 已是 token;其余纯尺寸排版,N24 同族照抄 |
| 367 | `:87` | `style="justify-content: center"` | 纯布局,零颜色 |
| 377 | `:97` | `style="display: inline-block; width: 200px; height: 12px"` | 纯尺寸 |
| 380 | `:100` | `style="width: 30px; height: 36px"` | 纯尺寸 |
| 381 | `:101` | `style="flex: 1; display: flex; flex-direction: column; gap: 8px"` | 纯布局 |
| 382 | `:102` | `style="width: 40%; height: 14px"` | 纯尺寸 |
| 383 | `:103` | `style="width: 100%; height: 12px"` | 纯尺寸 |
| 384 | `:104` | `style="width: 90%; height: 12px"` | 纯尺寸 |
| 385 | `:105` | `style="width: 35%; height: 10px"` | 纯尺寸 |
| 406 | `:159` | `style="color: var(--danger)"` | 已是 token,照抄 |

**终值:12 处,零色字面量**(全部已是 `var(...)` token 或纯尺寸/排版,与 E-57 全文结论
"色字面量 0"一致)。本文件已加进 `KNOWLEDGE_VUE_FILES`(`knowledgeStyles.test.ts` 的 +1 行),
color-guard 因零 `<style>` 块而不需要额外扫描(K44)。

## 11. 代码膨胀自评

蓝本本刀范围(`:1-119`+`:158-162`+对应 script 常量/方法,约 190 行原始行数)对应
New-UI 288 行(`.vue`)。膨胀构成:
- 文件头/逐函数 JSDoc 注释(K/N 条目引用、蓝本行号对照):约 90 行,治理 §10 强制要求。
- `run()` 的过期守卫(治理 §5.2 明令新增,蓝本没有):约 8 行(`runEpoch`/`myEpoch` 声明 + 两处判断)。
- TypeScript 类型标注(`Phase`/`Record<string, unknown>`/接口 import):约 10 行,零运行时行为变化。
- 其余为 1:1 移植,零无关重构、零顺手抽象。

## 12. 申报纪律自查

- 未跳过任何带 🔴 的复核项;R25 裁定原文逐句照办(只 import 不挂载,不 import KFileViewer)。
- N34/N35/N36/N37/N38/N40 均未被"顺手修正"——已逐条对照蓝本原文核实,反直觉/看似写反的判据全部照抄。
- 唯一一处"未在计划书字面出现但为满足治理 §5.2 主动添加"的逻辑 = `run()` 的过期守卫本身,
  已在文件头与本报告 §5 显式申报,非未申报偏离。

## 状态

三门全绿,12 处 RED 探针全部按预期报红并已还原(md5sum 逐字节核对一致)。
