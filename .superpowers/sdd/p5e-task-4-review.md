# P5e Task 4 独立评审(sonnet,双重降级刀)

> 评审者:独立 sonnet agent。逐条自己 grep/读源/跑命令,不采信 T4 报告的任何结论。
> 被审提交:`12199dc`(父 `a5075ea`)。可写仓工作树全程 clean,未 checkout/stash/commit。

---

## §1 协调者 3 处抽验 —— 独立复核

```
$ git ls-files src | grep -c '\.vue$'   → 183   ✅ 与协调者一致
$ find src -name '*.test.ts' | wc -l    → 333   ✅ 与协调者一致
$ git diff --name-only a5075ea..HEAD
  .superpowers/sdd/p5e-task-4-report.md
  src/ai/knowledge/components/KFileViewer.test.ts
  src/ai/knowledge/components/KFileViewer.vue
  src/ai/knowledge/util/searchAggregate.test.ts
  src/ai/styles/knowledgeStyles.test.ts
  → 只有 4 个授权文件 + 台账报告   ✅ 与协调者一致
```

## §2 三门与数字 —— 亲跑

```
$ pnpm test                     → Test Files 333 passed (333) / Tests 4134 passed (4134) / EXIT=0
$ pnpm exec vitest run src/styles/color-guard.test.ts --reporter=verbose
    → Tests 185 passed (185)   ✅ 184→185,恰好 +1
$ pnpm exec vue-tsc --noEmit   → EXIT=0(零错误)
$ pnpm build                   → EXIT=0(`✓ built in 13.73s`)
```
与 T4 自报数字(333 文件 / 4134 例 / .vue 183 / color-guard 185)**逐字一致**。
`package.json`/`pnpm-lock.yaml` 未出现在 diff 里 ⇒ 零改动确认。

---

## §3-A K46 三条前提 —— 独立验证

1. `grep -n "overlay\|v-container\|doc-container" src/files/viewers/DocViewer.vue src/files/viewers/ExcelViewer.vue`
   → **无输出,exit 1**。亲读两文件模板:各自渲染 `<ViewerShell>` + `.office-body`/`.office-scroll`,
   零 `.overlay`/`.v-container`/`.doc-container` 字面量。✅ 成立。
2. `sed -n '22,29p' src/files/viewers/ViewerShell.vue`
   → `.overlay { position: absolute; inset: 0; z-index: 200; overflow: hidden; ... }`(:24 逐字命中)。
   ✅ 确认「host 需要提供铺满视口定位祖先」这个前提为真 —— `.overlay` 是 `absolute`,
   要相对某个 `position` 非 static 的祖先定位,`.k-fileviewer-host` 的 `fixed` 正好扮演这个角色。
3. `.k-fileviewer-host` 应用在 `KFileViewer.vue` 模板根 `<div class="k-fileviewer-host">`(亲读源码确认),
   且 `KFileViewer.test.ts` 首条用例 `expect(w.classes()).toContain('k-fileviewer-host')` 钉住。✅
4. T2 三属性断言坐标:`knowledgeStyles.test.ts` 里搜 `K46 / K47` describe 块。
   亲手做变异:临时把 `.k-fileviewer-host` 的 `position: fixed;` 改成 `position: absolute;`,
   跑 `knowledgeStyles.test.ts` → **必须报红**(见 §5 探针记录)。
5. `.k-modal-bg` z-index:亲读 `knowledge.scss` 确认 T4 diff 里零改动 `.k-modal-bg`(`git diff` 只改
   `knowledgeStyles.test.ts` + `searchAggregate.test.ts`,`knowledge.scss` 本身 diff 为空)。✅

## §3-B R15-④ 祖先链 —— 独立重测

亲手 grep 整条链(`.knowledge-app` 主规则块 `knowledge.scss:476-497`、`.k-main`
`knowledge.scss:619-`、`KnowledgeLayout.vue` 全文、`App.vue` 全文、`main.ts`、
`theme.css` 的 `body`/`html`/`#app` 规则):

```
$ sed -n '476,497p' src/ai/styles/knowledge.scss
.knowledge-app { display: grid; ...; height: 100vh; width: 100vw; overflow: hidden;
  background: var(--bg-app); font-family; color; font-size; line-height; ... }
  → 零 transform/filter/will-change/contain/perspective

$ sed -n '619,626p' src/ai/styles/knowledge.scss   # .k-main
  → display:flex; min-width; min-height; background — 零相关属性

$ grep -n "transform\|filter\|will-change\|contain:\|perspective" src/ai/styles/knowledge.scss
  → 全部命中都是局部子选择器(.chev / .k2-layer:hover / @keyframes / .k2-* 等),
    零一条挂在 .knowledge-app / .k-main 自身或任何真实祖先上;
    唯一疑似命中在 :2681 是**文档注释内文字**(亲读上下文确认在 /* ... */ 块内),非声明

$ cat src/ai/knowledge/views/KnowledgeLayout.vue   # 亲读全文
  → 根 <div class="knowledge-app">,router-view 直接嵌在 .k-main 内,
    无 <Transition>/内联 transform/filter 包裹

$ cat src/App.vue
  → <template><router-view /><AppToast /></template>,无包裹 div,无 <style>

$ grep -rn "#app\b" src/**/*.css src/**/*.scss 2>/dev/null → 零命中
$ grep -n "^body\|body::before\|body::after\|body {" src/styles/theme.css
  → body 自身规则(:313, :330)零 transform/filter/will-change,
    只有 body::before(:335) / body::after(:352) 两个伪元素有 transform/filter

$ grep -rn "will-change\|contain:\|perspective" src --include=*.css --include=*.scss --include=*.vue
  → 唯一命中仍是 knowledge.scss:2681 的文档注释文字,零真实声明
```

**独立判断「`body::before`/`::after` 的 transform/filter 不影响其父 body 的其它后代」这个推理**:
✅ **认为它是对的,理由(CSS 规范层面独立判断,非采信报告)**:
- containing block 的建立规则作用在**该 CSS 属性所应用到的那个 box** 上。`transform`/`filter`
  应用在 `::before`/`::after` 伪元素自己的生成盒子上,该伪元素盒子因此成为**它自己子孙**的
  containing block(但伪元素通常是空内容,没有子孙)。
- 这条规则**不会反向传导给真实 `body` 元素本身**——`body` 元素自己的计算样式里没有
  `transform`/`filter`,所以 `body` 不是新的 containing block。`body::before`/`::after`
  在渲染树里是 `body` 的**生成内容子节点**,与 `#app`(`body` 的另一个真实子元素)是**兄弟关系**,
  不是祖先关系 —— 它们的 transform/filter 只影响自己的盒子,不会成为 `#app` 及其后代
  (含 `.knowledge-app` → ... → `.k-fileviewer-host`)的 containing block。
- 因此 `.k-fileviewer-host` 的 `position: fixed` 沿 DOM 祖先链一路上溯到 `html`(initial
  containing block = viewport),**没有任何真实祖先元素**触发 containing block 降级。

**祖先是否有遗漏(reka-ui Portal / `.set-app`/`.agent-app` 之类作用域容器)**:
`.k-fileviewer-host` 将来挂在 `SearchView.vue`(T6/T7 尚未创建)内,当前唯一可核实的
真实祖先链就是 `router-view → .k-main → .knowledge-app → KnowledgeLayout 根 → App.vue
根(零包裹)→ #app → body → html`。knowledge 区没有用 reka-ui `<Teleport>`/Portal 包裹
`SearchView`(其余 `.knowledge-app` 子路由如 `DashboardView`/`QueueView`/`SettingsView`/
`NotesView` 均直接是 `router-view` 的组件,零 Teleport 中转层),`.agent-app`/`.set-app`
是**其它区**(AI Agent / Settings)各自的顶层容器,与 `/ai/knowledge/*` 路由树不相交。
**结论:T4 没有漏掉祖先** —— 但要注明:这条结论的前提是「SearchView 未来不会在
`.k-fileviewer-host` 与 `.knowledge-app` 之间插入 transform/filter/will-change 的包裹层」,
这是 T6/T7 的责任田,T4 的结论只对**当前已存在的祖先链**成立(T4 报告原文亦如此措辞,
未越权断言未来)。

**祖先链探针(独立做,非报告转述)**:临时把 `.knowledge-app` 主规则块加一行 `transform: translateZ(0);`,
跑 `knowledgeStyles.test.ts` 全量 —— 见 §5 记录:**不会报红**(现有断言集里没有一条钉「`.knowledge-app`
自身零 transform」)。这不是缺陷(R15-④ 的判据是「T4 亲自实测祖先链干净」而非「加一条自动化守卫锁死
未来不能有 transform」),但**留一条 Minor**:祖先链的干净性目前完全靠人工实测报告担保,
没有回归守卫——将来任何人往 `.knowledge-app` 加一行 `transform`/`filter`/`will-change`,
三门全绿也不会报警,K46 会在真机悄悄失效。见下文 Minor 列表。

---

## §3-C R16 —— G1/G3 探针独立复现

### G1 —— 互换 `[data-kind="md"]` 与 `[data-kind="doc"]`

```
$ cp src/ai/styles/knowledge.scss /tmp/p5e-t4-review/knowledge.scss.orig
$ md5sum src/ai/styles/knowledge.scss
  a30da07adfc9acc609b2701a174f25ca

# 注入前
$ sed -n '905,909p' src/ai/styles/knowledge.scss
    &[data-kind="pdf"] { background: var(--rtag-pdf); } /* 蓝本 :618 */
    &[data-kind="md"] { background: var(--rtag-md); } /* 蓝本 :619 */
    &[data-kind="doc"] { background: var(--rtag-doc); } /* 蓝本 :620 */
    &[data-kind="txt"] { background: var(--rtag-txt); } /* 蓝本 :621 */
    &[data-kind="code"] { background: var(--rtag-code); } /* 蓝本 :622 */

$ sed -i '906s/.*/    \&[data-kind="md"] { background: var(--rtag-doc); } \/* REVIEW-PROBE *\//' src/ai/styles/knowledge.scss
$ sed -i '907s/.*/    \&[data-kind="doc"] { background: var(--rtag-md); } \/* REVIEW-PROBE *\//' src/ai/styles/knowledge.scss

# 注入后(先证落盘)
$ sed -n '905,909p' src/ai/styles/knowledge.scss
    &[data-kind="pdf"] { background: var(--rtag-pdf); } /* 蓝本 :618 */
    &[data-kind="md"] { background: var(--rtag-doc); } /* REVIEW-PROBE */
    &[data-kind="doc"] { background: var(--rtag-md); } /* REVIEW-PROBE */
    &[data-kind="txt"] { background: var(--rtag-txt); } /* 蓝本 :621 */
    &[data-kind="code"] { background: var(--rtag-code); } /* 蓝本 :622 */

$ pnpm exec vitest run src/ai/styles/knowledgeStyles.test.ts --reporter=verbose 2>&1 | grep -E "✓|×" | grep -i "rcard-tag"
 × k-rcard-tag[data-kind="md"] 消费 var(--rtag-md)(判据:与另一个 data-kind 互换 → 必须报红,见 T4 报告 RED 探针)
 × k-rcard-tag[data-kind="doc"] 消费 var(--rtag-doc)(判据:与另一个 data-kind 互换 → 必须报红,见 T4 报告 RED 探针)
 Test Files  1 failed (1)
      Tests  2 failed | 343 passed (345)

# 还原
$ cp /tmp/p5e-t4-review/knowledge.scss.orig src/ai/styles/knowledge.scss
$ md5sum src/ai/styles/knowledge.scss
  a30da07adfc9acc609b2701a174f25ca   ← 与注入前逐字节一致
$ git status --porcelain src/ai/styles/knowledge.scss   → (空)
```
✅ **G1 独立复现:精确报红,仅报红互换的那两条,还原确认。**

### G3 —— `.k-rcard-icon` 底色 `--paper-surface` → `--bg-elevated`

```
$ sed -n '887p' src/ai/styles/knowledge.scss   # 注入前
    background: var(--paper-surface); /* 蓝本 :599 白纸片底色具名裸值 → 既有例外 token,见声明处 */

$ sed -i '887s/.*/    background: var(--bg-elevated); \/* REVIEW-PROBE *\//' src/ai/styles/knowledge.scss
$ sed -n '887p' src/ai/styles/knowledge.scss   # 注入后(先证落盘)
    background: var(--bg-elevated); /* REVIEW-PROBE */

$ pnpm exec vitest run src/ai/styles/knowledgeStyles.test.ts --reporter=verbose 2>&1 | grep -E "✓|×" | grep -i "rcard-icon"
 × k-rcard-icon 底色消费 var(--paper-surface)(判据:换成别的 token → 必须报红)
 Test Files  1 failed (1)
      Tests  1 failed | 344 passed (345)

# 还原
$ cp /tmp/p5e-t4-review/knowledge.scss.orig src/ai/styles/knowledge.scss
$ md5sum src/ai/styles/knowledge.scss
  a30da07adfc9acc609b2701a174f25ca   ← 一致
$ git status --porcelain src/ai/styles/knowledge.scss   → (空)
```
✅ **G3 独立复现:精确报红仅该条,还原确认。**

### 7 条覆盖 8 个新 token 里的 7 个(核对 token 名 ↔ 附录 B)

亲读 `p5e-appendix-B-tokens.md` §B.2:新建 7 个 = `--rtag-pdf/md/doc/txt/code` +
`--shadow-drawer` + `--mark-hl-bg`。第 8 个(`--mark-hl-bg`)按附录已有既存绑定守卫
(mark 三条规则各归其位)。T4 补的 7 条 = 5×`--rtag-*` + `--paper-surface`(不在新建
7 个里,是"复用但本档尚未声明"的第 8 类 token,附录 B.5 清单第 1 项)+ `--shadow-drawer`。
**逐个核对无误** —— T4 实际补的是「附录 B 新建 7 个中的 6 个(`--rtag-*` ×5 +
`--shadow-drawer`)+ 复用但需在本档校验消费点的 `--paper-surface`」,恰好覆盖了
R16 点名的两组探针(G1 覆盖 rtag 家族,G3 覆盖 paper-surface),`--mark-hl-bg` 保持
原有断言不变(T4 diff 未动该处)。**7 条数字与 R16 要求的"7 条绑定断言"逐条对应,无遗漏无串位。**

### 只加固未放宽

```
$ git diff a5075ea..HEAD -- src/ai/styles/knowledgeStyles.test.ts | grep -c '^-' 
0
$ git diff a5075ea..HEAD -- src/ai/styles/knowledgeStyles.test.ts | grep -c '^-.*[a-zA-Z]'
0
```
✅ 纯插入(52 行全 `+`,0 行 `-`)。亲读 diff 全文,一处是新增 describe 块(51 行),
一处是 `KNOWLEDGE_VUE_FILES` 数组里插入一行 `'components/KFileViewer.vue',`
(字母序插入在 `FolderBrowser.vue` 与 `KIcon.vue` 之间,顺序正确)。**零删除,零修改既有行。**

---

## §3-D R21 —— groupHits 覆盖缺口独立变异

```
$ grep -n "function groupHits" -A 12 src/ai/knowledge/util/searchAggregate.ts
function groupHits(hits: ChunkHitRaw[]): FileGroupRaw[] {
  const order: string[] = []
  const byId: Record<string, FileGroupRaw> = {}
  for (const h of hits) {
    if (!byId[h.file_id]) {
      byId[h.file_id] = { file_id: h.file_id, mime: h.mime, kind: h.kind, score: h.score, paths: h.paths, chunks: [] }
      order.push(h.file_id)
    }
    byId[h.file_id].chunks!.push(h)
  }
  return order.map((id) => byId[id])
}
```
独立注入(python3 精确替换,取首次遇到该 file_id 时的 score → 改成每次都取 `Math.max`):
```
$ cp src/ai/knowledge/util/searchAggregate.ts /tmp/p5e-t4-review/searchAggregate.ts.orig
$ python3 - <<'EOF'
import re
p = 'src/ai/knowledge/util/searchAggregate.ts'
s = open(p).read()
old = '''    if (!byId[h.file_id]) {
      byId[h.file_id] = { file_id: h.file_id, mime: h.mime, kind: h.kind, score: h.score, paths: h.paths, chunks: [] }
      order.push(h.file_id)
    }
    byId[h.file_id].chunks!.push(h)'''
new = '''    if (!byId[h.file_id]) {
      byId[h.file_id] = { file_id: h.file_id, mime: h.mime, kind: h.kind, score: h.score, paths: h.paths, chunks: [] }
      order.push(h.file_id)
    } else if (h.score > byId[h.file_id].score) {
      byId[h.file_id].score = h.score // REVIEW-PROBE: 取最高分而非首条
    }
    byId[h.file_id].chunks!.push(h)'''
assert old in s
open(p,'w').write(s.replace(old, new))
EOF
$ grep -n "REVIEW-PROBE" src/ai/knowledge/util/searchAggregate.ts   # 先证落盘
213:    } else if (h.score > byId[h.file_id].score) {
214:      byId[h.file_id].score = h.score // REVIEW-PROBE: 取最高分而非首条

$ pnpm exec vitest run src/ai/knowledge/util/searchAggregate.test.ts --reporter=verbose 2>&1 | tail -15
 × searchAggregate > toFileResults > 档 1(变体·构造样本)— 首 chunk 分数低于后续 chunk 时,fileVM.score 仍取首 chunk(判据:实现改成"取最高分" → 必须报红)
 Test Files  1 failed (1)
      Tests  1 failed | 74 passed (75)

# 还原
$ cp /tmp/p5e-t4-review/searchAggregate.ts.orig src/ai/knowledge/util/searchAggregate.ts
$ md5sum src/ai/knowledge/util/searchAggregate.ts /tmp/p5e-t4-review/searchAggregate.ts.orig
3466dd7de6465ef2c2f2340add577a81  src/ai/knowledge/util/searchAggregate.ts
3466dd7de6465ef2c2f2340add577a81  /tmp/p5e-t4-review/searchAggregate.ts.orig
$ git status --porcelain src/ai/knowledge/util/searchAggregate.ts   → (空)
```
✅ **独立复现:精确报红仅新用例,原 74 条全绿(与 T3 评审的"取首"零判别力 74/74 全绿现象吻合,
证明新用例正是缺口的补丁)。还原后 md5 一致。**

**产品代码零改动**:`git diff a5075ea..HEAD -- src/ai/knowledge/util/searchAggregate.ts` → 空输出。✅

**searchAggregate.test.ts 其余一字未动**:
```
$ git diff a5075ea..HEAD --stat -- src/ai/knowledge/util/searchAggregate.test.ts
 1 file changed, 28 insertions(+)
$ git diff a5075ea..HEAD -- src/ai/knowledge/util/searchAggregate.test.ts | grep -c '^-'
0
```
✅ 纯插入 28 行,0 删除。亲读 diff:①档 1(变体·构造样本)新用例(22 行含空行)
②`chunkVM` 边界块前的出处标签注释(6 行)。

**Minor-2 出处标签**:亲读 `chunkVM 边界 — 蓝本 :25-36` describe 块前新增注释,
写明该块 fixture 属 `.CONSTRUCTED`(D-6 模具)。✅ 只加注释未动断言(diff 里该处也是纯 `+`)。

---

## §3-E T4 申报的偏离(N41 Esc 判据)—— 独立复核三件事

### (1) 原判据「卸载后再按 Esc 不再发 close」是否真的零判别力

独立实验(在 `KFileViewer.test.ts` 旁写临时探针,验证完删除,不提交):
```
$ cat > /tmp/p5e-t4-review/esc-probe.test.ts <<'EOF'
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import KFileViewer from '/home/nimo/NimoTech/.sp8/NimoOS-New-UI/src/ai/knowledge/components/KFileViewer.vue'
// 用 T4 同款 mock 边界
EOF
```
(改为直接在仓内已有的 `KFileViewer.test.ts` 旁做同样探针更省事、且能复用其 `vi.mock`)
```
$ cp src/ai/knowledge/components/KFileViewer.vue /tmp/p5e-t4-review/KFileViewer.vue.orig
$ python3 - <<'EOF'
p = 'src/ai/knowledge/components/KFileViewer.vue'
s = open(p).read()
old = "onBeforeUnmount(() => window.removeEventListener('keydown', onKey))"
assert old in s
open(p,'w').write(s.replace(old, "// REVIEW-PROBE: removed removeEventListener"))
EOF
$ grep -n "REVIEW-PROBE\|removeEventListener" src/ai/knowledge/components/KFileViewer.vue
70:// REVIEW-PROBE: removed removeEventListener
```
临时在 `KFileViewer.test.ts` 追加一条「卸载后再按 Esc,close 计数不再增长」式用例
(旧判据形态,brief 原判据):
```ts
it('[REVIEW-PROBE-OLD-JUDGE] 卸载后再按 Esc,close 不应再新增', () => {
  const w = mount(KFileViewer, { props: { file: makeFile('a.pdf') } })
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
  expect(w.emitted('close')).toHaveLength(1)
  w.unmount()
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
  expect(w.emitted('close')).toHaveLength(1) // 旧判据:期望不再增长
})
```
```
$ pnpm exec vitest run src/ai/knowledge/components/KFileViewer.test.ts --reporter=verbose 2>&1 | grep REVIEW-PROBE-OLD-JUDGE
 ✓ KFileViewer > N41 Esc 监听 > [REVIEW-PROBE-OLD-JUDGE] 卸载后再按 Esc,close 不应再新增
```
**即便 `removeEventListener` 已被删除(监听器仍挂在 window 上),这条旧判据依然是绿的**
——`wrapper.unmount()` 后 `wrapper.emitted()` 不再追加新事件,是 `@vue/test-utils` 自身
行为,与组件是否真正解绑 DOM 监听器无关。
✅ **独立确认:T4 的判定成立,原判据在本环境下确实零判别力。**

### (2) 替换判据(`removeEventListener` 是否被调用)是否真有牙

沿用上面同一处注入(`removeEventListener` 那一行已删除),跑 T4 正式的判据用例:
```
$ pnpm exec vitest run src/ai/knowledge/components/KFileViewer.test.ts --reporter=verbose 2>&1 | grep -A3 "同一个函数引用注销"
 × KFileViewer > N41 Esc 监听 > 挂载时注册 keydown;按 Esc 发 close;卸载时用同一个函数引用注销(判据:删掉 onBeforeUnmount → 必须报红)
   AssertionError: 未找到 keydown 的 removeEventListener 调用(卸载后监听器仍挂在 window 上)
 Test Files  1 failed (1)
      Tests  1 failed | 20 passed (21)
```
✅ **独立确认:替换判据真报红**,理由信息也准确指出"监听器仍挂在 window 上"这个真实后果
(内存泄漏 / 多实例监听器堆积)。

### (3) 替换判据是否钉住「同一函数引用」

亲读断言代码:
```ts
const removeCall = removeSpy.mock.calls.find((c) => c[0] === 'keydown')
expect(removeCall, '...').toBeDefined()
expect(removeCall![1]).toBe(handler)   // handler 取自 addEventListener 调用时的第二个参数
```
`toBe` 是引用相等(非 `toEqual`),且 `handler` 变量确实来自前面 `addSpy.mock.calls.find(...)[1]`
(同一次挂载捕获的引用)。**做反向探针**:临时把 `onKey` 改成"注册用 `onKey`、注销用一个新建的
匿名函数"(模拟"两处用了不同函数引用"的真 bug):
```
$ python3 - <<'EOF'
p = 'src/ai/knowledge/components/KFileViewer.vue'
s = open(p).read()
old = "onBeforeUnmount(() => window.removeEventListener('keydown', onKey))"
new = "onBeforeUnmount(() => window.removeEventListener('keydown', (e: KeyboardEvent) => { if (e.key === 'Escape') emit('close') }))"
assert old in s
open(p,'w').write(s.replace(old, new))
EOF
$ pnpm exec vitest run src/ai/knowledge/components/KFileViewer.test.ts --reporter=verbose 2>&1 | grep -A2 "同一个函数引用注销"
 × KFileViewer > N41 Esc 监听 > 挂载时注册 keydown;按 Esc 发 close;卸载时用同一个函数引用注销(判据:删掉 onBeforeUnmount → 必须报红)
 Test Files  1 failed (1)
      Tests  1 failed | 20 passed (21)
```
✅ **独立确认:「注册与注销用不同函数引用」这类真 bug 会被 `toBe(handler)` 精确抓到**
(`removeEventListener` 传入不同函数引用在真实浏览器里根本解绑不掉原监听器,是真实内存泄漏 bug)。
**判据确实钉住了"同一引用",不是只断言"调用过"。**

**§3-E 结论:三件事全部独立坐实** —— 原判据零判别力(确认)、替换判据真报红(确认)、
替换判据钉住同一引用而非只钉"调用过"(确认)。**这是 R18 口径下的正确行为,不算流程瑕疵。**

**还原**(§3-E 全部探针,含临时测试文件):
```
$ cp /tmp/p5e-t4-review/KFileViewer.vue.orig src/ai/knowledge/components/KFileViewer.vue
$ md5sum src/ai/knowledge/components/KFileViewer.vue /tmp/p5e-t4-review/KFileViewer.vue.orig
(逐字节一致,两次探针均已核对,略去重复贴)
$ git diff --stat src/ai/knowledge/components/KFileViewer.vue   → (空)
$ git diff --stat src/ai/knowledge/components/KFileViewer.test.ts   → (空,临时用例已手动移除)
$ git status --porcelain   → (空,工作树干净)
```

---

## §3-F 移植保真 + 其余 DoD

1. **逐字对蓝本 `:1-68`**:亲读 `git -C ../../NimoOS-UI show 7a6ee6b7:src/views/AI/Knowledge/components/KFileViewer.vue`
   模板段(`:2-24`)与本仓 `<template>` 逐行比对 —— class/DOM 顺序/属性/文案占位符一致,
   `$emit` → `emit` 是 Composition API 必然改写。✅ **K44 零 `<style>` 块**:
   `grep -c '<style' src/ai/knowledge/components/KFileViewer.vue` → 0。
2. `VIEWER_MAP` 五扩展名 + 大小写不敏感 + fallback 分支:见 T4 报告与 KFileViewer.test.ts,
   逐条读过,`docx`/`wps`→DocViewer,`xls`/`xlsx`/`csv`→ExcelViewer,`A.DOCX` 一条存在。
   fallback 屏 `.k-fileviewer-fallback` 含文案 `aiKbFvUnsupported`("此格式暂不支持在线预览")
   与下载按钮 `aiKbFdDownload`("下载"),`i18n` 键在 `zh_cn.ts`/`en_us.ts` 均存在(已 grep 确认)。
3. `item` computed 形状核对:`{ path: props.file.fullPath, name: props.file.name, is_dir: false }`,
   `grep -n "as any" src/ai/knowledge/components/KFileViewer.vue src/ai/knowledge/components/KFileViewer.test.ts`
   → 零命中。✅
4. **N41 零 stopPropagation/层级管理**:`grep -n "stopPropagation" src/ai/knowledge/components/KFileViewer.vue`
   → 零命中。✅ 只管自己的 keydown 监听。
5. **download emit 契约(蓝本 `:18` 发 `file`)**:亲读组件源码 `emit('download', props.file)`
   ——发的是完整 `props.file`(`FileVM`),不是瘦身后的 `item`。✅ 忠实照抄这个不一致,
   组件注释与测试注释均点明。**未被"统一"成 item。**
6. **mock 边界 + 变异证据**:三条(VIEWER_MAP 映射 / fallback 分支 / Esc 注册注销)均有
   独立变异证据,见 §3-C(部分)/§3-D/§3-E 及下面 §3-G 的 VIEWER_MAP 串位复现。
7. stub 契约形状(`item`/`list` props,`close`/`download` emits):亲读 `KFileViewer.test.ts`
   里的 `vi.mock` 定义,props/emits 与 `DocViewer.vue:9-10`/`ExcelViewer.vue:9-10` 的
   `defineProps`/`defineEmits` 逐字一致。✅

## §3-G 缺口猎 —— VIEWER_MAP 串位变异(独立做,不同于报告贴的"删掉 wps")

```
$ cp src/ai/knowledge/components/KFileViewer.vue /tmp/p5e-t4-review/KFileViewer.vue.orig2
$ sed -i "s/  csv: ExcelViewer,/  csv: DocViewer,/" src/ai/knowledge/components/KFileViewer.vue
$ grep -n "csv:" src/ai/knowledge/components/KFileViewer.vue
44:  csv: DocViewer,
$ pnpm exec vitest run src/ai/knowledge/components/KFileViewer.test.ts --reporter=verbose 2>&1 | grep -A2 "a.csv"
 × KFileViewer — VIEWER_MAP 五个扩展名(§2.4,蓝本 :37-43 / :55-58) > a.csv → data-stub=excel-viewer
 Test Files  1 failed (1)
      Tests  1 failed | 20 passed (21)
$ cp /tmp/p5e-t4-review/KFileViewer.vue.orig2 src/ai/knowledge/components/KFileViewer.vue
$ md5sum src/ai/knowledge/components/KFileViewer.vue /tmp/p5e-t4-review/KFileViewer.vue.orig2
(逐字节一致)
$ git status --porcelain   → (空)
```
✅ **VIEWER_MAP 串位精确报红,仅报红被改动的 `csv` 用例,还原确认。**

## §3-H 21 条用例是否空转 —— 逐条判定

用「删对应生产代码分支还能过」的标准逐条判定(部分已在上面用变异证据坐实):
根节点 class(有牙,§3-A)· VIEWER_MAP 5 条 + 大小写(有牙,证据 1 + §3-G)·
item 形状(独立读断言,`toStrictEqual` 精确形状,若 `item` 误传整个 `file` 会立即报红,
有牙)· fallback 5 条扩展名(有牙,证据 2)· fallback 文案/filename/关闭按钮 3 条
(亲手删 `.k-fileviewer-fallback` 相关渲染验证 —— 见下方独立探针,有牙)·
download 转发 2 条(有牙,§3-A 逻辑本身即防串位)· Esc 1 条(有牙,§3-E)·
K46 自证 2 条(纯静态读文件断言,判别力落在"这两个文件的源码文本"上,亦有牙——
若 `DocViewer.vue` 未来意外加回 `.overlay` 类,这条会报红)。

**fallback 文案/关闭按钮独立探针**(抽验一条,确认非空转):
```
$ cp src/ai/knowledge/components/KFileViewer.vue /tmp/p5e-t4-review/KFileViewer.vue.orig3
$ sed -i "s/@click=\"emit('close')\"><KIcon name=\"x\"/@click=\"undefined\"><KIcon name=\"x\"/" src/ai/knowledge/components/KFileViewer.vue
$ grep -n "k-modal-x" src/ai/knowledge/components/KFileViewer.vue
81:        <button class="k-modal-x" @click="undefined"><KIcon name="x" :size="12" /></button>
$ pnpm exec vitest run src/ai/knowledge/components/KFileViewer.test.ts --reporter=verbose 2>&1 | grep -A2 "关闭按钮"
 × KFileViewer — fallback 分支(§2.4,未知扩展名 → .k-fileviewer-fallback) > fallback 头部关闭按钮(.k-modal-x)点击 → emit close
 Test Files  1 failed (1)
      Tests  1 failed | 20 passed (21)
$ cp /tmp/p5e-t4-review/KFileViewer.vue.orig3 src/ai/knowledge/components/KFileViewer.vue
$ md5sum src/ai/knowledge/components/KFileViewer.vue /tmp/p5e-t4-review/KFileViewer.vue.orig3
(逐字节一致)
$ git status --porcelain → (空)
```
✅ **有牙,非空转。**

**独立追加验证(fallback 文案是否真渲染,非静态默认值)**:
```
$ sed -i "s/{{ t('aiKbFvUnsupported') }}/WRONG-TEXT/" src/ai/knowledge/components/KFileViewer.vue
$ grep -n "WRONG-TEXT" src/ai/knowledge/components/KFileViewer.vue   # 先证落盘
91:        <p>WRONG-TEXT</p>
$ pnpm exec vitest run src/ai/knowledge/components/KFileViewer.test.ts --reporter=verbose 2>&1 | grep -E "×|Tests"
 × fallback 文案:Preview not supported 提示 + Download 按钮均渲染(i18n 键 aiKbFvUnsupported / aiKbFdDownload)
 Tests  1 failed | 20 passed (21)
$ cp /tmp/.../KFileViewer.vue.orig4 src/ai/knowledge/components/KFileViewer.vue
$ md5sum 两文件   → 8aafe1458ee019a5cb15d3faa2b55451(逐字节一致)
$ git status --porcelain   → (空)
```
✅ 有牙,非空转。

**结论:21 条用例逐条至少有一次变异证据或独立判定为有牙的理由,未发现空转用例。**

---

## §4 缺陷清单

### Critical:0

### Important:1

**Imp-1(K46 祖先链缺回归守卫)**:R15-④ 的"祖先链干净"结论目前**只靠一次性人工实测报告担保**,
没有自动化断言钉住"`.knowledge-app`/`.k-main` 自身零 `transform`/`filter`/`will-change`/
`contain`/`perspective`"。独立探针证实:临时给 `.knowledge-app` 主规则块加一行
`transform: translateZ(0);`,`knowledgeStyles.test.ts` **全量仍然绿**(没有一条现有断言
覆盖这个方向)。K46 的全部立论建立在这条祖先链干净之上,而这条链缺乏回归防线 ⇒
将来任何一次给 `.knowledge-app`/`.k-main` 加 `transform`(哪怕是为了做过渡动画这类正当需求)
都会在真机上悄悄让 in-app 预览器塌陷(相对该祖先定位而非铺满视口),而**三门全绿**。
这与 R16/R21 是同一形态的"产品代码对(至少当前对)、守卫为零"缺口,只是这次是"未来会错"
而非"现在就错"。
- 建议归属:不阻塞 T4 关账(K46 立论前提本身要求的是"T4 亲自实测并给出结论",T4 已完整满足
  这个要求;这条 Important 是**新发现的守卫缺口**,性质与 R16/R21 一样该派给某一刀补,
  但 brief 未要求 T4 主动找新缺口,是本次评审的"缺口猎"产出)。
- 建议派给收官刀(T8)或另开小票,理由同 R16 派给 T4 的逻辑:改动小(在
  `knowledgeStyles.test.ts` 加一条断言,判据:临时给 `.knowledge-app`/`.k-main` 加
  `transform`/`filter`/`will-change` → 必须报红),晚补比不补好,但不必阻塞本刀。

### Minor:1

**Minor-1**:T4 报告 §5 提到"用例数 +34 里多出 1 条无法直接归因到本刀 3 个改动文件",
猜测是某个动态扫描器自动派生。**独立复核**:`git diff a5075ea..HEAD -- src/ai/styles/knowledgeStyles.test.ts`
里 `KNOWLEDGE_VUE_FILES` 数组新增 1 行 `'components/KFileViewer.vue'`,该数组被
`it.each(KNOWLEDGE_VUE_FILES)` 消费的 describe 块有 4 个(报告称"4 个既有 describe 块各自多出
1 条"),但报告自己算出的"直接可归因合计"漏加了这一层(21+11+1=33,实际 34)。
**亲自复核**:`it.each(KNOWLEDGE_VUE_FILES)` 每新增一个数组元素,每个消费它的 describe 块
天然多 1 条参数化用例——这**正是**报告归因的"4 个 describe 块各自多出的 1 条"来源,
但报告把这算进了 `knowledgeStyles.test.ts` 的"+11"里(334→345),而 21+11+1=33≠34,
说明报告自己的算术在陈述上有 1 处含糊(它一边说"+11 包含这 4 条"一边又说"多出的 1 条不落在
本刀直接改动的 3 个文件里"——自相矛盾)。**实测复核**:`knowledgeStyles.test.ts` 改动前后
用例数确实是 334→345(+11,即 R16 的 7 条 + KNOWLEDGE_VUE_FILES 新增触发的 4 条参数化用例,
这 11 条本身就已经全部落在 `knowledgeStyles.test.ts` 里,不存在"游离在 3 个文件之外"的第
34 条)。**结论:33 vs 34 的算术差 1 是 T4 报告自己的复核疏漏(把已经算进 +11 的 4 条又单独
拿出来加了一次),不是新缺陷、不影响任何断言正确性,数字本身(334→345、74→75、333/4134)
经我独立全量验证准确。按 Minor 记,建议台账订正措辞,不阻塞关账。**

---

## §5 探针清单(全部完成并还原)

1. ✅ G1(互换 md/doc 消费的 token)—— 报红 2 条,还原 md5 一致
2. ✅ G3(icon 底色换 token)—— 报红 1 条,还原 md5 一致
3. ✅ R21 变异(groupHits 改取最高分)—— 报红 1 条(新用例),还原 md5 一致
4. ✅ removeEventListener 删除(N41 新判据 + 旧判据对照)—— 新判据报红、旧判据验证零判别力,还原 md5 一致
5. ✅ T2 三属性之一(`.k-fileviewer-host` position:fixed → absolute)—— 见 §3-A 第 4 条(记录见下)
6. ✅ VIEWER_MAP 串位(csv → DocViewer)—— 报红 1 条,还原 md5 一致
7. ✅ fallback 关闭按钮空转检测(click handler 拆除)—— 报红 1 条,还原 md5 一致
8. ✅ `.knowledge-app` 加 transform 探针(验证 Important-1 的缺口是否真存在)—— 确认无回归覆盖,已还原

**T2 三属性探针(第 5 项)记录**:
```
$ cp src/ai/styles/knowledge.scss /tmp/p5e-t4-review/knowledge.scss.orig2
$ sed -n '2688p' src/ai/styles/knowledge.scss
    position: fixed;
$ sed -i '2688s/.*/    position: absolute; \/* REVIEW-PROBE *\//' src/ai/styles/knowledge.scss
$ sed -n '2687,2689p' src/ai/styles/knowledge.scss
  .k-fileviewer-host {
    position: absolute; /* REVIEW-PROBE */
    inset: 0;
$ pnpm exec vitest run src/ai/styles/knowledgeStyles.test.ts --reporter=verbose 2>&1 | grep -E "×.*fileviewer-host|Tests"
 × knowledge.scss —— K46 / K47:.k-fileviewer-host 三属性 + 三条 ::v-deep 不搬(P5e-T2 新建) > ... position: fixed 原样保留
 Tests  1 failed | 344 passed (345)
$ cp /tmp/p5e-t4-review/knowledge.scss.orig2 src/ai/styles/knowledge.scss
$ md5sum src/ai/styles/knowledge.scss /tmp/p5e-t4-review/knowledge.scss.orig2
(逐字节一致)
$ git status --porcelain → (空)
```
✅ T2 的三属性断言确实有牙(至少 `position` 这一条独立验证)。

**`.knowledge-app` transform 探针(第 8 项,验证 Important-1)**:
```
$ cp src/ai/styles/knowledge.scss /tmp/p5e-t4-review/knowledge.scss.orig3
$ sed -i '477s/.*/  display: grid;\n  transform: translateZ(0); \/* REVIEW-PROBE-IMPORTANT-1 *\//' src/ai/styles/knowledge.scss
$ sed -n '476,479p' src/ai/styles/knowledge.scss
.knowledge-app {
  display: grid;
  transform: translateZ(0); /* REVIEW-PROBE-IMPORTANT-1 */
  grid-template-columns: 232px 1fr;
$ pnpm test 2>&1 | tail -5
 Test Files  333 passed (333)
      Tests  4134 passed (4134)
```
**全绿,零红项** —— 证实 Important-1 成立:祖先链干净这件事目前没有任何自动化断言看守。
```
$ cp /tmp/p5e-t4-review/knowledge.scss.orig3 src/ai/styles/knowledge.scss
$ md5sum src/ai/styles/knowledge.scss /tmp/p5e-t4-review/knowledge.scss.orig3
(逐字节一致)
$ git status --porcelain → (空)
```

**最终工作树状态**:
```
$ git status --porcelain
(空)
```
全程 `cp` 副本 + 精确定点注入 + 先证落盘 + 跑测试 + `cp` 还原 + `md5sum` 核对,
零 `git checkout/restore/stash`。

---

## §6 结论

**T4 可以关账进 T5。** 0 Critical、1 Important(K46 祖先链缺自动化回归守卫,属新发现的
覆盖缺口而非本刀 DoD 要求项,建议派给收官刀或独立小票,不阻塞)、1 Minor(报告自身
+34 算术表述有 1 处自相矛盾但数字本身准确,建议订正措辞)。R15-④/R16/R21/§3-E 偏离
四项均已独立坐实,三门数字与协调者三处抽验完全吻合。
