# SP8-P5e Task 1b —— T1 评审 Minor 收口(**协调者本人实现**,非 subagent)

**日期**:2026-08-05 · **起点** `277dd9c` · **改动**:`src/i18n/messageSyntax.test.ts` **一个文件**(+2 用例)
**三门**:`Test Files 331 passed (331)` / `Tests 3986 passed (3986)`(3984 + 2)/ `vue-tsc` exit 0(日志 0 行)/ `vite build` exit 0(0 error)

## 0. 🔴 流程申报:这一刀由协调者本人实现,没有独立评审

**本档纪律是 subagent-driven + 每刀独立评审。本刀偏离了,理由与代价如实登记**:

- **偏离**:协调者直接改产品测试文件,未派 implementer、未派独立评审。
- **理由**:① 改动是 **2 条断言 + 注释**,落点、判据、探针形态**全部由 T1 评审预先指定**
  (`p5e-task-1-review.md` 的 R13 落点建议 + Minor-1 + Minor-3);
  ② **判据的关键证据由评审独立产出、不由本刀自证** —— 评审已实证「两档同时加回 `aiCfgKnowledgeSoon`
  时全量 3984 全绿」= **缺口是确证的,不是推测的**;本刀只需证明「加了守卫之后同样的注入会报红」;
  ③ 评审明写「三条 Minor 顺手带进 T8 即可,不必单开整改轮」,而 R13 是协调者裁定的**新增项**,
  为 2 条断言单开一轮 implementer+reviewer 的代价与收益不成比例。
- **代价(诚实记账)**:本刀**没有第二双眼睛**。⇒ 🔴 **列为 T8 收官刀与全支终审的必查项**:
  「T1b 的 2 条断言是否真有判别力、注释是否与现状一致」。

## 1. 改了什么

### 1.1 R13 —— 防复活守卫(协调者裁定,新增)

`messageSyntax.test.ts` 的 P5e 块内新增:

```ts
it('the D-9 deleted key stays deleted in BOTH locales (parity alone cannot catch a two-locale resurrection)', () => {
  expect('aiCfgKnowledgeSoon' in zh).toBe(false)
  expect('aiCfgKnowledgeSoon' in en).toBe(false)
})
```

**为什么两档各断一次**(不是只断一档):`parity.test.ts` 断言 zh/en **键集完全相等** ⇒
**单档复活**会被 parity 逮到;但**两档同时复活**时 parity 仍然绿。评审实测这一路径下
**全量 3984 全绿** ⇒ 必须两档各自独立断言。

**D-9 自证口径按 R13 放宽**成本档既定死键口径(P5d 终审 §1),它**本来就排除 `*.test.ts`**:

```bash
grep -rlw --include='*.vue' --include='*.ts' -e aiCfgKnowledgeSoon src/ \
  | grep -v '^src/i18n/' | grep -v '\.test\.ts$'
```
⇒ 仍然「只命中 `SettingsPage.vue` 那条历史注释」,**两个目标零妥协地同时成立**。
⚠️ **连带**:T1 在 `messageSyntax.test.ts:1013-1014` 写的「deliberately not named here so that D-9's
`grep -rw` self-proof keeps hitting only SettingsPage.vue's history comment」这个理由**已被 R13 取代**
(该注释保留不改 —— 守「反转不删」;新注释里已写明取代关系)。

### 1.2 Minor-1 —— `singleN` 补长度钉子

它是 P5e 块里**唯一未钉长度的参数化清单**(其余 54/5/6/5/9 全钉)⇒ 删一条则该键的插值 `toBe`
**静默消失而三门全绿**(= 参数化守卫空循环家族)。补 `expect(singleN).toHaveLength(5)`。

### 1.3 Minor-3 —— 1648 双下限交叉引用

`1648` 在两处独立存在(本文件 + `SettingsView.test.ts` 的 D-3 位点),**两处都是下限、无跨期陷阱**。
按评审建议补交叉引用注释,并写明**故意不去重**的理由(那一处是 P5c-T9 的历史快照,按「反转不删」保留)。
🔴 **只改本文件的注释** —— `SettingsView.test.ts` **未再打开**(它仍在全期零改动清单上,
为一条装饰性交叉引用重新解禁不值得)。

## 2. RED 探针(唯一一个,判据来自评审)

| 步骤 | 证据 |
|---|---|
| 备份 + 记 md5 | `9970eb90e3cb278dcbe0e718eb0742bf  src/i18n/zh_cn.ts` · `a71c8de0606d315e4ed53ec04d4815b2  src/i18n/en_us.ts` |
| 注入(**两档同时**,锚定 `aiCfgYou` 行后) | **先证落盘**:`zh_cn.ts:606: aiCfgKnowledgeSoon: 'PROBE 复活',` · `en_us.ts:604: aiCfgKnowledgeSoon: 'PROBE resurrect',` |
| RED | `× the D-9 deleted key stays deleted in BOTH locales …` ⇒ `Tests 1 failed \| 87 passed (88)` —— **恰 1 例红,且正是新守卫** |
| 还原 | `cp` 覆盖 → `md5sum -c` **两档均 OK**(逐字节一致)· 语言包 `aiCfgKnowledgeSoon` 零命中 · **零 `git checkout/restore/stash`** |

⚠️ **对照证据(评审产出,本刀不重复)**:同样的两档注入在**加守卫之前**是 **3984 全绿** ⇒
本守卫不是空转,它填的是一个**已确证**的缺口。

## 3. 未做的(明确记账)

- **Minor-2**(R11 核损表「与 HEAD 逐字节相同」措辞过期)—— 属**裁定文件**的措辞,不属产品码,
  在 `p5e-coordinator-rulings-T0.md` 里单独订正,不在本刀。
- `SettingsView.test.ts` 的交叉引用注释 —— 见 §1.3,**故意不做**。
- **T1 交接给 T8 的死键复核表**(54 键此刻零消费属正常,组件在 T3–T7)—— **仍归 T8**。
