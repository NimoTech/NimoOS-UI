# P5d · Task 9 报告 —— 票 1 导航入口 + 票 2 注释债 + K36 a11y 常驻断言

坐标:分支 `sp8-ai`,起点 `71eab1f`,本刀改 5 个文件(§1.1 显式解禁例外),零新建,
331 文件 / 182 `.vue` 不变。

## §T9 1-7 条逐条兑现

1. `SettingsPage.vue`:`<button @click="onDetailsClick">` → `<router-link to="/ai/knowledge">`,
   内容物 `{{ t('aiCfgDetails') }} <AgentIcon name="chev" :size="12" />` 一字不动
   (文案键仍 `aiCfgDetails`,图标仍 `AgentIcon`)。
2. `.set-detail-link` 类名/视觉零改动;`settings-styles.scss` 全文件 0 diff(见下方自证)。
3. `onDetailsClick` 已删,原文整段留成注释(位置见下方「原文留成注释的位置」)。
4. `SettingsPage.test.ts:239` 那条改成断言 `.set-detail-link` 是 `to="/ai/knowledge"` 的
   `RouterLink`;RED 探针两段输出见下。
5. `SettingsPage.vue:26-29` 注释订正为「历史记录 + 现状」两段,引「治理 §15.1 / P5c §8.5」,
   零 file:line(本仓)引用。
6. 3 处过期注释(`ParserStatus.test.ts` / `ParserTest.test.ts` / `SettingsView.test.ts`)
   均改成引条目编号,不引行号;仅改注释行,非注释行 0 改动(见下方自证)。
7. `SettingsView.test.ts` 补 3 行 K36 a11y 断言(元素身份 + `[id]` 计数=1),
   变异证据见下方。

## 逐文件「其余一字未动」自证

**`src/ai/views/SettingsPage.vue`**(3 处改动,均在授权范围内):
- header 注释 `:26-29` 替换成两段「历史/现状」——`-` 的 4 行是旧的单段过期说明
  (说 `/ai/knowledge` 要到 SP8-P5 才存在,已不成立),理由已在条目 5 说明。
- `onDetailsClick` 函数体(3 行)删除 → 理由:治理 §15.1 第 3 条明确裁定「删掉 handler,
  原文留成注释」,原文完整保留在紧邻的新注释里(逐字未丢一行)。
- 模板注释 2 行 + `<button ...>`/`</button>` 2 行删除 → 替换成新注释 6 行 +
  `<router-link ...>`/`</router-link>`,理由已在条目 1/2 说明。
- **其余全文件字节级未动**(其它 D1-D3、SECTION_COMPONENTS、goBack、onRefresh 等区块
  未出现在 diff 里)。

**`src/ai/views/SettingsPage.test.ts`**:
- import 行加 `RouterLink`(1 处增量,无删除)。
- 用例「8.」整体替换:`-` 的 11 行是旧版占位契约断言体(mount 后 spy router.push/toast.show、
  trigger click、断言 toast 文案),已作为「改前原文」逐字保留在新增注释里,零丢失。
  理由:治理 §15.1 第 4 条要求这条必须改(旧断言与反转后的行为矛盾)。
- 其余 30 条既有用例(1-7、9-31)未出现在 diff 里。

**`src/ai/knowledge/parser/ParserStatus.test.ts`**:仅 `:206` 一行删除、替换成 6 行订正注释
(只在注释块内,`-` 的那 1 行是过期结论,替换理由=双重过期,见条目 6)。非注释行改动 0。

**`src/ai/knowledge/parser/ParserTest.test.ts`**:仅 `:180` 一行删除、替换成 5 行订正注释。
非注释行改动 0。

**`src/ai/knowledge/views/SettingsView.test.ts`**:
- `:212-213` 两行删除、替换成 1 行订正注释(净 -1 行,符合「只许加 1 行注释」预算)。
- 迁移弹窗测试内插入 3 行 K36 断言(`titleEl.id`/`aria-labelledby` 比对 + `[id]` 计数=1)。
- **两处合计,预算「3 行 + 1 行注释」严格用满、未超**;文件其余 1946 行未出现在 diff 里。

## 票 1 RED 探针(两段输出)

**注入**(`cp` 备份 → 行首锚定改回 `<button @click="onDetailsClick">` + 恢复
`function onDetailsClick(){ toast.show(t('aiCfgKnowledgeSoon')) }`,`grep` 确认落盘):
```
183:function onDetailsClick() {
425:        <button class="set-detail-link" @click="onDetailsClick">
```

**报红**：
```
FAIL  src/ai/views/SettingsPage.test.ts > SettingsPage — ② 顶栏 > 8. 「详情」是指向 /ai/knowledge 的 RouterLink,不再是弹 toast 的占位按钮(票 1 反转,治理 §15.1)
AssertionError: expected false to be true
  ❯ src/ai/views/SettingsPage.test.ts:259:27
    expect(link.exists()).toBe(true)
 Test Files  1 failed (1)
      Tests  1 failed | 2 passed | 28 skipped (31)
```

还原:`cp` 备份覆盖 → `md5sum` 比对一致(`93b0f52e7852ca7febdf8b9ea7115fae` = `93b0f52e7852ca7febdf8b9ea7115fae`)。
复跑该用例回绿:`Test Files 1 passed / Tests 31 passed`。

## K36 断言强度 + 变异证据

强度:直接读 `.k-modal-title` 元素自身的 `titleEl.id`,与 `modal.getAttribute('aria-labelledby')`
比对(不是拿 `labelId` 反查字符串);另加 `modal.querySelectorAll('[id]')` 长度 = 1 排除多节点
退化 —— 与 T6(`NoteEditPane.test.ts:856-867`)/T8 同款先例齐平,强于 `IndexedFilesView.test.ts:1947`
（那条只比字符串值,没有元素身份 + 计数守卫）。

**变异**(`cp` 备份 `SettingsView.vue` → 行首锚定去掉 `<DialogTitle as-child>` 的 `as-child` →
`grep` 确认落盘 `587: <DialogTitle>`)：
```
FAIL  src/ai/knowledge/views/SettingsView.test.ts > SettingsView/T9 —— K29:reka 迁移确认弹窗 > 默认不渲染;点「搬文件」后 portal 到 .knowledge-app,head/body/foot 内容逐字
AssertionError: expected '' to be 'reka-dialog-title-v-0'
  ❯ src/ai/knowledge/views/SettingsView.test.ts:1568:24
    expect(titleEl.id).toBe(modal!.getAttribute('aria-labelledby'))
 Tests  1 failed | 112 skipped (113)
```
还原:`cp` 覆盖 → `md5sum` 一致(`b5f84730b7c3b503f794f5c52a00a3ba` = `b5f84730b7c3b503f794f5c52a00a3ba`);
`git status`/`git diff --stat` 对 `SettingsView.vue` 显示零改动(该文件全期零改动清单,本刀未获解禁,
只做了临时探针后已 100% 还原)。复跑回绿。

## `onDetailsClick` 原文留成注释的位置

`SettingsPage.vue` script 区块,紧接 `goBack()` 之后、`onRefresh()` 之前(原函数所在位置)。

## `settings-styles.scss` 与 `src/i18n/**` 零改动自证

```
$ git diff --stat -- src/ai/styles/settings-styles.scss src/i18n/ \
    src/ai/knowledge/knowledgeRoutes.ts src/ai/knowledge/deferred.ts \
    src/ai/knowledge/stores/knowledgeStore.ts
(无输出,exit=0)
```

## 命中的 K/N 编号

无新增偏离编号;沿用已授权的「反转不删」先例(K7 同族做法,承 T12/P5b-T5/P5b-T10/P5c-T10 四代)
与治理 §15.1/§15.2 的既定裁定,未触发任何需要新申报的偏离。

## 三门算式

`git status --porcelain`(non-`??`)= 5 个改动文件,与坐标表一致。
```
Test Files  331 passed (331)
     Tests  3958 passed (3958)
vue-tsc --noEmit  exit=0
vite build        exit=0
```
算式:基线 331 文件 / 3958 例 + 本刀新增 N=0(票 1 反转/票 2 注释是「改」不是「加」,
K36 是往已有用例里加断言而非新增用例)= 实测 3958,与全绿口径一致。零新建文件、
`.vue` 仍 182。无已知噪声命中。

## 给协调者的验收提示 —— 反转后从产品正常导航进入知识库

**点击路径**:AI 区 → 点顶部导航 Agent/Settings 切到「设置」页(`/ai/settings`,SettingsPage.vue)
→ 顶栏「详情」链接(`.set-detail-link`,现在是真正的 `<router-link to="/ai/knowledge">`)
→ 跳转到 `/ai/knowledge`(KnowledgeLayout + DashboardView,rail 第 1 项「仪表盘」高亮)
→ 若要验证「笔记」区(本期新入口带来的连带可达性),点左栏 rail 第 4 项「笔记」
(`aiKbNavNotes`,当前仍是占位页 `KnowledgeDeferred`,notes 路由反转归 T10)。

**可直接粘贴的 URL**(dev :5288):
`http://<host>:5288/app/#/ai/settings` → 点「详情」,或直达
`http://<host>:5288/app/#/ai/knowledge`。
