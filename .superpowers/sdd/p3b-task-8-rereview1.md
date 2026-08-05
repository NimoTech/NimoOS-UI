# SP8-P3b Task 8 —— 修复轮 1 范围内复审

范围:`5fd5f19`..`f6792a8`(单一提交 `f6792a8`,只改
`src/ai/components/settings/sections/SkillsSection.test.ts`,38 insertions / 6 deletions,
未改任何生产代码文件)。

工作目录 `/home/nimo/NimoTech/.sp8/NimoOS-New-UI`,分支 `sp8-ai`。复审全程未提交,两次 RED
探针改动均已用 `cp` 精确还原并以 `git diff --stat` / `git status --porcelain` 确认空 diff。

---

## Finding 1 —「删非选中项时 activeId 不变」用例无判别力

**判定:ADDRESSED**

新 fixture 改成三项 `[a, b, c]`,先点击 `.sk-item[2]` 切到 `c`,再对 `b` 发 `delete`。
删完剩 `[a, c]`:
- 条件生效(`if (activeId.value === id)` 只在删的是当前选中项时才回落):`activeId` 仍是 `c`。
- 条件被删/无条件回落 `skills.value[0]`:`activeId` 会错误跳成 `a`。

两种实现在此 fixture 下必然分道,不再是原来「删完剩 `[a]`,两种实现结果碰巧相同」的空转用例。

**我自己重做的 RED 探针**(不采信报告贴的输出,直接编辑仓库文件验证):

把 `src/ai/components/settings/sections/SkillsSection.vue` 的 `onDelete` 里
```ts
if (activeId.value === id) {
  activeId.value = skills.value[0]?.id ?? null
}
```
改成无条件
```ts
activeId.value = skills.value[0]?.id ?? null
```
跑 `pnpm vitest run src/ai/components/settings/sections/SkillsSection.test.ts`:

```
Test Files  1 failed (1)
     Tests  1 failed | 22 passed (23)
 × 删的不是当前选中项时 activeId 不变,详情面板仍显示原选中的技能
   AssertionError: expected 'Skill A' to be 'Skill C'
```

**精确报红,只这一条,其余 22 条不受影响**——与报告贴的输出一致。已用 `cp` 还原原文件,
`git diff --stat` / `git status --porcelain` 确认空 diff。

---

## Finding 2 — `onTest` 隔离用例的同类缺陷(实现者自查追加)

**判定:ADDRESSED**

原版只在默认选中项 `a`(恰好是 `skills[0]`,index 0)上调用一次 `test()`,再切到 `b` 断言
`b` 没被污染——若 `onTest` 里 `findIndex(...)` 被错写成硬编码 `idx = 0`,由于 `a` 恰好就是
index 0,断言值不变,原版测试抓不到。修复补了一段:切到 `b`(index 1)后**再调用一次**
`test()`,断言改的是 `b` 而不是 `a`;并追加切回 `a` 确认它没被第二次调用误伤。

**我自己独立设计的最小破坏**(不是照抄报告的破坏方式,同类但独立验证):把
`onTest` 的
```ts
const idx = skills.value.findIndex((s) => s.id === activeId.value)
```
直接改成 `const idx = 0`(去掉「只改当前选中项」这个限定,恒定改第一项)。跑同一测试文件:

```
Test Files  1 failed (1)
     Tests  1 failed | 22 passed (23)
 × onTest:只改当前选中项的 calls/last_used,不影响其它技能(乐观本地值,不落库)
   AssertionError: expected '— · 共 5 次' to contain 'Just now'
```

**精确报红,只这一条,其余 22 条不受影响**——断言在 `b` 是当前选中项时检查 `.val` 含
`'Just now'`,硬编码 `idx=0` 的实现改的是 `a` 不是 `b`,`b` 的 `.val` 仍是初始值,断言如实
报红。证明该用例现在对「idx 恒定/未跟随 activeId」这类回归有判别力。已用 `cp` 还原,
`git diff --stat` 确认空 diff。

---

## Finding 3 — 报告「新增 17 条」口误

**判定:ADDRESSED**(纯文档,不涉代码)

`grep -n "17 条\|12 条" .superpowers/sdd/p3b-task-8-report.md` 命中三处,全部是「12 条」
(`:36`、`:89`、`:215` 的处置说明),未再出现「17」。与实测的新增用例数(23 - 11 原有 =
12)一致,与总数 2554（2542 + 12）算术一致。

---

## Finding 4 — D4↔onToggle 跨组件整合测试缺口

**判定:skipped(按指示)**——协调者已明确本轮不做(超范围,需挂真实组件树 + reka
Teleport)。报告「Minor 处置」第 2 条已如实记录为「记入台账留终审 triage,本轮未做」,
未谎报为已解决。不因该缺口仍存在而判 NOT ADDRESSED。

---

## 修复 diff 内的新破坏排查

逐行核对 `f6792a8` 的 diff(6 处删除、38 处新增):

- 「删非选中项」用例:删除的 2 行断言(`toHaveLength(1)` / `toBe('Skill A')`)被替换为
  与新 3 项 fixture 匹配的等价断言(`toHaveLength(2)` / `toBe('Skill C')`)——数值随
  fixture 改变而改变,**语义未被削弱**,断言覆盖的维度(列表长度 + 选中态)与改前完全一致。
- 「onTest」用例:改前的全部断言原样保留,新增的是**追加**在其之后的第二轮
  `test()` 调用 + 3 条新断言,没有删除或改动任何一条既有断言。
- 两条用例都用局部 `makeSkill(...)` 内联构造 fixture,不存在跨用例共享的可变 fixture
  对象;grep 全文件 `makeSkill` 调用点确认每条用例都是独立构造,**同档其它 10 条用例未
  受这次 fixture 改动连带影响**(各自的 `h.listSkills.mockResolvedValue([...])` 互不共享)。

**结论:无新破坏,无削弱既有断言。**

---

## 实测数字

```
pnpm test
 Test Files  296 passed (296)
      Tests  2554 passed (2554)
```

与报告贴的终值完全一致。（未额外跑 `vue-tsc`/`build`,本轮修复只改了 `.test.ts`，
不影响类型检查与构建。）

---

## 总判定

**PASS。** 4 条 finding 全部 ADDRESSED / 按指示 skipped,两次 RED 探针均由复审者独立
重做且精确命中（各改动后 23 例仅 1 例报红，其余 22 例不受影响），修复 diff 内未发现
削弱既有断言或引入新问题。P3b Task 8 修复轮 1 可以关账。
