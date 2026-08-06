# P5d · T8 独立评审 —— `NoteEditPane.vue` 下半(侧栏 5 卡 + 标签编辑 + 冲突弹窗)

评审范围:`review-76dcd8b..71eab1f.diff`(HEAD `71eab1f`)。方法:自读全部产品/测试代码 + 蓝本
(`git show 7a6ee6b7:src/views/AI/Knowledge/NoteEditPane.vue`,338 行),自跑三门 + 自跑变异(不采信
实现者报告任何断言)。全程 `cp` 备份 + 行首锚定注入 + md5 逐字节自证还原,未用 `git checkout`/`restore`。

## 结论

1. **规格符合(§T8 DoD 1–11)**:✅ **符合**。K41 另一半(零 `as any`,字段依据逐条对得上蓝本
   `:128/:131/:132/:139/:141`)、数据契约(`backlinks` 裸数组)、`onTagKey` 三分支+反例、`addTag` 去重、
   冲突弹窗三动作(`dirty` 全断言)、clipboard 照抄不加兜底、reka 化对齐 `SettingsView.vue`、§9.9 两侧、
   `refLabel` 三档、缺口③ token 化、定位器加固,全部在源码与测试里实证到位。
2. **任务质量**:✅ **通过**。三门自跑:`Test Files 331 passed / Tests 3958 passed`、`vue-tsc` exit=0、
   `vite build` exit=0(`git status --porcelain` 全程干净)。`.vue`=182、测试文件=331,均与报告一致。

## 🔴 第一必查项 —— 2 处 `-` 行改前→改后判定 + 双向变异验证:**加固,未改弱**

`git diff` 里 `NoteEditPane.test.ts` 逐行核对(`awk` 抽取该文件 diff 段单独数 `-` 行,排除 `--- a/...`
文件头行):**恰好 2 处**,无第三处。

| 位置 | 改前 | 改后 | 判定 |
|---|---|---|---|
| `created()等效`「draft」用例 | `w.find('.kn-badge[data-s="draft"]').exists()` | `w.find('.kn-edit-top .kn-badge[data-s="draft"]').exists()` | 收紧(加祖先) |
| `created()等效`「archived」用例 | `w.find('.kn-badge[data-s="archived"]').text()` | `w.find('.kn-edit-top .kn-badge[data-s="archived"]').text()` | 收紧(加祖先) |

`NoteEditPane.vue` 侧的全部 `-` 行(独立 `awk` 抽取核对)只落在文件头 HTML 注释块与一处代码注释
(`backlinks` ref 声明上方的登记注释),**零产品代码逻辑改动** —— T7 写的 script/template 一字未动,
仅文档注释更新为「T8 已落地」的措辞。

**我自己跑的两个方向变异(cp+md5+还原,`git status` 收尾均干净)**:
- **退回裸选择器**(把 DoD-11 新增两条用例里的 `.kn-edit-top .kn-badge[...]` 断言改回裸选择器)→
  **报红**(`expected [...] to have a length of 1 but got 2`,两条全红)—— 证明这两条新用例确有判别力,
  不是空转。
- **把「created()等效」里那 2 处已加固的断言临时改回裸选择器**(不改产品代码)→ 仍然**全绿**
  (4/4 passed)—— 这恰恰实证了 T7 评审预警的隐患真实存在:不加固时测试并不会自己变红。
- **把侧栏状态卡的 `data-s="draft"` 改成不同值 `data-s="draft-aside-mutated"`**(纯产品代码变异,
  测试文件不动)→ 已加固的那 2 条「created()等效」断言**仍然绿**(该 describe 4/4 全过),
  而 DoD-11 新用例与「侧栏状态卡」describe 的其余用例正确报红 —— 证明加固后的定位器确实**只**认
  顶栏那个元素,不会被侧栏干扰,加固真实生效。

**结论**:2 处改动是纯粹的「收紧」,判别力从「巧合命中文档序第一个」提升为「精确命中确定元素」,
双向变异均按预期报红/报绿,无放宽证据。

## 🔴 第二必查项 —— R16(`addTag`/`openConflict` 归 T7,不许重复实现)

`grep -c "^function \|^async function "` 全文件命中 20 处函数定义,`addTag`/`openConflict` 各**恰好
一处**定义(`:393` / `:483`),与 T7 产出逐字节一致(diff 未触碰这两段函数体)。T8 只在模板里接线
(`@blur="addTag"`;冲突弹窗三按钮消费既有 `conflict`)。**判定:未重复实现,符合 R16。**

DoD-4 去重用例(`addTag() 去重:输入一个已存在的标签`)**自己跑变异**:把
`const fresh = parsed.filter((tg) => !form.tags.includes(tg))` 改成 `const fresh = parsed`(去重逻辑
去掉)→ 该用例**报红**(`expected [...widget, nimoos] to deeply equal [...widget]`)。**判别力确认真实。**

## 🔴 自己跑的其余变异(全部 cp+md5+还原,收尾 `git status` 干净)

| 变异 | 结果 |
|---|---|
| K36:`<DialogTitle as-child>` 去掉 `as-child` | ✅ 报红(`expected '' to be 'reka-dialog-title-v-0'`),与报告逐字一致 |
| 缺口③:`var(--warning-soft)` 改回 `rgba(255,149,0,.14)` | ✅ 报红(`knowledgeStyles.test.ts`「模板里有 rgb()/hsl() 函数色」,1 failed / 95 passed / 198 skipped),与报告逐字一致 |
| `keepMine()` 顺手插入 `form.body = 'MUTATION-OVERWRITE'` | ✅ 报红(`expected 'MUTATION-OVERWRITE' to be '<原 body>'`)——**确认 keepMine 现状代码没有顺手覆盖 body**,且该断言有真实判别力 |

三次变异均已用 `cp` 备份还原,`md5sum` 与备份逐字节一致(`.vue` 基线 `173b677139d9656a29c77e0fe13e6314`),
`git status --porcelain` 全程干净,复跑对应用例/全量 `knowledgeStyles.test.ts`(294 passed)均确认复绿。

## 其余核验

- **mock 出处**:`NOTE_FIXTURE` 与 `.superpowers/sdd/p5d-fixtures/notes-get-one.json` 逐字段比对
  (camelCase 化)完全一致。`backlinks` 契约:`NimoOS-Service/src/notes.ts:247-249`
  `return (res.data.backlinks as unknown[]) || []` —— 确认是**裸数组**,不是 `{backlinks:[]}` 信封;
  测试里 `notes.backlinks.mockResolvedValue([])` 与非空构造(`README §4` 已载明本机 `source_refs` 恒非空、
  `backlinks` 恒空,`sourceRefs.path` 分支/`backlinks` 非空分支本机无真实样本、按 K41 接口最小构造)均已
  在测试注释里声明取证依据,判定合规。
- **K41 字段依据**:蓝本行号逐一核对(`git show 7a6ee6b7:… | cat -n`):`:128` 读 `r.path`、`:131` 读
  `r.session_id`、`:132` 经 `refLabel(r)` 读 `r.label`、`:139` `:key="b.id"`、`:141` `b.title`——全部对得上。
  `grep "as any"` 全文件零真实用法(3 处命中都在注释里声明「禁 as any」)。
- **附录 B**:`NoteEditPane.vue:152` → `--warning-soft` 是附录 B §B.4 第 35 行给定的唯一权威映射,
  代码落地一致。
- **i18n**:抽查全部 T8 新用到的 29 个 `aiKbNe*`/`aiKb*` 键,zh/en 两档各恰好 1 处声明,zh 值与
  `git show 7a6ee6b7:src/assets/lang/zh_CN.json` 逐字比对全部一致(抽查 18 个代表性键无一处差异)。
- **K36 强度对齐 T6**:测试直接读 `.k-modal-title` 元素自身 `.id` 比对 `aria-labelledby`,并加
  `modal.querySelectorAll('[id]').toHaveLength(1)` 排除多节点退化 —— 与 T6 `NotesView.test.ts` 同一强度,
  非仅比字符串值。
- **reka 结构对齐 `SettingsView.vue`**(非 `QueueView.vue`):`DialogPortal to=".knowledge-app" defer` +
  `DialogTitle as-child` 直接核对与 `SettingsView.vue:581/587` 一致。
- **clipboard**:`grep execCommand` 只命中注释(声明的前端票原文),产品代码零 `execCommand` 兜底,
  照蓝本 `:259-264`/`:310-315` 裸 try/catch。
- **代码膨胀(+410 行)**:逐块核对来历——文件头 T8 大节登记注释(~100 行)+ K41 两接口/两 computed
  (~25 行)+ 12 个新函数(含逐条蓝本行号注释,~150 行)+ 侧栏 5 卡与冲突弹窗模板(~90 行)。
  未发现无关重构/顺手抽象;逐函数与蓝本行号一一对应。
- **三门/算式**:自跑 `Test Files 331 passed / Tests 3958 passed`、`vue-tsc` 0、`vite build` 0,
  `.vue`=182(`find … -name "*.vue" | wc -l`)、测试文件=331,与报告算式(3923+35=3958)一致。

## 发现(Critical / Important / Minor)

无 Critical、无 Important。

- **Minor**:`p5d-fixtures/` 里 `sourceRefs.path` 分支与 `backlinks` 非空分支本机确无真实抓取样本
  (README §4 已载明),测试按 K41 接口最小构造并逐条声明取证依据 —— 与治理 §4.1「禁手编信封」的口径
  不冲突(信封层次仍是已归一化数组,只是数组元素内容非真机样本),但建议后续任一刀若有机会拿到真实
  非空 `backlinks` 抓取,补一次真实样本替换构造值(不阻塞本刀)。

## ⚠️ 无法核验项

- 未做真机可点性验收(§9.9 清单由 T10 之后协调者统一出),本评审只核了单测/类型/构建三门 + 源码 + 变异。
- `.k-tagedit`/`.kn-refbtn` 等交互在真实浏览器下的视觉/可点性未验,仅验证了 jsdom 下的行为契约。
