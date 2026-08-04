# P5d · T4 独立评审 —— tiptap 依赖 + `NotesMarkdownEditor.vue`

评审范围:`d144cf6..8897d5e`(HEAD `8897d5e`,评审全程零改动落盘,`git status` 始终干净、HEAD 未变)。
本刀全部断言均由评审自己复跑取得,不采信实现者报告的任何数字/结论。

## 两个独立判定

- **① 规格符合(§T4 DoD 1–7):✅ 全部符合。**
- **② 任务质量:✅ 通过**(附一条 Important,详见下)。

## 🔴 第一必查项 —— 判据被替换,三条结论

1. **「spy `commands.setContent` 真的走不通」**:对**报告描述的具体写法**(`vi.spyOn(ed.commands, 'setContent')`)——**属实**。我自建探针复现:`ed.commands` 每次访问都是 getter 现造的新绑定对象,spy 到的是那一次访问的快照,watch 内部 `editor.value.commands.setContent(v)` 重新取到另一个对象,spy 恒记 **0 次**(同值/异值两种场景都是 0),是假阴性。**但**我另外验证了一条**未被报告尝试**的替代技术:在挂载后立刻用 `Object.defineProperty(ed, 'commands', {value: <Proxy 包一层计数>, configurable: true})` 在**实例**上遮蔽原型 getter——这条**可行**(同值回写计数 0、异值回写计数 1,判别力正确)。→ **报 Important**:「spy 走不通」这一具体诊断是真实的,但报告将其上升为"spy 路线整体不可行"的措辞不够周全,存在一条更迂回但确实可行的 spy 变体未被穷举。**不升级为 Critical**,因为最终选用的 doc 引用同一性方案经我独立变异验证判别力等价且更贴近行为语义(见下)。
2. **替代判据拿掉比对后必须报红**:✅ **确认**。我自己 cp 备份 → 把 `v !== editor.value.storage.markdown.getMarkdown()` 替换成 `true /* MUTATED-OUT */` → 用例在 `expect(ed.state.doc).toBe(docBeforeEcho)` 精确报红,且复现了报告提到的 `"morestart"` vs `" morestart"` 前导空格丢失现象。还原后 md5 与备份逐字节一致。
3. **连续跑 ≥5 次是否稳定**:✅ **确认稳定**。本机连续跑 **10 次**(非仅 5 次),`NotesMarkdownEditor.test.ts` 每次都是 **8/8 通过**,零 flaky,佐证放弃 transaction 计数法(报告称约 1/5 概率假阳性)的判断是合理的。

## 🔴 两个 emit 各自的变异结果(自己跑的)

- 注掉 `emit('input', md)` → 用例「两个 emit 各有一条」在 `inputEmits` 断言处报红(`expected undefined to be truthy`)。
- 注掉 `emit('update:modelValue', md)` → 同一用例改在 `updateEmits` 断言处报红。
- 两次均 cp 备份 → md5 还原逐字节一致,`git status` 干净。

## 代码膨胀判定(74 行对蓝本 47 行)

**判定:干净,无违纪。** 逐行核对:蓝本 47 行里 8 行是 `<style>` 块(K44 已合规移除,-8);Vue2 Options API → Vue3 `<script setup>` 语法本身的样板(`defineProps`/`defineEmits` 类型声明、`ref()`、`onMounted`/`onBeforeUnmount` 包裹)是等价迁移,非新逻辑;新增约 20 行是 K37/K38/K44/§5.3 申报注释(brief 明确允许)。未发现蓝本没有的新逻辑、被"修正"的行为或顺手抽的抽象。`onUpdate` 里改用局部 `const md = ed.storage.markdown.getMarkdown()` 只读一次再分别 emit 两次,是 K38 双 emit 的必然写法,非额外重构。

## 逐条核验(其余检查项)

- **装包**:`pnpm list` 现查 `@tiptap/pm@2.27.2` / `@tiptap/starter-kit@2.27.2` / `@tiptap/vue-3@2.27.2` / `tiptap-markdown@0.8.10`,与裁定 R2 终值一致。`package.json` diff **只有 4 行新增**(自己核对 diff,`dependencies` 其余一字未动)。未装 `@tiptap/core`(仅在 `pnpm-lock.yaml` 里以 peer/传递依赖出现)、`extension-highlight`、`extension-typography`(全仓 grep 零命中)。`vite.config.ts` 的 `optimizeDeps.exclude: ['@nimotech/nimoos-service']` 未被动。
- **K38**:`@tiptap/vue-3` · `onBeforeUnmount`(非 `beforeDestroy`)· `modelValue`/`update:modelValue` 且保留 `input`,均现读代码确认;两个 emit 变异证据见上。
- **`onTransaction`/`ready` 顺序**:现读代码,`onMounted` 内建 Editor → `editor.value = ed` → `emit('ready', ed)`,与蓝本顺序一致;`onTransaction` 变异测试(注掉该行)确认用例报红(`txEmits` 断言 `expected undefined to be truthy`)。裁定 R5 相关注释准确(未引 §D.6.1 当已证 N29,且本组件确实与 N29 无关,N29 归 T7)。
- **K44**:`.vue` 全文零 `<style>` 块(现读确认),且现 grep `KnowledgeLayout.vue:43` 确认 `import '../../styles/knowledge.scss'` 早已全局挂载,报告的"不需要 side-effect import"解释成立。往文件末尾追加 `<style>.mutated{...}</style>` 的变异测试确认该断言真报红。
- **颜色硬约束**:现 grep `.vue` 文件零 `#hex`/`rgb()`/`rgba()`/`white`/`black` 字面量(含注释)。模板裸色变异测试(在 `<div class="nme">` 注入 `style="color: #fff"`)确认「缺口③」定向断言真报红。
- **`knowledgeStyles.test.ts` 改动**:`git diff` 确认**只有 +1 行**(`'components/NotesMarkdownEditor.vue'` 加入 `KNOWLEDGE_VUE_FILES` 数组),无其它改动,守卫本身未被放宽。
- **算式**:`pnpm test` 现跑 `Test Files 329 passed / Tests 3606 passed`;`find src -name '*.vue' -not -name '*.test.ts'` 现数 **180**;三项与报告算式一致。`vue-tsc --noEmit` exit 0,`vite build` exit 0(现跑三门全部现场复核,非采信)。
- **dev server**:`ss -ltnp | grep 5288` 现查,`LISTEN *:5288 pid=788096`,与报告贴的 pid 一致(现查非采信 pid);`:5277`(pid 15948)与 `:5299`(pid 299874)均未变,未被触碰。

## 缺口猎

复查全部 8 条用例,**未发现空壳断言**——「挂载渲染」「ready payload」「两个 emit」「防回环」「transaction」「destroy 恰好一次」「零 style」「模板零裸色」均已被我逐条变异测试验证有判别力(含未在报告里单独提及的 `destroy` 一条:注掉 `editor.value.destroy()` 调用后,用例在 `expect(spy).toHaveBeenCalledTimes(1)` 报红,`0 times` vs 期望 `1 times`)。报告里两处"dead-end"说明(spy 假阴性、transaction 计数 flaky)与我的独立复现一致(spy 恒 0 次;transaction 计数法未逐一复现但报告的机制解释——jsdom 下 selection/focus 事件派发无关 transaction——合理,且已用 10 次连跑证明最终方案无此问题)。

## 发现

- **Important**:`p5d-task-4-report.md`(§5.3 踩坑记录①)将 `vi.spyOn(ed.commands, 'setContent')` 失败的结论表述为"这个写法"不可行,但未穷举更迂回的 instance-property 遮蔽写法(该写法经评审验证可行)。不影响最终交付质量(替代判据经变异验证有效),仅为诊断完整性问题,建议报告措辞收窄为"该具体写法不可行"而非隐含"spy 路线不可行"。

## ⚠️ 无法核验项

- 未逐一复现"transaction 计数法约 1/5 概率 flaky"这一具体数字(报告称已放弃该方案,现存代码不含该方案,无法反向复现频率;已用 10 次连跑最终方案验证其无此问题作为间接佐证)。
- 全仓 `color-guard.test.ts` 对新增 `.vue` 自动 +1 例、`knowledgeStyles.test.ts` 两个 `it.each` 各 +1 例(合计报告称的 11 = 8+2+1)未逐项拆分复核每一个具体断言 ID,只复核了总数(3606)与 `knowledgeStyles.test.ts` 的 diff(+1 行)、`.vue` 总数(180)三项一致,间接印证拆分合理。
