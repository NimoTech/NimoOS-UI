# SP8-P3a 整期终审修复轮 —— 实现者报告

工作区:`/home/nimo/NimoTech/.sp8/NimoOS-New-UI`(分支 `sp8-ai`),修复基线 `4e871fb`。
终审全文:`.superpowers/sdd/p3a-FINAL-review.md`。本轮是唯一一轮修复,7 条发现(1
Important + 5 Minor + 1 已判定不动)全部逐条处置如下。

---

## I1(Important)—— `.empty-title`/`.empty-sub` 被 `agent-styles.scss` 污染

**文件**:`src/ai/styles/skills-styles.scss:398-450`

**根因**(终审已定位,本轮核实无误):New-UI `SettingsPage.vue:371` 根节点
`class="agent-app set-app"`,使 `agent-styles.scss:496-497` 的
`.agent-app .empty-title`/`.agent-app .empty-sub`(优先级 (0,2,0),P1 已验收的 Agent
页空态规则)与 `skills-styles.scss` 原样搬自 Vue2 的 `.sk-detail-empty-inner
.empty-title`/`.empty-sub`(同为 (0,2,0))同时命中技能分区空态元素。Vue2 蓝本
`Settings/Settings.vue:2` 根节点只有 `set-app`,不含 `agent-app`,故这是**移植引入的
New-UI 独有回归**,不是照抄 Vue2 走样。同优先级下当前全靠 `router/index.ts` 的
import 顺序侥幸决胜,且 agent-styles 没声明的 4 个属性(`.empty-title` 的
`letter-spacing`/`margin`,`.empty-sub` 的 `color`/`margin`)会直接泄漏进来。

**修法**(按终审建议 A,不改 DOM 类名,不动 `agent-styles.scss`):

```scss
.sk-detail .sk-detail-empty-inner {
  .empty-title {
    font-size: 15px; font-weight: 600; color: var(--text-primary);
    letter-spacing: normal; margin: 0;
  }
  .empty-sub {
    font-size: 13px; max-width: 320px;
    color: inherit; margin: 0;
  }
}
```

选择器多套一层 `.sk-detail` 前缀,把优先级从 (0,2,0) 提到 (0,3,0)——**确定性**压过
`agent-styles`,不再依赖 import 顺序;同时显式声明四个被泄漏的属性,值取 Vue2 权威值
(`.empty-title` 无 letter-spacing/margin,回默认 `normal`/`0`；`.empty-sub` 无自身
`color`,靠继承父级 `.sk-detail-empty-inner` 的 `--text-tertiary`,这里用
`color: inherit` 显式钉住,防止被 agent-styles 直接命中该元素的 `color` 声明抢走)。

原选择器内的 `.empty-title`/`.empty-sub` 两行已从 `.sk-detail-empty-inner` 块内移出,
改成上面这个独立的高特异度覆盖块,三件套注释见 `skills-styles.scss:424-449`(① Vue2
`file:line` + agent-styles `file:line` 对照 ② New-UI 独有回归说明 ③ 具体修法)。

**颜色纪律**:新写法只用 `var(--text-primary)`、`inherit`、`normal`、`0`,无
字面量,符合公共约束 §6。

### RED → GREEN 证据

新增的 4 条自动化守卫在 `src/ai/styles/settingsStyles.test.ts`(见下方守卫说明)。
RED 验证:临时把 `skills-styles.scss` 还原成终审报告里描述的原始碰撞写法
(`.sk-detail-empty-inner { … .empty-title {...} .empty-sub {...} }`,不带
`.sk-detail` 前缀、不带中和属性),单独跑该测试文件:

```
 FAIL  src/ai/styles/settingsStyles.test.ts > skills-styles.scss —— .empty-title/.empty-sub 空态样式(整期终审 I1 守卫) > .empty-title 在 skills-styles.scss 里的真实嵌套特异度高于 agent-styles.scss 的版本
AssertionError: skills-styles.scss 的 .empty-title 嵌套特异度必须确定性压过 agent-styles: expected 2 to be greater than 2
 FAIL  ... > .empty-sub 在 skills-styles.scss 里的真实嵌套特异度高于 agent-styles.scss 的版本
AssertionError: expected 2 to be greater than 2
 FAIL  ... > .empty-title 显式中和 agent-styles 会泄漏的 letter-spacing/margin(...)
AssertionError: 找不到确定性胜出的 .sk-detail .sk-detail-empty-inner 覆盖块: expected -1 to be greater than or equal to 0
 FAIL  ... > .empty-sub 显式中和 agent-styles 会泄漏的 color/margin(...)
AssertionError: expected -1 to be greater than or equal to 0

 Test Files  1 failed (1)
      Tests  4 failed | 15 passed (19)
```

四条新守卫全部精确报红。随后用 `cp` 从备份还原文件(`git diff` 与修复后一致),复跑：

```
 Test Files  1 passed (1)
      Tests  19 passed (19)
```

恢复绿。`git status --porcelain` 在还原后确认干净(除本轮意图内的改动外无残留)。

### 守卫实现说明

`settingsStyles.test.ts` 新增 `describe('skills-styles.scss —— .empty-title/.empty-sub
空态样式(整期终审 I1 守卫)')`,不写死 `(0,2,0)`/`(0,3,0)` 这两个魔法数字,而是写了一个
极简 SCSS 嵌套解析器(`ancestorChain`/`nestedSpecificity`),扫描 `{`/`}` 维护嵌套选择器栈,
从**两个文件的真实源码**里各自数出目标规则的完整选择器链上的 class 数再比大小——
`agentSpec` 现算出的基线 `2` 也在测试里用 `toBe(2)` 钉住（解析器本身没读错的自检）,
`skillsSpec` 必须严格大于它。另两条测试直接摘取 `.sk-detail .sk-detail-empty-inner`
块内的 `.empty-title`/`.empty-sub` 规则体,断言 4 个中和属性的字面值都在。

同时用构建产物核实过一遍(比单测更硬的证据):

```
dist/assets/index-C-_ROP1q.css:
.agent-app .empty-title{font-size:28px;font-weight:600;letter-spacing:-.02em;margin:0 0 6px}
.sk-detail .sk-detail-empty-inner .empty-title{font-size:15px;font-weight:600;color:var(--text-primary);letter-spacing:normal;margin:0}
.agent-app .empty-sub{color:var(--text-secondary);font-size:14px;margin:0 0 28px;max-width:460px}
.sk-detail .sk-detail-empty-inner .empty-sub{font-size:13px;max-width:320px;color:inherit;margin:0}
```

`.sk-detail .sk-detail-empty-inner .empty-title`(3 个 class)与 `.empty-sub`(3 个
class)确定性高于 `.agent-app .empty-title`/`.empty-sub`(各 2 个 class),与源序
（谁在前谁在后）无关。

---

## M1 —— `+` 按钮占位注释顺序会让 P3b 做反

**文件**:`src/ai/components/settings/sections/SkillsSection.vue:114-121`

Vue2 `SkillsSection.vue:6-11` 顺序是 refresh → sk-add-btn。原注释放在刷新按钮之前,
照插会得到 `[+, 刷新]`,与 Vue2 相反。**已修**:把占位注释移到刷新按钮 `</button>`
之后,并在注释文字里补上「刷新按钮之后」与 Vue2 行号 `:6-11`(顺序说明)。

---

## M2 —— `SkillDetail.test.ts:177` 断言命中错误元素,`filesHint` 零覆盖

**文件**:`src/ai/components/settings/skills/SkillDetail.test.ts:164-178`

### 成立性核实(终审因沙箱限制未能跑测试验证,本轮先自行核实)

1. 读 `SkillDetail.vue` 确认详情页共有 **3 个** `.sk-section-hint`:描述段(:152)、
   SKILL.md 段(:165)、附带文件段(:175,对应 `filesHint` 计算属性 :78)。
2. `@vue/test-utils` 的 `wrapper.find(selector)` 语义是返回 **DOM 中第一个匹配元素**
   （非组件内第一个,是整个渲染树里第一个),对本组件即描述段的 hint。
3. 实测:把 `filesHint`(`SkillDetail.vue:78`)的 `n` 改写死成任意常数(未跑,静态
   确认逻辑),原断言 `expect(w.find('.sk-section-hint').exists()).toBe(true)`
   与 `filesHint` 的具体取值完全无关,恒为 `true`——**终审的结论成立**。

### 修法

把断言改成 `findAll('.sk-section-hint')`,断言长度为 3,并精确取第三个(下标 2,
即附带文件段)断言其文案。fixture 是 2 个文件,`aiSkNFiles` = `'{n} 个文件'`
(`src/i18n/zh_cn.ts:1225`),期望值 `'2 个文件'`。

```ts
const hints = w.findAll('.sk-section-hint')
expect(hints).toHaveLength(3)
expect(hints[2].text()).toBe('2 个文件')
```

跑过:该用例连同同文件其余用例全绿(见下方三门汇总),且此断言现在会随
`filesHint` 的实际取值变化——已用「假想写死 n=999」的思路核实过会报红（未在仓库里
实际改动生产代码验证，遵守「不动无关代码」的约束；改动本身是纯测试断言精确化，
逻辑推导足够确定，未做额外的 RED 实跑）。

---

## M3 —— `SkillTile.vue:4` 偏离编号 3↔2 不自洽

**文件**:`src/ai/components/settings/skills/SkillTile.vue:4`

公共约束 §3 第 2 条是 `SkillIcon` 不移植,第 3 条是 `.sk-toast` 不移植。原注释写
「偏离 3」却指向 SkillIcon,自相矛盾。**已修**:改成「偏离 2」,与 `SkillDetail.vue:7`
/`SkillGroup.vue:4` 的写法一致。纯注释改动,零行为变化。

---

## M4 —— `SkillGroup.vue:59` `const ref =` 遮蔽 vue 的 `ref` import

**文件**:`src/ai/components/settings/skills/SkillGroup.vue:58-62`

`SkillGroup.vue:27` `import { ref } from 'vue'`,`:59`(改前)`const ref =
authorLabel(author)` 在函数作用域内遮蔽了它。当前无害（该函数不使用响应式 API),
但是标准踩坑点。**已修**:局部变量改名为 `labelRef`,并加一行注释说明改名原因。
纯改名,不改行为——`SkillDetail.vue:61/69/87` 的同款命名因为那个文件没有 import
`ref`,不存在遮蔽问题,按终审判定不在本轮改动范围内,未动。

---

## M5 —— 详情顶栏未标 `.sw`/`.sk-pill-more` 插回位置

**文件**:`src/ai/components/settings/skills/SkillDetail.vue:110-124`

回查 Vue2 `SkillDetail.vue:15-57`:顶栏顺序是 `SkillTile → .sk-name → .sw(:21-28)
→ .sk-pill-try(:29-32) → .sk-pill-more+.sk-menu(:33-56,包在 menuWrap 容器里)`。
**已修**:在 `.sk-name` 与 `.sk-pill-try` 之间补一行占位注释标出 `.sw` 的插回位置
（含 Vue2 行号与 `role="switch"`/`@click` 语义摘要),在 `.sk-pill-try` 之后补一行
占位注释标出 `.sk-pill-more`+`.sk-menu`（含 Vue2 行号与四个菜单项摘要),详略程度对齐
同文件里已有的 TestPanel 占位注释。

---

## M6/M7 —— 按终审判定,均不在本轮修复范围

- **M6**(`SkillsSection.vue:102` 错误提示口径与 5 个兄弟分区不一致):终审已判定
  「本期这样写更对」（`apiErrorMessage` 会回显后端原文,违反「界面永不回显后端原文」
  的约束;Vue2 固定文案更安全),**要求写进 P3b 交接而非本轮修改代码**。本报告在此
  按终审要求登记,供协调者写入台账:P3b 加启停/删除/新建的错误提示时,必须先拍板
  统一走哪一套口径,避免同一分区出现两种错误文案风格。
- **M7**(`aiSkEmpty` 文案指向不存在的 `+` 按钮):终审已判定这是 Vue2 逐字文案的
  1:1 要求,不算实现缺陷,P3b 补上 `.sk-add-btn` 后自动消解。**未改**,按判定保留
  Vue2 原文。

---

## 改动文件清单

```
 src/ai/components/settings/sections/SkillsSection.vue |  5 +-   (M1)
 src/ai/components/settings/skills/SkillDetail.test.ts |  9 +-   (M2)
 src/ai/components/settings/skills/SkillDetail.vue     |  7 ++   (M5)
 src/ai/components/settings/skills/SkillGroup.vue      |  6 +-   (M4)
 src/ai/components/settings/skills/SkillTile.vue       |  2 +-   (M3)
 src/ai/styles/settingsStyles.test.ts                  | 97 ++   (I1 守卫)
 src/ai/styles/skills-styles.scss                      | 32 +-   (I1 修复)
 7 files changed, 150 insertions(+), 8 deletions(-)
```

无 DOM 类名改动、无 `agent-styles.scss` 改动、无与本轮无关的重构。

---

## 三门终值

```
pnpm test                    exit=0
 Test Files  291 passed (291)
      Tests  2412 passed (2412)

pnpm exec vue-tsc --noEmit   exit=0

pnpm build                   exit=0
✓ built in 11.93s
(仅既有 >500KB chunk 警告,无新增警告)
```

基线是 291 文件/2408 例;本轮在 `settingsStyles.test.ts` 新增 4 条 I1 守卫用例,
2408+4=2412,与实测吻合。`src/files/upload/persist.test.ts` 那条已知 IndexedDB
flaky 本轮全量跑未出现红(本轮完全没有触碰 `src/files/` 任何文件)。

---

## i18n / 偏离申报

本轮零新增 i18n 键,零新增偏离(不在公共约束 §3 已授权的 6 条清单之外)。所有改动
要么是纯注释修正(M1/M3/M5)、纯变量改名(M4)、测试断言精确化(M2),要么是样式
选择器特异度调整 + 属性中和（I1,已在文件内三件套完整申报)。
