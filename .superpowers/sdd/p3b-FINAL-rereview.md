# SP8-P3b 终审修复轮 — 复审(T10,范围内复审,最后一道)

范围:修复 diff `f6792a8`..`3b108f8`(12 文件),对照 `p3b-FINAL-review.md` 的 8 条 finding。
方法:不采信报告/复核结论,逐条回权威源自读 + 自己动手重做 RED 探针 + 自己动手推导 slugify 边界输入
+ 自己跑三门。**不评审 diff 之外的任何代码。**

---

## 1. C1(Critical)—— slugify-before-validate

**结论:ADDRESSED。**

回源 `NimoOS-AI/service/skills_store.go:17-35`(`slugify`)+ `:221`(`id := slugify(r.Name)`)+
`:91-96`(`ValidateSkillID`)。逐行对比 `src/ai/util/skillsErrorKey.ts:80-93` 的移植版:

```
Go                                          TS
strings.ToLower(strings.TrimSpace(s))   ↔  s.trim().toLowerCase()
for _, r := range s (按 rune)           ↔  for (const ch of s)(按 code point)
[a-z0-9] 保留,dash=false                ↔  同
else: !dash && b.Len()>0 才写 '-'        ↔  else if (!dash && out.length>0) 才写 '-'
strings.Trim(b.String(), "-")           ↔  .replace(/^-+/,'').replace(/-+$/,'')
```

**我自己手推的边界输入**(未采信报告里的推导,独立重算):
- `"invoice   ___---tagger"`(连续 3 种不同分隔符混排)→ 逐字符走:空格触发写一个
  `-`(`dash=true`),后续所有 `_`/`-` 因 `dash` 已真而被跳过,直到 `t` 重置
  `dash=false`→ 结果 `"invoice-tagger"`。**连续分隔符只产生一个 `-`,与实现一致。**
- `"  -invoice-tagger"` → `.trim()` 先吃掉两侧空白但不吃 `-`,剩 `"-invoice-tagger"`;
  第一个字符 `-` 命中 `out.length===0` 分支,**不写、`dash` 也不置真**(Go 侧同理
  `b.Len()==0` 时 if 条件为假,`dash` 保持 false)→ 后续 `invoice` 正常写入 →
  `"invoice-tagger"`。**前导分隔符不产生 dash,且不会因为「跳过写入」误将 dash 状态
  错误置真**(这是我特意验证的边界:if 条件为假时两侧实现都不touch dash 变量)。
- `"invoice-tagger--  "` → trim 掉尾部空白 → 走到两个连续 `-` 只留一个 → 最终
  `Trim("-")`/`replace(/-+$/,'')` 再吃掉那一个 → `"invoice-tagger"`。
- `"!!!___---"` / `"发票标签"` → 全程 `out.length`(`b.Len()`)恒为 0,永不进入写
  `-` 分支 → 空串 → `SKILL_ID_RE` 要求至少 1 个 `[a-z0-9]` 字符,空串必被拒 →
  `aiSkErrBadId`,与后端 `ValidateSkillID("")` 拒绝一致。
- `"123 skill"` → 数字按 `[0-9]` 保留 → `"123-skill"`,`skillIDRe` 首字符允许数字
  (源码注释 `:82-85` 明written 就是为了这个场景)→ 通过。

**结论:移植逐行等价,零偏差。** 4 条改判 `null` 的用例 + `AddSkillModal.test.ts` 里
`'Invoice_Tagger'` 那 1 条,经我独立回源验算,**改后断言值全部正确**(逐一手算过,见上);
且都补了真·非法用例(纯符号 / 纯中文 slug 为空)。`AddSkillModal.vue:165-166` 确认
`name/title` 提交用的是 `name.value.trim()`,不是 slugify 后的值 —— 与新增用例
`toMatchObject({ name: 'Invoice_Tagger', title: 'Invoice_Tagger' })` 一致,前端不改写用户输入。

## 2. I1(Important)—— D4 弹窗 X/Esc/遮罩不清 `pendingTryId`

**结论:ADDRESSED。** 我自己重做 RED 探针(不采信报告里的探针记录):把
`onTryModalOpenChange` 里的 `if (!v) pendingTryId.value = null` 删掉,跑
`SkillDetail.test.ts`:

```
FAIL  D4:用 .sk-x 关闭弹窗(不是取消按钮)后清挂号——之后手动开关启用该技能不应触发 push
Tests  1 failed | 48 passed (49)
```

精确命中目标用例,其余 48 例不受影响。`md5sum` 还原前后一致(`969bd15...`),`git status` 干净。

## 3. I2(Important)—— 空 content 的 error 事件被渲染成成功

**结论:ADDRESSED。** 自己重做 RED 探针:把 `reduceSandboxEvent` 的 `error` 分支改回
只写 `error`(不写 `failed`),跑 `sandboxRun.test.ts` + `TestPanel.test.ts`:

```
FAIL  sandboxRun.test.ts > error event writes error and sets failed
FAIL  sandboxRun.test.ts > error event with no content ... but still sets failed (P3b 终审 I2)
FAIL  TestPanel.test.ts > SSE error 事件原样显示后端人类可读文本
FAIL  TestPanel.test.ts > 失败时不 emit(test)(钉住偏离 D5)
FAIL  TestPanel.test.ts > error 事件 content 为空串时仍判定为失败(不是成功),且不 emit(test)
Tests  5 failed | 28 passed (33)
```

与报告claim的 5 条精确一致(含两条既有 D2/D5 用例,证明它们本身确实依赖这一行,不是空转)。
`md5sum` 还原前后一致(`c5e520d...`)。

**`SandboxState` 消费点排查**(`grep SandboxState / sandbox.error / sandbox.failed`):
唯一消费方是 `TestPanel.vue`(`sandboxRun.ts` 自身定义类型)。三处模板 `v-if`
(示例区/成功态/失败态)与 `run()` 里的 `emit('test')` 判据、`onError` 的传输层失败分支,
**全部**已同步改判 `.failed`,无遗漏分支。仅 `TestPanel.vue:17,22` 头注释里两句旧文字仍写
「`!sandbox.error`」/「`sandbox.error`」—— 这是**描述历史设计意图的说明性文字**,不是代码,
不构成遗漏(但读起来与当前实现的判据不完全对应,是文档层面的小瑕疵,不阻断)。

## 4. M1 —— 注释里的 Vue2 rgba 字面量

**结论:ADDRESSED。** `skills-styles.scss` 与 `TestPanel.vue` 两处头注释均已改写成
「一圈约 18% 不透明度的 iOS 红发光圈(字面量写死的 rgba,颜色即 --danger token 现在的
色值)」—— 不再出现具体数字字面量 `rgba(255,59,48,0.18)`。已 grep 全 diff 确认无残留。

## 5. M2 —— 用例标题承诺的断言已补

**结论:ADDRESSED。** 新增 3 行:重新打开菜单 → 在 `.sk-menu button` 上 dispatch
`mousedown` → 断言菜单仍在。已读 `useClickOutside.ts:19-22` 确认判定逻辑是
`el.contains(event.target)`,`.sk-menu` 是 `menuWrap` 子元素,该用例有真实判别力
(若把 `contains` 改错会报红),非空转。

## 6. M3 —— 裸 `emit('test')` 缺 `{id}`

**结论:ADDRESSED(以申报方式处置,按 finding 要求的判定标准核验)。**
`TestPanel.vue:68-77` 的申报注释写清了:① 无害前提 = `SkillDetail.vue:447`
`:key="skill.id"` 强制单实例,`activeId` 恒等于当前 `skill.id`,且 Vue3 对已卸载实例的
`emit` 是 no-op;② 前提失效条件 = 「若 `SkillDetail`/`SkillsSection` 未来不再靠 `:key`
强制单实例」,并明确指出失效后应改回 `emit('test', {id})`。两项均写清,符合 finding 的
判定要求。

## 7. M4 —— 路径注释 `/v2/ai/skills` → `/v1/ai/skills`

**结论:ADDRESSED。** 自己 grep 后端确认:`NimoOS-AI/common/constants.go:23`
`V2APIPath = "/v1/ai"`,`route/v2.go:88` `g := e.Group(common.V2APIPath)`,
`route/v2.go:208-215` 九条 skills 路由挂在这个 group 下 —— 真实前缀确实是
`/v1/ai/skills`,"v2" 只是 handler 世代命名,不是 URL 版本号。`types/skill.ts` 三处
注释已全部改对。

## 8. M5 —— `onToggle` 的 `updated` 为假时不再弹假成功 toast

**结论:ADDRESSED(代码),但无新增专项用例覆盖这条 else 分支。**
`SkillsSection.vue:174-177` 确认改成:`idx !== -1 && updated` 为真才弹成功 toast,否则
走 `aiSkUpdateFailed` danger toast。**本轮 diff 未改动 `SkillsSection.test.ts`**——没有一条
用例让 `updateSkill` resolve 出假值(`undefined`/`null`)来命中这条新 else 分支,
是本轮唯一"改了行为但没配套 RED/新断言"的一处。风险很低(现网 PATCH 恒返 200 裸 skill,
分支本就几乎不会触发;既有测试全绿,未被此改动破坏),但严格说该分支目前**零测试直接命中**,
建议留一句台账记录(非阻断项)。

---

## 9. 修复 diff 内是否有新破坏(削弱/删除既有断言)

逐个文件看了 diff 里的每一处删除行:

- `skillsErrorKey.test.ts`:删除的 4 条断言全部是 C1 已批准例外(把「钉死错误行为」改判为
  「钉死正确行为」),经我独立手推 slugify 验证改后值全部正确,不是掩盖真实缺陷。
- `AddSkillModal.test.ts`:1 条同模具,同一豁免,已验证 `name`/`title` 提交值不受影响。
- 其余 9 个文件(`SkillDetail.vue/test.ts`、`TestPanel.vue/test.ts`、`SkillsSection.vue`、
  `sandboxRun.ts/test.ts`、`skills-styles.scss`、`types/skill.ts`)**没有删除任何既有断言**,
  只有新增断言 / 改判据(`.error`→`.failed`,均为 I2 修复的同步改动,行为收敛不是放宽)/
  改注释文案。

**判定:无新破坏。** 唯一的断言值改动全部落在已批准的 C1 豁免范围内。

---

## 10. 我自己实测的三门

| 门 | 结果 |
|---|---|
| `pnpm test`(全量,输出落盘) | **296 files passed (296) / 2571 tests passed (2571)**,零红(本次运行未复现台账登记的 `persist.test.ts` IndexedDB flaky,该项本身是已知间歇性噪声,不属于本期) |
| `pnpm exec vue-tsc --noEmit` | exit 0,无输出 |
| `pnpm build` | exit 0,仅既有 >500KB chunk 警告,无新增警告/报错 |

与修复报告宣称的「296/296、2571/2571、tsc 0、build ✓」完全一致,已独立复核。

---

## 11. 总判定

**8 条 finding 全部 ADDRESSED**(C1/I1/I2 三条主线均已用我自己独立重推的证据核验;
5 条 minor 逐条核对代码改动落点均对应问题描述)。修复 diff 内**无新破坏**,唯一的既有
断言值改动全部落在 C1 已批准豁免范围。三门实测与报告宣称完全一致。

唯一非阻断的残留:**M5 的新 else 分支目前没有专项测试直接命中**(建议补一条台账记录,
不建议因此打回)。

**结论:可合并。** 不需要再开一轮评审。
