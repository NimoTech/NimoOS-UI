# SP8-P3a 整期终审修复轮 —— scoped 再评审(仅限修复 diff `4e871fb..c834bb1`)

评审者:本轮不采信实现者报告结论,逐条自行核对 Vue2 蓝本、自算 CSS 特异度、自跑测试、
自做 RED 探针。仓库:`/home/nimo/NimoTech/.sp8/NimoOS-New-UI`(分支 `sp8-ai`)。

---

## A. 6 条逐条判定

### I1(Important)—— `.empty-title`/`.empty-sub` 与 `agent-styles.scss` 碰撞

**ADDRESSED。**

- 根因复核:`git show`Vue2 `Settings/Settings.vue:2` 根节点只有 `class="set-app"`
  (已读取确认),New-UI `src/ai/views/SettingsPage.vue:371` 根节点确认是
  `class="agent-app set-app"`。`agent-styles.scss` 的 `.agent-app { ... }` 大块从
  第 8 行开始包裹全文件,`.empty-title`/`.empty-sub`(496-497 行)是其**直接子层**、
  2 空格缩进,链选择器 = `.agent-app .empty-title` → 类计数 2,与终审判定一致。
- **特异度是否确定性胜出**:自读 `skills-styles.scss:443-452`,选择器改成
  `.sk-detail .sk-detail-empty-inner { .empty-title {...} .empty-sub {...} }`。
  已确认 `SkillDetail.vue:99` 根节点是 `class="sk-detail"`,`.sk-detail-empty-inner`
  是其后代(非直接子层但 SCSS 嵌套编译成后代选择器,DOM 结构里也确实是后代)。
  链选择器类计数 = `.sk-detail`(1)+`.sk-detail-empty-inner`(1)+`.empty-title`(1)=3,
  **3 > 2,与 import 顺序无关,确定性胜出**。
- **4 个泄漏属性对照 Vue2 权威值**(已读 `NimoOS-UI/src/views/AI/Skills/skills-styles.scss:570-571`
  原文:`.empty-title { font-size: 15px; font-weight: 600; color: var(--text-primary); }`
  `.empty-sub { font-size: 13px; max-width: 320px; }`,均无 letter-spacing/margin/color):
  - `.empty-title` 新增 `letter-spacing: normal; margin: 0;` —— `normal`/`0` 正是无声明时的
    浏览器默认值(div 元素 UA 样式表本无默认 margin),与 Vue2 视觉一致。
  - `.empty-sub` 新增 `color: inherit; margin: 0;` —— Vue2 里 `.empty-sub` 无自身 color,
    靠继承父级 `.sk-detail-empty-inner` 的 `color: var(--text-tertiary)`(已在
    `skills-styles.scss:407` 确认该行存在)。New-UI 模板里 `.empty-sub` 的**直接父元素**
    正是 `.sk-detail-empty-inner`(`SkillDetail.vue:102-105`,同级还有 `.orb`/`.empty-title`),
    故 `color: inherit` 解析到的计算值就是 `var(--text-tertiary)`,与 Vue2 渲染结果**逐位相同**,
    不是 `--text-secondary`(那是 agent-styles 会泄漏的错误值,已被中和)。
- **自己独立做的 RED 探针**(不是复用实现者报告的日志):把 `skills-styles.scss:443-452`
  手工改回原始碰撞写法(去掉 `.sk-detail` 前缀、去掉 4 个中和属性,`git diff` 后仅剩
  `.sk-detail-empty-inner { .empty-title{font-size:15px;font-weight:600;color:var(--text-primary);} .empty-sub{font-size:13px;max-width:320px;} }`),
  单独跑 `pnpm exec vitest run src/ai/styles/settingsStyles.test.ts`:4 条新守卫**精确报红**
  (2 条特异度断言 `expected 2 to be greater than 2`;2 条中和属性断言 `找不到确定性胜出的
  .sk-detail .sk-detail-empty-inner 覆盖块: expected -1 to be greater than or equal to 0`),
  其余 15 条无关用例仍绿。随后用 `cp` 从本轮开头备份的原文件精确还原,`git status --short`
  确认干净、`git diff --stat` 无输出。
- **守卫本身是否空转/误判**:读了 `ancestorChain`/`nestedSpecificity` 实现
  (`settingsStyles.test.ts:208-236`)—— 是真实的括号栈嵌套解析器,逐字符扫 `{`/`}` 维护
  选择器链,不是字符串包含匹配。喂给它的 `css`/`agentCss` 都先过同文件已有的
  `stripComments()`(整行 `//` 注释 + 块注释一律剥掉,P2b 已因「断言撞到注释里的类名」踩过坑
  才加固的机制,本轮复用无新风险),不会把注释算进选择器链或规则体。`agentSpec`/`skillsSpec`
  的基线用 `toBe(2)` 钉死防止解析器自己读错。中和属性两条测试用
  `css.indexOf('.sk-detail .sk-detail-empty-inner {')` 精确定位到目标块再取子串断言 4 个具体
  属性值,不是全文 `toContain`(不会被别处同名属性撞对)。**无空转,无误判。**

### M1 —— `+` 按钮占位注释顺序

**ADDRESSED。** 核对 Vue2 `NimoOS-UI/src/views/AI/Skills/SkillsSection.vue:1-11`:
真实顺序是 `refresh`(:6-8)→ `sk-add-btn`(:9-11)。修复后 `SkillsSection.vue` 的注释已移到
`</button>`(刷新按钮)之后,顺序描述文字正确引用 Vue2 行号 `:6-11`。纯注释改动,零行为变化。

### M2 —— `SkillDetail.test.ts` 断言命中错误元素

**ADDRESSED。** 读 `SkillDetail.vue` 确认全页确有 3 个 `.sk-section-hint`
(描述 :159 / SKILL.md :172 / 附带文件 :182)。改后断言 `findAll` 长度 3 + `hints[2]` 精确取
第三个。**自己做的 RED 探针**(不是照抄报告里"未跑,静态确认"的说法):把生产代码
`filesHint`(`SkillDetail.vue:78`)临时改成 `t('aiSkNFiles', { n: 999 })`,单独跑该用例,
精确报红(`expected '999 个文件' to be '2 个文件'`),随后原样还原,`git status --short` 干净。
`aiSkNFiles` 键值核对 `src/i18n/zh_cn.ts:1225` = `'{n} 个文件'`,2 个文件 fixture → `'2 个文件'`
计算正确。

### M3 —— `SkillTile.vue` 偏离编号

**ADDRESSED。** 核对公共约束 §3:第 2 条是 SkillIcon 不移植,第 3 条是 `.sk-toast` 不移植。
原注释「偏离 3」指向 SkillIcon 确系错误,已改成「偏离 2」,与同一约束下 `SkillDetail.vue:7`/
`SkillGroup.vue:4` 写法一致。纯注释改动。

### M4 —— `SkillGroup.vue` 局部变量遮蔽

**ADDRESSED,且核实是纯改名。** 确认 `SkillGroup.vue:27` `import { ref } from 'vue'`,
`:45` `const collapsed = ref(false)` 实际使用了该 import。改前 `displayAuthor` 内
`const ref = authorLabel(author); return ref ? t(ref.key) : author` 确实遮蔽外层 `ref`
(当前无实际故障,因为函数体内没有再调用响应式 `ref()`,只是踩坑隐患)。改后逐处替换为
`labelRef`,三处引用(声明 + 两个使用点)同步改名,逻辑表达式结构一字未变,行为等价。

### M5 —— 详情顶栏插回位置注释

**ADDRESSED。** 核对 Vue2 `SkillDetail.vue:15-56`:顺序确为
`SkillTile → .sk-name → .sw(:21-28,role="switch" + @click="$emit('toggle', …)")
→ .sk-pill-try(:29-32) → menuWrap 容器(:33-56,内含 .sk-pill-more 按钮 + v-if="menuOpen"
的 .sk-menu,四个菜单项:禁用/复制 SKILL.md/导出/删除)`。修复后两行占位注释的位置
(`.sk-name` 与 `.sk-pill-try` 之间;`.sk-pill-try` 之后)、行号引用、菜单项摘要均与蓝本吻合。

---

## B. 修复 diff 内是否引入新破坏

**未发现新破坏。**

- `SkillDetail.test.ts` 的旧断言 `expect(w.find('.sk-section-hint').exists()).toBe(true)`
  被替换成 `toHaveLength(3)` + `hints[2].text()` 精确值 —— 后者严格蕴含前者(如果元素不存在,
  `findAll` 长度不会是 3),**是加强不是削弱**。
- M4 的改名核实为纯改名(见上),零行为变化,三处引用同步改,无遗漏。
- 颜色纪律:对本次 diff 的新增行做了 `grep -iE '#[0-9a-f]{3,6}|rgba?\(|\bwhite\b|\bblack\b'`
  扫描,**零命中**。I1 修复新增的 4 个属性值(`normal`/`0`/`inherit`/`var(--text-primary)`)
  均非字面量颜色。
- M2 改成 `findAll()[2]` 按下标定位——**确实是位置耦合**,但可接受:这 3 个 `.sk-section-hint`
  是同一组件静态模板里固定顺序的 3 个描述性小节标题(描述/SKILL.md/附带文件),没有可用于
  区分的独立 class,任何这三段落顺序调整本身就是需要评审关注的结构性改动,不是那种「与逻辑无关
  就可能悄悄错位」的脆弱下标(比如动态列表)。且新加的 `toHaveLength(3)` 会在结构变化(增删
  hint)时先报错,不属于「无判别力」范畴。判定:可接受,非缺陷。
- 提交范围核对:`git show c834bb1 --stat` 确认只含终审判定要求的 7 个文件,无关文件/无重构。

---

## RED 探针小结(均已精确还原,`git status --short` 全程验证干净)

1. **I1**:`skills-styles.scss` 还原成碰撞写法(去 `.sk-detail` 前缀 + 去 4 个中和属性)→
   `settingsStyles.test.ts` 中新增 4 条守卫精确报红 → `cp` 备份精确还原 → 复跑绿、`git status` 干净。
2. **M2**:`SkillDetail.vue` 的 `filesHint` 改写死成 `n: 999` → 目标用例精确报红
   (`expected '999 个文件' to be '2 个文件'`)→ Edit 精确还原 → `git status` 干净。

---

## 实测数字

```
pnpm test                    exit=0
 Test Files  291 passed (291)
      Tests  2412 passed (2412)
（本次全量含已知 flaky src/files/upload/persist.test.ts 用例,本次跑绿,属正常噪声范围内)

pnpm exec vue-tsc --noEmit   exit=0

pnpm build                   exit=0
✓ built in 11.98s(仅既有 >500KB chunk 警告,无新增警告)
```

构建产物二次核实(比单测更硬的证据,自己 grep 出来的,非抄报告):
```
dist/assets/index-C-_ROP1q.css:
.sk-detail .sk-detail-empty-inner .empty-title{font-size:15px;font-weight:600;color:var(--text-primary);letter-spacing:normal;margin:0}
.agent-app .empty-title{font-size:28px;font-weight:600;letter-spacing:-.02em;margin:0 0 6px}
```
两条规则同时存在于产物里(CSS 不会做规则消除),`.sk-detail .sk-detail-empty-inner .empty-title`
的 3 类选择器确定性压过 `.agent-app .empty-title` 的 2 类,与源码顺序无关。

未见需要红项归属的失败用例。全程 `git status --short` 保持干净,`dist/` 为构建产物不入库,
不影响该判定。

---

## 范围外备注(不展开)

- M2 的 `findAll()[2]` 下标定位若未来 `.sk-section-hint` 数量增加(如 P3b 加新小节)会需要
  同步调整下标,建议 P3b 触碰该文件时留意。
