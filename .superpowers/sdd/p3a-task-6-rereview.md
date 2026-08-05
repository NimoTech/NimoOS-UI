# SP8-P3a Task 6 —— 修复轮 scoped 再评审

范围:只评审修复 diff `1a2fec1..9e5c17b`(`SkillsSection.test.ts`,65 insertions / 16 deletions)。
不采信实现者报告结论,全部自己重跑/重新做 RED 探针。

## A. 首轮 Important(「搜索三字段过滤」测试盲区)判定:**ADDRESSED**

修复把原单一用例(共享词 `'FAMILY'` 只命中 `description`)拆成三条独立用例,配
`threeFieldFixture()`:三个技能各带一个**唯一 token**,分别只出现在
`by-name.name`(`orion-alpha-token`)/ `by-title.title`(`Zephyr-Beta-Token`)/
`by-desc.description`(`nebula-gamma-token`),互不为彼此子串,也不出现在另外两个
技能的任何字段里。

**独立 RED 探针(未参考实现者报告的探针记录,自己动手,`git diff` 逐次确认精确还原)**:

1. 删 `filtered` 里 `s.name` 分支(保留 title/description)→ **只有**「搜索命中 name
   字段」1 例报红,10 例绿(`expected [] to have a length of 1 but got +0`)。还原后
   `git diff` 为空。
2. 删 `filtered` 里 `s.title` 分支(保留 name/description)→ **只有**「搜索命中 title
   字段」1 例报红,10 例绿。还原后 `git diff` 为空。
3. 删 `filtered` 里 `s.description` 分支(保留 name/title)→ **只有**「搜索命中
   description 字段」1 例报红,10 例绿。还原后 `git diff` 为空。

三次探针,三个字段分支各自独立、精确地被单独一条用例捕获,互不干扰。判据满足:
`name`/`title`/`description` 各有独立用例,关键词不在另外两字段命中,盲区已消除。

## B. 修复 diff 内的新破坏排查:**未发现**

- **生产代码未动**:`git show --stat 9e5c17b` 只含 `SkillsSection.test.ts`
  一个文件;`git diff HEAD~1 -- src/ai/components/settings/sections/SkillsSection.vue`
  为空。确认属实。
- **16 行删除逐行核对**:全部集中在替换旧的单一「三字段搜索」用例(`makeSkill`
  fixture 8 行 + `it(...)` 包裹 4 行 + 断言 3 行 + 空行)。删除处均被等量或更强的
  新断言取代(三条独立 `it`,每条都保留「过滤后剩 1 条 + 命中项 name 精确匹配」的
  同等断言强度,其中一条还额外验证了过滤前 3 条全显示)。**没有发现断言被单纯删除
  或弱化而未被替代的情况**——mount 测试那一段的改动只有 `+`,没有 `-`,是纯新增。
- **自认的顺手修复(mount 测试 props 断言)也做了独立 RED 探针**:互换
  `builtIn`/`personal` 的 filter 条件(`s.system` ↔ `!s.system`)。单独跑该用例
  (`-t "挂载即加载"`)精确报红:`expected ['mine-b'] to deeply equal ['built-a']`。
  跑全文件时该破坏额外牵连了另一条无关用例(「点条目切换 activeSkill」,因为它也用
  `system: true/false` 两个技能且按 DOM 下标点击第二项,组顺序一变连带受影响)——这
  是探针本身波及面广的正常副作用,不影响新增断言自身的判别力;隔离运行确认新增的
  props 断言精确捕获目标缺陷。已确认这处改动确实提升了判别力(此前只查分组标签文案
  + 总数,互换后旧断言集合仍会绿)。还原后 `git diff` 为空。
- **mock 形状纪律**:全文件 mock 调用仍一律裸数组(`h.listSkills.mockResolvedValue([...])`),
  唯一例外是既有的、故意验证 `{ data: [...] }` 口径的用例(未被本次 diff 触碰,不在
  修复范围内,仍保持"反向"验证单层取数口径的原有设计)。

## 范围外观察(deferred,不展开)

- probe 4(builtIn/personal 互换)在全文件跑时会连带波及「点条目切换 activeSkill」,
  提示该用例的选取方式(按 DOM 下标而非按技能身份选择)本身耦合了分组/渲染顺序,
  非本次评审范围,列此存档。

## 实测测试数字

- `SkillsSection.test.ts` 单文件:11 passed (11)(baseline,revert 后)。
- 全量 `pnpm test`:**291 files passed / 2407 tests passed**,exit=0,与实现者报告
  一致。
- `git status` 于本次再评审结束时干净(4 次 RED 探针均已逐次精确还原并以
  `git diff`/`git status` 确认)。
