# SP8-P3b Task 5 评审 —— AddSkillModal.vue

评审者独立复核,不采信实现者报告。工作目录 `/home/nimo/NimoTech/.sp8/NimoOS-New-UI`(分支 `sp8-ai`,提交 `c27e050`,BASE `af1cdc0`)。

## 判定

① 规格合规:✅
② 代码质量:通过

Critical: 0 条
Important: 0 条
Minor: 1 条

## 发现

- **Minor** —— `AddSkillModal.vue` `watch(open)` 里的 `setTimeout(() => nameInputEl.value?.focus(), 0)` 未保存句柄、未在 `onBeforeUnmount` / 下次触发前 `clearTimeout`,与 P1c1 `onBlur` 定时器教训同类模式,但实测不构成功能缺陷(见下「定时器清理」)。建议补 `clearTimeout` 收尾但不阻塞合入。

## 逐项核查结论

**界面 1:1**:逐字段对照 Vue2 `AddSkillModal.vue:1-188`——名称/描述/触发/颜色/SKILL.md/脚本文件六字段顺序、class(`.sk-field` `.sk-field-label` `.sk-field-hint` `.sk-field-optional` `.sk-trig-options` `.sk-trig-option` `.sk-color-row` `.sk-color-dot`)、三个触发选项 name/desc 键(`aiSkTrigOptAuto/Slash` + `aiSkTagManual` 复用「手动」+ 对应 desc 键)、`data-active` 语义、`@keydown.enter.prevent`、SKILL.md 内联 `style="min-height:110px;font-family:var(--font-mono);font-size:12.5px"` 逐字照抄(尺寸/字体非颜色,合规)、底栏两栏(`footerLeft`=保存说明,`footer`=取消/创建)、按钮顺序与文案(`aiCancel`/`aiSkCreating`/`aiSkCreate`)全部一致,未发现结构性走样。

**颜色圆点(偏离1)**:7 个 `.sk-color-dot` 的 `data-color` 值 `[blue,purple,pink,orange,green,teal,slate]` 与 `SkillTile.vue` 具名导出 `SKILL_COLOR_IDS` 顺序逐一比对一致,且与 Vue2 `SkillTile.vue:18-26` `COLORS` 的 key 顺序一致。`grep` 确认 `skills-styles.scss:717-723` 七条 `[data-color=…]` 规则真实存在、id 与 token(`--grad-sk-*`)一一对应。组件模板与测试均 `grep` 确认零内联颜色(`grep -nE '#[0-9a-fA-F]{3,8}|rgba?\(|white|black'` 全仓 `AddSkillModal.vue` 零匹配)。

**`.sk-field-err`**:确认定义在 `sk-shared.scss:169`(非组件内 `<style>`),声明 `margin: 0 0 6px; font-size: 12px; color: var(--danger); line-height: 1.5;` 与先例 `settings-styles.scss:234` `.chan-field-err` 逐字一致。`settingsStyles.test.ts` 的 `sk-shared.scss` describe 块内新增守卫用例断言存在且无裸色。渲染位置:`<p class="sk-field-err" role="alert">` 是 `<SkModal>` 默认插槽的第一个子元素,先于 `.sk-field`(含 `<input>`)——满足「在 input 之前」。

**`SkModal` 向后兼容**:三处既有消费方(`ChannelsSection.vue` 两处、`McpTokensSection.vue` 一处)全部只传 `#footer`,未传 `#footerLeft`。`v-if` 由 `slots.footer` 改为 `slots.footer || slots.footerLeft` —— 三处消费方 `slots.footer` 恒真,条件求值结果不变;`<slot name="footerLeft" />` 未传时不渲染任何节点,`.right` 结构/内容零改动。`SkModal.test.ts` 原有 6 条断言逐字未改(仅在两条既有用例之间插入 2 条新用例,diff 确认无删除行)。**结论:纯增量,向后兼容成立。**

**四条偏离三件套**:
1. `footerLeft` 插槽 —— ①`SkModal.vue` 头注释引 Vue2 `AddSkillModal.vue:96-108` ②报告「偏离 A」显式申报 ③报告注明留待协调者登记台账。齐全。
2. `data-color` 代替内联色 —— ① 组件头注释 + `skills-styles.scss:710-716` 注释均引 Vue2 行号 ② 报告「偏离 1」申报 ③ 同上留待登记。齐全。
3. `validateSkillForm` 本地校验 —— ① 组件头注释引 Vue2 `:173-174` ② 报告「偏离 2」申报,且明确「`valid` 不塞完整校验」③ 留待登记。齐全,且 RED 探针证实生效(见下)。
4. `>1 MiB` 不静默丢弃 —— ① 头注释 + `onFilesPicked` 内联注释均引 Vue2 `:164-167` ② 报告「偏离 3」申报 ③ 留待登记。齐全。

**`valid`(禁用条件)**:`computed(() => name.trim().length>0 && description.trim().length>0)`,逐字对齐 Vue2 `:137-139`,未混入 `validateSkillForm`。完整校验只在 `submit()` 内跑。未违反「禁止把完整校验塞进禁用态」的红线。

**提交 payload**:逐字段核对 Vue2 `:175-184`——`title === name.trim()`、`scripts` 路径 `'scripts/' + f.name`、`examples: []`、`description`/`md` 均 `.trim()`。全部一致。

**定时器清理**:`watch(() => props.open, …)` 里 `setTimeout(() => nameInputEl.value?.focus(), 0)` 确认未保存句柄、无 `onBeforeUnmount` 清理。实测/推理:
- `SkModal.test.ts` 既有断言证明 `open=false` 时 `.sk-modal` 整棵子树(含插槽内容)从 DOM 移除,不是 CSS 隐藏 —— 因此 `nameInputEl`(Vue3 模板 ref)在关闭时会被框架自动置 `null`,且这发生在微任务阶段,早于 `setTimeout(...,0)` 的宏任务执行,`nameInputEl.value?.focus()` 的可选链使其在该场景下必为安全 no-op,不会抛错、不会访问已析构节点。
- 快速开关或宏任务级重挂载场景下,旧的挂起回调最多是对当前(已更新的)输入框重复调用一次 `focus()`,不产生错误行为,也不是 P1c1 那种无界累积的长期泄漏(每次 open 变化只产生一枚一次性、0ms 后即耗尽的定时器)。
- **结论:Minor**——缺少显式清理句柄有悖项目既定纪律,但未构成可复现的功能缺陷或用户可见 bug,不影响合入。建议后续补 `clearTimeout`。

**reka 初始焦点实测**:报告称默认落在 `.sk-x`、需宏任务延迟才能压过 `FocusScope`——用测试套件里的「打开时焦点最终落在名称输入框」用例复核通过(全量跑通),结论采信。

## RED 探针(已还原)

破坏点:`submit()` 内 `const key = validateSkillForm(...)` 临时替换为 `const key = null // RED-PROBE`。

```
❯ src/ai/components/settings/skills/AddSkillModal.test.ts (13 tests | 2 failed)
  × 名称非法(含大写/下划线)→ 行内错误(aiSkErrBadId)且不 emit save(钉住偏离 2)
    AssertionError: expected null not to be null
  × 描述超过 256 个 Unicode 码点 → 行内错误(aiSkErrDescTooLong)且不 emit save
    TypeError: Cannot read properties of null (reading 'textContent')
Tests  2 failed | 11 passed (13)
```

还原后:

```
Test Files  1 passed (1)
     Tests  13 passed (13)
```

`git status` 探测前后均干净。

附带验证:jsdom 环境下实测 `File.prototype.text === undefined`(专门起了一个临时探针测试文件验证,跑完即删,`git status` 干净)——证实报告所称「brief 允许的 mock 分支」成立,测试用假 `FileList` 对象而非真实 `File` 构造合规,不算违规。

## 三门 + 算术核对

自跑全量:`pnpm test` → 296 files (1 flaky) / 2513 tests,唯一失败为 `src/files/upload/persist.test.ts > dropPersisted removes record + blob and frees budget`,单独重跑转绿——与公共约束 §8 点名的既有 IndexedDB flaky 一致,与本任务无关。`color-guard.test.ts` 单跑 167 例;`git ls-tree` 对比 `af1cdc0`(164 个 `.vue`)与 `c27e050`(165 个)确认本任务净增 1 个 `.vue` 文件(`AddSkillModal.vue`;`SkModal.vue` 是修改不是新增),与「每新增一个 `.vue` color-guard +1」的算术规则自洽。未重跑 tsc/build(实现者已跑绿,变更面小,信任但已通过其他手段交叉核实)。

## 未采信/不构成发现的复核项

- `.sk-btn.primary { color: white }`(`sk-shared.scss`)是本任务 diff 之外的既有代码,不在本次 package 范围内,未纳入发现。
- i18n 键(`aiSk*`)均为 T2 已建键,本任务零新增;抽样核对 `zh_cn.ts`/`en_us.ts` 均恰好各出现 1 次(无重复定义),且抽样值与 Vue2 生产语言包(`zh_CN.json`/`en_US.json`)逐字比对一致(`Name`/`Description`/`Trigger`/`Color`/`Manual`/`e.g. invoice-tagger`/`Lowercase, dashes only…` 等)。
