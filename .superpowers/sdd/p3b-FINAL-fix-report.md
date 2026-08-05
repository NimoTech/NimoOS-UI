# SP8-P3b 终审修复报告(单轮修完 1 Critical + 2 Important + 5 Minor)

起点 `f6792a8`。逐条处置如下。

---

## C1(Critical)—— 前端校验比后端严,把合法名字堵死了

**文件**:`src/ai/util/skillsErrorKey.ts`、`src/ai/util/skillsErrorKey.test.ts`、
`src/ai/components/settings/skills/AddSkillModal.test.ts`。

移植了一份 `slugify`(导出),逐行对齐后端 `NimoOS-AI/service/skills_store.go:17-35`:
转小写+去首尾空格 → 逐 code point 扫描,`[a-z0-9]` 保留、其余折叠成单个 `-`
(`dash` 标志防连续分隔符,`out.length > 0` 对应 Go 的 `b.Len() > 0`,防前导分隔符产生
`-`)→ 最后 trim 掉首尾 `-`。`validateSkillForm` 改成校验 `slugify(name)` 而非原始
`name`。空 slug(名字全是非法字符,如纯中文)自然不满足 `SKILL_ID_RE`(至少需要
1 个 `[a-z0-9]`),仍落回 `aiSkErrBadId`,与后端 `ValidateSkillID('')` 拒绝一致。

**改前/改后原文(`skillsErrorKey.test.ts`,四条被钉死的错误断言)**:

改前:
```ts
it('rejects uppercase letters in the name', () => {
  expect(validateSkillForm('Invoice-Tagger', 'a valid description')).toBe('aiSkErrBadId')
})
it('rejects underscores in the name', () => {
  expect(validateSkillForm('invoice_tagger', 'a valid description')).toBe('aiSkErrBadId')
})
it('rejects a name starting with a dash', () => {
  expect(validateSkillForm('-invoice-tagger', 'a valid description')).toBe('aiSkErrBadId')
})
it('rejects a name ending with a dash', () => {
  expect(validateSkillForm('invoice-tagger-', 'a valid description')).toBe('aiSkErrBadId')
})
```

改后(四条改判 `null`,外加 1 条新增 "空格+大小写混合" 场景 + 2 条真·非法用例):
```ts
it('accepts uppercase letters in the name (backend slugifies before validating)', () => {
  expect(validateSkillForm('Invoice-Tagger', 'a valid description')).toBe(null)
})
it('accepts underscores in the name (slugify folds them into a single dash)', () => {
  expect(validateSkillForm('invoice_tagger', 'a valid description')).toBe(null)
})
it('accepts a name starting with a dash (leading separator is dropped, not written)', () => {
  expect(validateSkillForm('-invoice-tagger', 'a valid description')).toBe(null)
})
it('accepts a name ending with a dash (trailing separator is trimmed by slugify)', () => {
  expect(validateSkillForm('invoice-tagger-', 'a valid description')).toBe(null)
})
it('accepts a name with spaces and mixed case (realistic UI input, e.g. "Invoice Tagger")', () => {
  expect(validateSkillForm('Invoice Tagger', 'a valid description')).toBe(null)
})
it('rejects a name made entirely of non-alphanumeric characters (slugifies to an empty string)', () => {
  expect(validateSkillForm('!!!___---', 'a valid description')).toBe('aiSkErrBadId')
})
it('rejects a name that is pure Chinese characters (slugifies to an empty string, no [a-z0-9] survives)', () => {
  expect(validateSkillForm('发票标签', 'a valid description')).toBe('aiSkErrBadId')
})
```
另加一个 `describe('slugify', …)` 块,11 条用例直接钉住移植函数本身(空格/下划线/大写/
连续多分隔符/前导分隔符丢弃/尾随分隔符裁剪/纯符号空串/纯中文空串/全空白空串/
digit-leading 输入)。

**跑测中意外发现同一缺陷模具的第二处**:`AddSkillModal.test.ts` 里有一条独立用例
把 `'Invoice_Tagger'` 当"非法名字"例子(与 `skillsErrorKey.test.ts` 那四条是同一个
错误,只是换了个消费点)。同样改法:换成真非法输入(纯中文),并新增一条正例钉住
`'Invoice_Tagger'` 现在能正常 `emit('save')`(payload 里 `name`/`title` 仍是原始
trimmed 输入,前端不改写用户输入,后端自己再 slugify 一次生成 id)。

**RED 验证**:把 `validateSkillForm` 改回测原始 `name.trim()`(不经 slugify)→
`skillsErrorKey.test.ts` 5 条 + `AddSkillModal.test.ts` 1 条,共 **6 条精确报红**:
```
FAIL  skillsErrorKey.test.ts > validateSkillForm > accepts uppercase letters in the name (backend slugifies before validating)
FAIL  skillsErrorKey.test.ts > validateSkillForm > accepts underscores in the name (slugify folds them into a single dash)
FAIL  skillsErrorKey.test.ts > validateSkillForm > accepts a name starting with a dash (leading separator is dropped, not written)
FAIL  skillsErrorKey.test.ts > validateSkillForm > accepts a name ending with a dash (trailing separator is trimmed by slugify)
FAIL  skillsErrorKey.test.ts > validateSkillForm > accepts a name with spaces and mixed case (realistic UI input, e.g. "Invoice Tagger")
FAIL  AddSkillModal.test.ts > AddSkillModal > 名称含大写/下划线但 slugify 后合法(如 "Invoice_Tagger")→ 校验通过、正常 emit save
Test Files  2 failed (2)
     Tests  6 failed | 55 passed (61)
```
还原后 `md5sum` 与还原前一致,`git status` 干净。**处置:fixed。**

---

## I1(Important)—— D4 弹窗 X/Esc/遮罩关闭不清 `pendingTryId`

**文件**:`src/ai/components/settings/skills/SkillDetail.vue`、`SkillDetail.test.ts`。

新增统一 handler `onTryModalOpenChange(v)`:置 `tryModalOpen`,`!v` 时同时清
`pendingTryId`。`SkModal` 的 `@update:open` 改接这个 handler(原来是
`tryModalOpen = $event`,只管可见性)。`cancelTryModal()` 收敛为调用
`onTryModalOpenChange(false)`,不再重复维护一份清理逻辑。

补测:`D4:用 .sk-x 关闭弹窗(不是取消按钮)后清挂号——之后手动开关启用该技能不应
触发 push`——挂号(点「启用并试用」)→ 用 `.sk-x` 关窗(不是取消)→ 之后
`setProps({ enabled: true })`(模拟用户自己用顶部条开关)→ 断言 `push` 未被调用。

**RED 验证**:把 `onTryModalOpenChange` 里 `if (!v) pendingTryId.value = null` 删掉 →
```
FAIL  SkillDetail.test.ts > D4:用 .sk-x 关闭弹窗(不是取消按钮)后清挂号——之后手动开关启用该技能不应触发 push
Test Files  1 failed (1)
     Tests  1 failed | 48 passed (49)
```
精确 1 例报红,其余 48 例不受影响。还原后 `md5sum` 与还原前一致。**处置:fixed。**

---

## I2(Important)—— 空内容的 error 事件被渲染成「成功」

**文件**:`src/ai/util/sandboxRun.ts`、`sandboxRun.test.ts`、
`src/ai/components/settings/skills/TestPanel.vue`、`TestPanel.test.ts`。

`SandboxState` 新增 `failed: boolean`;`reduceSandboxEvent` 的 `error` 分支无条件
置 `failed: true`(与 `content` 是否为空解耦)。`TestPanel.vue`:
- 成功/失败两个结果面板的 `v-if` 从判 `sandbox.error`/`!sandbox.error` 改判
  `sandbox.failed`/`!sandbox.failed`;示例区可见性条件同样改判 `!sandbox.failed`。
- 失败正文改成 `{{ sandbox.error || t('aiSkTestFailed') }}`——空 content 时显示既有
  兜底键(未新增键)。
- `onError`(传输层失败)同步写 `failed: true`。
- `run()` 里 `emit('test')` 的成功判据从 `!sandbox.value.error` 改成
  `!sandbox.value.failed`。

补测:`error 事件 content 为空串时仍判定为失败(不是成功),且不 emit(test)`——喂
`{type:'error', content:''}` + `{type:'done'}`,断言失败态 label 存在、正文不含成功
文案「沙箱已关闭」、`emit('test')` 未触发。

**RED 验证**:把 `reduceSandboxEvent` 的 `error` 分支改回不写 `failed`(只写
`error`)→
```
FAIL  sandboxRun.test.ts > sandboxRun > error event writes error and sets failed
FAIL  sandboxRun.test.ts > sandboxRun > error event with no content writes empty string, not "null"/"undefined" — but still sets failed (P3b 终审 I2)
FAIL  TestPanel.test.ts > TestPanel > SSE error 事件原样显示后端人类可读文本
FAIL  TestPanel.test.ts > TestPanel > 失败时不 emit(test)(钉住偏离 D5)
FAIL  TestPanel.test.ts > TestPanel > error 事件 content 为空串时仍判定为失败(不是成功),且不 emit(test)(钉住 P3b 终审 I2)
Test Files  2 failed (2)
     Tests  5 failed | 28 passed (33)
```
5 条精确报红(含既有的两条 D2/D5 用例,证明它们本身就依赖这一行,不是空转)。
还原后 `md5sum` 与还原前一致。**处置:fixed。**

---

## Minor

- **M1**(`skills-styles.scss:517` 附近 + `TestPanel.vue` 头注释)—— 两处「Vue2 原样
  rgba(255,59,48,0.18) 字面量」的注释改写成「引 Vue2 `file:line` + 中文描述颜色(约
  18% 不透明度的 iOS 红发光圈,颜色即当前 --danger token 色值)」,不再在注释里出现
  原始色字面量。**处置:fixed。**
- **M2**(`SkillDetail.test.ts:316` 附近)—— 用例标题承诺「菜单内部点击不触发外部
  关闭逻辑」但零断言。补 3 行:重新打开菜单 → 在 `.sk-menu button` 上 dispatch
  `mousedown` → 断言菜单仍在(`useClickOutside` 用 `el.contains(target)` 判定,
  `.sk-menu` 是 `menuWrap` 子元素,理应判定为"在内部")。**处置:fixed。**
- **M3**(`TestPanel.vue` 裸 `emit('test')` 缺 `{id}`)—— 选择"显式申报,不改回带
  id"。在 `defineEmits` 上方补充申报注释:说明设计 §6/Vue2 都带 id,本仓落成裸
  emit 是未申报偏离,终审已指出;当前无害的依据(`:key="skill.id"` 强制单实例 +
  `activeId` 恒等 + Vue3 emit 对已卸载实例是 no-op);并注明若挂载方式未来变化
  (不再靠 `:key` 强制单实例),该假设失效,应改回带 `{id}`。**处置:说明(补交
  申报,保持行为不变)。**
- **M4**(`types/skill.ts:44,48` 路径注释)—— 三处 `/v2/ai/skills` 改成
  `/v1/ai/skills`(已 grep 后端 `route/v2.go:88` + `common/constants.go:23`
  `V2APIPath = "/v1/ai"` 确认真实前缀;"v2" 指的是 handler 代码世代/包名,不是 URL
  版本号)。**处置:fixed。**
- **M5**(`SkillsSection.vue` `onToggle`)—— `idx !== -1 && updated` 为假时,原来仍
  弹成功 toast、列表不更新。改成:真的替换了列表项才弹成功 toast;否则走
  `aiSkUpdateFailed` danger toast(复用既有键,与 catch 分支同一条文案)。**处置:
  fixed。**

---

## 三门完整终值

```
pnpm test                  exit=0   Test Files  296 passed (296)   Tests  2571 passed (2571)
pnpm exec vue-tsc --noEmit exit=0   (无输出)
pnpm build                 exit=0   ✓ built in 11.99s(仅既有 >500KB chunk 警告)
```
全量原始输出落盘:`/tmp/p3b-final-test.log` / `/tmp/p3b-final-tsc.log` /
`/tmp/p3b-final-build.log`(未 `| tail`)。

基线 296 文件 / 2554 例(终审文档记录值)→ 本轮 296 文件 / 2571 例:文件数不变
(未新增 `.vue`,color-guard 用例数不受影响);新增 17 例 = C1(11 条 slugify 直测 +
5 条 validateSkillForm 改动/新增,net +7 相对旧的 4 条错误用例)+ AddSkillModal 1 条
+ I1 1 条 + I2 1 条 + M2 0 条(在已有 it 内追加断言,未新增 it)+ 其余 minor 无新增
用例,合计净增与实际改动一致。

## 未削弱/未删除既有断言声明

除 C1 指名的那 4 条(+ 意外发现的 `AddSkillModal.test.ts` 那 1 条,同一缺陷模具,
按同一豁免处理)从"钉死错误行为"改判为"钉死正确行为"外,本轮**没有修改任何其他
既有断言的判定值**,只新增断言/新增用例/改注释文案。

## 偏离声明汇总(本轮新增)

- M3:显式声明"裸 `emit('test')`,不带 `{id}`"为已知偏离,理由与失效条件已写进
  `TestPanel.vue` 代码注释。
