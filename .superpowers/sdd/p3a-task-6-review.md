# SP8-P3a Task 6 —— `SkillsSection.vue` 独立评审

评审者:独立 sonnet 会话,未采信实现者报告,自行读蓝本/grep/跑测试。

## 结论

- **规格符合**:✅ 通过
- **代码质量**:通过(附 1 条 Important 级测试质量问题)

## 逐项核对

### 1. 数据契约(单层取数口径)—— 本期最大风险点,已充分验证

- 生产代码 grep `.data`:只出现在文件头注释与行内注释里,取数路径本身
  `const list = (await service.ai.listSkills()) as Skill[]` 不含任何 `.data`。确认无残留。
- 共享包 `NimoOS-Service/dist/ai.d.ts:1-13` 头注明确写明:ai 域所有方法
  统一 `return res.data`(HTTP body,信封原样,不 unwrap)。后端
  `NimoOS-AI/route/v2/skills.go:37` 是 `c.JSON(http.StatusOK, out)`,`out` 是
  `[]Skill` 裸数组。两者叠加 = 消费端确实只能单层取数,brief/报告对契约的描述准确。
- 测试 mock 除故意验口径的负例(`{ data: [...] }`,test.ts:87)外,其余 8 例全部
  裸数组,无缺陷编码进断言的情况。
- **我自己独立做的 RED 探针**(不是复用实现者的验证):把 `reload()` 改回 Vue2 的
  双层剥取(`const resp = ...; const list = resp.data`),单独跑
  `SkillsSection.test.ts`:
  ```
  Test Files  1 failed (1)
       Tests  7 failed | 2 passed (9)
  ```
  失败用例与实现者报告完全一致(7 条:挂载渲染两组 / 裸数组非空 / 三字段搜索 /
  切换 activeSkill / 过滤不崩 / 刷新重载 / 反向口径断言方向倒转)。之后用备份文件
  精确还原,`git status` 干净、`git diff` 无残留。
  → **判定:该口径测试对「单层 vs 双层」有真实鉴别力,非空转。**

### 2. §6.1 取/不取

- 左列头部只有刷新按钮(`.icon-btn` + `AgentIcon refresh` size 15 +
  `t('aiCfgRefresh')` 作 title),`+` 按钮/`AddSkillModal`/`.sk-toast` 均未渲染
  ——grep 确认仅出现在注释里,无实际引用/挂载。
- 搜索框(含清空按钮,尺寸内联 style 照抄)、`.sk-spinner` 加载态、两个
  `SkillGroup`(内置在前/我的在后,对齐 Vue2 顺序)、两种空态文案(`aiSkNoMatch`
  带 `<code>{{query}}</code>` / `aiSkEmpty`)、右侧 `SkillDetail` 均按蓝本 1:1 呈现。

### 3. 与 Vue2 的 1:1

- 四个 computed 逐字对齐 Vue2 `:105-118`:`filtered` 三字段（name/title/description）
  小写包含;`builtIn`/`personal` 按 `system` 二分;`activeSkill` 从**全量** `skills`
  (非 `filtered`)按 `activeId` 查找——与 Vue2 `:116-118` 一致,即选中项被搜索过滤掉
  后详情面板不受影响,不会跟着清空/报错。
- 选中态保持逻辑对齐 Vue2 `:135-137`:`reload()` 里「当前选中项已不在新列表 → 落
  第一项,空列表落 `null`」逐字复刻。

### 4. toast

- 失败路径 `toast.show(t('aiSkLoadFailed'), 3000, 'danger')` —— 已回查
  `src/stores/toast.ts:21`(`show(text, duration = 1500, tier = 'info')`),默认
  1500ms,这里显式传 3000 + `'danger'`,正确。
- `loading.value = false` 在 `finally` 里,失败/成功都会复位——测试
  「reload 失败弹 danger toast 且 loading 复位」验证了 `.sk-spinner` 消失。
- Vue2 `:139` 的 `console.error` 未照抄(grep 确认全文件零 `console.` 调用,仅注释
  提及)——申报为偏离 2,理由（三个兄弟分区无此惯例）站得住。

### 5. 子组件接线

- `SkillGroup`(Task 4)的 `activeId: string | null` 无默认值（`defineProps` 未用
  `withDefaults`），两处调用都显式传 `:active-id="activeId"`。
- `SkillDetail`(Task 5)`defineProps<{ skill: Skill | null }>()` 只有一个 prop，
  `SkillsSection.vue:166` 只传 `:skill="activeSkill"`，未传 busy/toggle/delete/test
  等 P3b 才需要的 prop/事件，符合裁剪范围。

### 6. CSS

- 组件文件零 `<style>` 块（`grep "<style"` 唯一命中是注释行「零 `<style>` 块」）。
- 用到的每个 class 均已 grep 确认存在：`set-split`/`sk-col-actions`/`icon-btn` 在
  `settings-styles.scss:86-89,346-353`；`sk-col`/`sk-col-head`/`sk-col-search`/
  `sk-list`/`sk-col-empty`/`sk-spinner` 在 `skills-styles.scss`（Task 1 已建）。
- Vue2 `:17-24`/`:27-29` 两处内联 `style` 是尺寸/布局（`width/height`、
  `display:grid;place-items:center;padding`），不含颜色，照抄不违反 color-guard，
  已核实无 hex/rgb/具名色。

### 7. 测试判别力 —— 发现 1 条 Important

- mock 骨架用 `vi.hoisted()`（`h`/`push` 两处），符合公共约束 §9。
- 9 例里 8 例有真实判别力（含单层取数正反两例、reload 失败态、切换态、过滤不崩态、
  刷新按钮态，均逐条读过断言与 DOM 结构，未见空转）。
- **唯一发现**：标题为「搜索按 name/title/description 三字段小写包含过滤」的用例
  （test.ts:106-131），断言只用查询词 `'FAMILY'` 命中 `description` 字段，对
  `name`/`title` 字段的匹配**没有独立验证**。我做了一次针对性探针：把生产代码
  `filtered` computed 里 `s.name` 那行过滤条件删掉（只留 title/description 两个
  OR 分支），重跑该文件：
  ```
  Test Files  1 passed (1)
       Tests  9 passed (9)
  ```
  全绿——证明当前测试套件**无法**发现"name 字段搜索失效"这类回归，尽管生产代码本身
  是正确的（我读了源码，`filtered` computed 三字段判断与 Vue2 `:105-112` 完全一致，
  这不是产品缺陷，是测试盲区）。已还原探针改动，`git status` 干净。
  → 建议：日后若有人动这段 computed，加一条用 `name`-only 匹配技能隔离验证的用例。
  本条不构成阻塞（brief 对该用例的要求是"覆盖搜索过滤"，测试确实覆盖了搜索行为，
  只是没有把三字段拆开各验一次），列为 Important 而非 Critical。

### 8. 提交纯净性

`git show --stat HEAD`（对 diff 文件核对）只含 `SkillsSection.vue` +
`SkillsSection.test.ts` 两个新文件，360 行新增，无其他文件改动；本地
`git status` 全程干净。

## i18n 核对

`aiSkSearchPlaceholder`/`aiSkBuiltIn`/`aiSkYours`/`aiSkNoMatch`/`aiSkEmpty`/
`aiSkLoadFailed` 六个键回查 Vue2 生产语言包
`NimoOS-UI/src/assets/lang/{zh_CN,en_US}.json`：
`zh_CN.json:879-883,953` 逐字符匹配（含省略号、句号、逗号）；`en_US.json` 未显式
定义这几个键（vue-i18n 缺键回落到 key 本身，Vue2 英文 UI 因此直接显示这些
英文字面量），New-UI `en_us.ts` 对应值与这些字面量逐字符一致。`aiCfgRefresh`
复用已有键，`zh_cn.ts:617`/`en_us.ts:614` 均存在且未被重复定义。

## 我自己实测的测试数字

- 全量 `pnpm test`：**291 files / 2405 tests，全绿**，exit=0（与协调者基线
  290/2395 + 本文件 9 例 + color-guard 自动 +1 吻合）。
- RED 探针 1（双层剥取还原 Vue2 缺陷）：`SkillsSection.test.ts` 7 failed / 2 passed
  → 还原后 9 passed，`git status` 干净。
- RED 探针 2（name 字段判别力，非公共约束强制项，我主动加做的针对性验证）：
  9 passed（说明该场景测试无法捕获），已还原，`git status` 干净。
