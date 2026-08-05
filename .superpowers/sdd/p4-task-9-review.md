# SP8-P4 Task 9 评审 —— McpSection.vue + 接线 + 反转占位契约

评审者:独立评审(sonnet),不采信实现者报告,自行对照 Vue2 蓝本、自行跑三门、自行做 RED 探针。

提交:`69af8ed2b1f78d2518f3be08f5062cbe98cf4fbd`(`sp8-ai`,working tree clean）。

## 判定

1. **规范符合(Spec)**:✅
2. **任务质量(Quality)**:通过

## 方法与证据

### ① Vue2 蓝本逐行对标

对照 `/home/nimo/NimoTech/NimoOS-UI/src/views/AI/MCP/McpSection.vue`(136 行):
- 模板 DOM/class 顺序(`set-split`/`sk-col-head`/`sk-col-actions`/`sk-col-search`/`sk-list`/`sk-spinner`/`sk-col-empty`)逐字对齐,内联 `style="width:18px;height:18px"` / `"display:grid;place-items:center;padding:28px 0"` 是尺寸不是颜色,允许照抄。
- 四个 computed:`filtered` 只搜 `name`/`url`(不搜 `command`,`McpSection.vue:114-118` 逐字核对无 `command` 分支)· `enabled`/`disabled` 在 `filtered` 上再分 · `activeServer` 在**未过滤 `servers`** 上查(N4,见下)。
- 四个方法(`reload`/`onToggle`/`onDelete`/`onSave`)顺序、条件与 Vue2 `:70-128` 逐句对齐,仅偏离处按三件套注明(D1×2/D2/D4/D5/D7,见下)。

### ② 单层取数

自行打开 `/home/nimo/NimoTech/.sp8/NimoOS-Service/src/ai.ts:365-396` 核实:`listMCPServers`/`createMCPServer`/`updateMCPServer`/`deleteMCPServer` 全部 `return res.data`(单层剥离,返回 `unknown`)。`McpSection.vue`:
- `reload()`:`const list = await service.ai.listMCPServers(); servers.value = Array.isArray(list) ? list : []` —— 无第二层 `.data`。
- `onSave` 新建分支:`const created = ...; const id = (created as {id?:number})?.id` —— 无第二层。
- 测试 mock 骨架 `h.createMCPServer.mockResolvedValue({ id: 7 })`(裸 `{id:7}`,非完整对象),`h.listMCPServers.mockResolvedValue([...])`(裸数组)—— 正确,未把缺陷编码进断言。
- `updateMCPServer`/`deleteMCPServer` mock 为 `undefined`(204),生产代码确认不读返回值。

### ③ 删除后选中项落位

`onDelete`:`if (activeId.value === id) { activeId.value = servers.value[0]?.id ?? null }` —— 与 Vue2 `:102` 逐字对齐。两条对照用例都在(8a 删的是当前项落位 / 8b 删的不是当前项不动),8b 用 3 项 fixture(`[a,b,c]`,选中 `c`,删 `b`)专门避免"剩余列表第一项恰好也是选中项"的假阳性,判别力设计良好。

### ④ N4 检查

`activeServer = computed(() => servers.value.find(...) || null)` —— 用 `servers` 不是 `filtered`,与 Vue2 `:64` 一致,未被"顺手修正"。测试覆盖点 5 直接钉住这一点(选中 beta → 搜索不匹配 → 详情仍显示 beta）。

### ⑤ 接线三处

- `sections.ts`:`DEFERRED_SECTIONS: SectionId[] = []`,注释按任务书原文重写,声明「机制保留、反转不删」。
- `SettingsPage.vue`:`import McpSection` + `mcp: McpSection` 映射到位,文件头注释同步改写(自行 `sed`/`grep` 读全文核实)。
- `SettingsPage.vue` 的 `placeholderProps()`(`SECTION_COMPONENTS[id] !== SectionPlaceholder` 判空)与 `onSelect()` 里的 `if (DEFERRED_SECTIONS.includes(id)) toast.show(t('aiCfgSectionDeferred'), 3000)` deferred-toast 分支**原样保留**,自行读取 `SettingsPage.vue` 全文确认两处均未被删除或改写(只是因为 `DEFERRED_SECTIONS` 现在为空,两个分支永远不触发,机制本身没动）。

### ⑥ 三处反转测试:改前/改后核对(`git show 9e5b481:<path>` 取原文对比)

- **`sections.test.ts:57-59`** —— 改前 1 条断言 `[...DEFERRED_SECTIONS].sort()` 等于 `['mcp']`;改后拆成 2 条:「为空」+「机制仍在(`Array.isArray` + 每个元素合法）」。**判定:反转,非删除**——机制钉子比改前更完整。
- **`SettingsPage.test.ts` 19b** —— 改前断言点 `mcp` 弹占位 toast(`'该分区将在后续阶段开启', 3000`);改后断言渲染 `McpSection` 真实内容(`.sk-col-search` 存在)+ 不含占位文案 + 不弹 toast。**判定:反转,非削弱**——与 19(skills)同构,断言力度对等。
- **收口守卫**(原 315 行起）—— 改前:`implemented` 12 项 + `deferred=['mcp']` 循环(断言仍含占位文案);改后:`implemented` 13 项(加入 `mcp`),`deferred` 循环整段删除。**核实**:`DEFERRED_SECTIONS` 已清空后 `for (const id of [])` 循环体永不执行,是真空转,删除有理有据(报告已申报);机制层面的钉子已转移到 `sections.test.ts` 新增两条用例。**判定:属于合理的反转处理,不算违反"反转不删"** —— 因为反转的是 *测试用例的断言方向*而非删掉钉住机制的测试,机制测试仍在(在另一个文件里)。

### ⑦ 协调者追加的两条集成用例:判别力验证(独立 RED 探针)

破坏:`McpServerModal.vue:154` 把 `watch(open)` 的 `if (v)` 改成 `if (!v)`(复位逻辑挪到关闭分支,而非打开分支)。

```
FAIL  McpSection.test.ts > McpSection > 10. 编辑保存 → 调 updateMCPServer(...)
FAIL  McpSection.test.ts > McpSection > 12b. 详情的 edit 事件打开编辑弹窗...(名称输入框回填)
FAIL  McpSection.test.ts > McpSection — 弹窗常驻实例的表单残留回归 > 编辑 A → 关闭 → 编辑 B
FAIL  McpSection.test.ts > McpSection — 弹窗常驻实例的表单残留回归 > 新增 → 关闭 → 编辑
Test Files  1 failed (1)
     Tests  4 failed | 18 passed (22)
```

两条协调者追加的集成用例精确报红(且额外带出 10/12b 两条既有覆盖点用例作为交叉印证,说明判别力比预想更强，非仅这两条空转）。已还原（`git diff` 为空)，还原后重跑：`Test Files 1 passed / Tests 22 passed`。**结论:两条集成用例判别力确认,非空转。**

### 独立 RED 探针(第二枚,评审自选,验证 N4 断言的判别力)

破坏:把 `activeServer` 改成 `computed(() => filtered.value.find(...) || null)`(N4 若被"顺手修正"会长这样)。

```
FAIL  McpSection.test.ts > McpSection > 5. 选中某项后输入匹配不到的查询词 → 列表空,但详情面板仍显示该服务器
Error: Cannot call text on an empty DOMWrapper.
Test Files  1 failed (1)
     Tests  1 failed | 21 passed (22)
```

精确命中覆盖点 5(N4 钉子),不牵连其它用例。已还原(`git status` 干净)，还原后重跑 `McpSection.test.ts` + `sections.test.ts` + `SettingsPage.test.ts`:`Test Files 3 passed / Tests 64 passed`。**结论:N4 钉子判别力确认。**

### ⑧ 测试判别力检查(公共约束 §9)

- 12 条覆盖点逐一对照 brief 清单,一条不少(部分拆成 a/b/c/d 独立用例，如 4a-4d、6a-6c、8a-8b、12a-12b)。
- 「A/B 二选一」分支均有对照:enabled↔disabled toast(6a/6b)、删的是/不是当前选中项(8a/8b)、name/url 命中(4a/4b)。
- danger toast 断言均核了三个实参(文案 + `3000` + `'danger'`):覆盖点 2、6c、7b 逐一核实为 `toHaveBeenCalledWith(text, 3000, 'danger')`。
- 异步用自定义 `flush()`(三次 `nextTick`)+ `macroFlush()`(额外一次宏任务 `setTimeout(0)`),与已评审通过的孪生 `SkillsSection.test.ts:35-42` 完全同一先例(非本任务新造模式,非违规)。
- 未发现空转用例或弱断言(`not.toBeNull()` 类)。

### ⑨ CSS 类核实

`grep` 确认 `set-split`/`sk-col`/`sk-col-head`/`sk-col-actions`/`icon-btn`/`sk-add-btn`/`sk-col-search`/`sk-list`/`sk-spinner`/`sk-col-empty` 均在 `settings-styles.scss`/`skills-styles.scss` 中有对应规则。组件里零 `<style>` 块(`McpSection.vue` 全文核实无 `<style>` 标签)。

### 提交范围检查

`git show --stat HEAD` 只含本任务书列出的 6 个文件(`sections.ts`/`sections.test.ts`/`SettingsPage.vue`/`SettingsPage.test.ts`/`McpSection.vue`/`McpSection.test.ts`),未触碰 T5-T8 组件(`McpServerGroup.vue`/`McpServerDetail.vue`/`McpServerModal.vue`)。

### 自测三门

```
pnpm test                   exit=1(首跑)→ 唯一失败 src/files/upload/persist.test.ts >
                             dropPersisted removes record + blob and frees budget
                             (公共约束 §8 已定性的既有 IndexedDB flaky噪声，与本任务无关)
                             复跑该文件单独:Test Files 1 passed / Tests 14 passed
                             → Test Files 301 passed | 1 flaky(复跑绿) / Tests 2716+1=2717
pnpm exec vue-tsc --noEmit  exit=0(无输出)
pnpm build                  exit=0(仅既有 >500KB chunk 警告,无新增警告)
```

**color-guard 算术核对**:`find src -name "*.vue" | wc -l` = 169;`git ls-tree -r 7ecd1d3 --name-only | grep '\.vue$' | wc -l` = 165(P4 开工前基线)。`git diff --name-status 7ecd1d3 HEAD -- '*.vue'` 显示新增 4 个(`McpServerGroup.vue`/`McpServerDetail.vue`/`McpServerModal.vue`/`McpSection.vue`),165+4=169,与实测一致,+4 算术成立。

## 发现

无 Critical / Important / Minor 发现。逐条核对未发现偏离清单外的未申报改动、未发现 N4/N1-N5 被顺手修正、未发现反转测试被削弱或误删机制、两条协调者追加用例与 N4 钉子均通过独立 RED 探针验证判别力,占位契约三处(`SectionPlaceholder.vue` 组件本身、`placeholderProps()`、deferred toast 分支)均原样保留。
