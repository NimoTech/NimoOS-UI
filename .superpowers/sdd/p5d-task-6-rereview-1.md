# P5d · T6 修复轮 1 —— 范围收窄复审

复审者:T6 修复轮复审(只读,范围收窄至两条 finding + 修复 diff 本身)。
范围 diff:`review-b89ff60..ec0b3a6.diff`(改动仅 `p5d-task-6-report.md` + `NotesView.test.ts`,+155/-0,纯增量)。

## 0. 前置校验(自己跑,不采信报告)

- `git diff b89ff60..ec0b3a6 -- src/ai/knowledge/views/NotesView.vue` → 空输出。**产品代码零改动确认**。
- 全量三门:`pnpm exec vitest run` → **330 files / 3876 tests 全绿**(exit 0,69.8s);算式 `3874+2=3876` ✓,文件数
  `330` 不变 ✓(只改了既有 `NotesView.test.ts`,无新增测试文件)。唯一 stderr 噪声来自
  `uploads.reattach-persist.test.ts`(与本次改动无关的既有噪声,非本轮引入,测试仍标记通过)。
- `git diff b89ff60..ec0b3a6 -- src/ai/knowledge/views/NotesView.test.ts | grep '^-'` → 零命中(纯增量,**没有删除/削弱任何既有断言**)。

## 1. Finding 1(Important,自动上膛守卫)—— **ADDRESSED**

亲自复现(cp 备份 → md5 证态 → 注入 → 跑 → 复原 → md5 比对,全程未用 `git checkout`):

1. **惰性证明**:`vitest run NotesView.test.ts -t 自动上膛 --reporter=verbose` 在真实仓库状态下(该文件不存在)→
   该用例出现在 `passed` 列表(1ms),不是 `it.skip`/`it.todo`,是真执行的两条 `expect`。
2. **上膛证明**:临时写最小合法 `.vue` 到 `src/ai/knowledge/components/NoteEditPane.vue`(md5 `3848f0bc…`)→
   同一用例报红,信息为 `NoteEditPane.vue 已存在:请在 NotesView.vue 里改成 import ... from '../components/NoteEditPane.vue'`
   ——**具体到怎么改**,可直接执行。`rm` 后复绿,`git status --porcelain -- src/ai/knowledge/components/` 全程为空。
3. **`node:fs`**:确认用 `existsSync`/`readFileSync`(`node:fs`),非 `?raw`/import 断言,符合本档铁律。
4. **两种偏态各试一次**(文件存在 + 分别改 `NotesView.vue`):
   - 只 import 不删占位(留 `kn-edit-pane-stub`,加一行含真 import 路径字符串)→ 报红
     `expected true to be false`(“请删除本地占位组件”)。**caught**。
   - 只删占位不 import(`kn-edit-pane-stub`/`NoteEditPanePlaceholder` 两个标记串都去掉,不加 import)→ 报红
     `expected false to be true`(“请加真 import”)。**caught**。
   两种偏态都被同一条用例的两个独立 `expect` 分别逮到,不会漏判。

收尾:`NotesView.vue` 已用 cp 备份逐字节还原,md5 `b45f5007…` 与改前一致;临时 `NoteEditPane.vue` 已 `rm`;
`git status --porcelain` 干净;`HEAD` 仍 `ec0b3a65c44c60c6a39b959e1708e16a9e038cb5`。

## 2. Finding 2(Minor,K36 a11y)—— **ADDRESSED**

亲自复现:`cp` 备份(md5 `b45f5007…`)→ 把 `<DialogTitle as-child>` 改成 `<DialogTitle>`(md5 变 `b52d7631…`,与报告
自称的注入后哈希逐字一致)→ `vitest run NotesView.test.ts -t K36` → 精确报红
`expected '' to be 'reka-dialog-title-v-0'`(与报告一致)→ 用备份覆盖,md5 复核 `b45f5007…` 一致,`git diff` 空。

**同元素而非只比值**:断言链是 `titleEl = modal.querySelector('.k-modal-title')` → `expect(titleEl.id).toBe(labelId)`
——直接读目标元素的 `id` 属性去比对,而不是搜索"任意元素其 id 等于 labelId"。另加
`expect(modal.querySelectorAll('[id]')).toHaveLength(1)` 排除弹窗内还有别的带 id 元素的可能(挡住"两个同 id 元素也能过"
的退化场景,例如 `as-child` 若像 `VisuallyHidden` 那样多插一个隐藏节点持有生成 id、而 `.k-modal-title` 自己没有 id
时,`titleEl.id` 会是空串,`toBe(labelId)` 直接失败——这正是本次 RED 探针复现的场景)。**判定:确实钉的是"同元素"**。

## 3. 修复 diff 内新引入的破坏

**无**。diff 对 `NotesView.test.ts` 是纯增量(0 行删除),对 `NotesView.vue` 零改动;全量 330 files/3876 tests 绿。

## 4. 范围外观察(不延长本轮)

- `uploads.reattach-persist.test.ts` 的 stderr 噪声(`Cannot read properties of undefined (reading 'getList')`)与本次
  diff 无关,测试本身仍通过,像是既有已知噪声,建议后续任务门提速工作顺带核实是否已登记。
- `node:path`/`node:url` 也各配了一条 `@ts-expect-error`(本仓未装 `@types/node`),与既有 `knowledgeStyles.test.ts`/
  `QueueView.test.ts` 头注释手法一致,未见新问题。
