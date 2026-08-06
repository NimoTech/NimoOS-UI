# P5d · T1 任务 brief —— i18n(92 新键 + 7 复用 + 八组撞车的 en 断言)

> **权威优先级:`p5d-coordinator-rulings-T0.md`(R1–R14)> `p5d-common-constraints.md` + P5a/P5b/P5c 治理 >
> `p5d-appendix-A-i18n.md` > `p5d-plan.md` > 本 brief。**
> 🔴 **T0 已把治理文件里 12 处错查实并订正(E-31 ~ E-42)。凡治理与裁定书/附录 A 冲突,一律以后者为准。**

## 0. 必读顺序

1. `.superpowers/sdd/p5d-coordinator-rulings-T0.md` 全文(**最高,先读**)
2. `.superpowers/sdd/p5a-common-constraints.md` → `p5b-` → `p5c-` → **`p5d-common-constraints.md`** 全文
3. `.superpowers/sdd/p5d-plan.md` 的 **§0 开工必读** 与 **§T1**
4. 🔴 **`.superpowers/sdd/p5d-appendix-A-i18n.md` 全文** —— 本刀的**值来源**
5. 本 brief

路径相对 `/home/nimo/NimoTech/.sp8/NimoOS-New-UI/`。**计划书 §T1 的 DoD 1–8 是你的验收口径,逐条兑现、逐条在报告里回答。**

## 1. 坐标

| | 值 |
|---|---|
| 可写仓 | `/home/nimo/NimoTech/.sp8/NimoOS-New-UI`,分支 `sp8-ai` |
| **起点 HEAD** | **`03db682`**(T0 已关账:`cc6d7c8` 产出 + `03db682` 修复轮 1;独立评审与范围收窄复审均已 clean) |
| 蓝本 | `NimoOS-UI`@**`7a6ee6b7`**,一律 `git -C /home/nimo/NimoTech/NimoOS-UI show 7a6ee6b7:<path>` 读。**禁读该仓工作树**(签出的是 07-15 旧分支)· **永远禁 `checkout`/`stash`/`reset`** |
| 改 | `src/i18n/zh_cn.ts` · `src/i18n/en_us.ts` · `src/i18n/messageSyntax.test.ts` |
| 新建 | `.superpowers/sdd/p5d-task-1-i18n-verify.mjs`(照 `p5c-task-1-i18n-verify.mjs` 写) |
| 文件数 | **零 `.vue`、零测试文件新增 → 仍 326**(`.superpowers/` 不参与计数) |
| 三门基线 | **326 文件 / 3515 例 / `vue-tsc` 0 / `vite build` 0**(T0 已两次坐实) |
| 其它基线 | 全表键数 **1503**(真实模块导入)· `aiKb*` **295** · `.vue` **179** · `KIcon.PATHS` **42**(不是 43,E-35) |

## 2. 🔴 T0 查实的、**直接改写你这一刀做法**的四条

**这四条是本刀最容易假绿的地方 —— 照治理原文做会当场红、或者三门全绿但英文界面错。**

1. **R10 / E-31 —— en 的权威源是 `en_US.json`,不是 `$t()` 的 key。**
   前三期 T0 都测出「`en_US.json` 零覆盖」,所以治理只规定了 zh 权威、en 按「= 英文原串」处理。
   🔴 **本期 `en_US.json` 真有 2 条覆盖**:`this cannot be undone` → **`this cannot be undone.`**(多句点)·
   `Note item` → **`Note`**(整词不同)。Vue2 的默认 locale 与 fallback locale **都是 `en_us`**
   (`src/plugins/i18n.js:9-10`)→ **英文界面渲染的是覆盖值**。
   → **这 2 条 en 填覆盖值**,各配 **en 正向断言 + 反向断言(≠ `$t()` 原串)**;
   **verify 脚本的 en 侧不许再假设「en = JSON key」。**
2. **E-32 —— 全角标点例外只有 1 条,治理点名的 3 条全是假阳性。**
   治理 §7(a) 点名的三组(`,还不是正式知识` / `一句话摘要(用于列表与搜索展示)` /
   `只是暂时不需要的话,建议改用「归档」。`)逐码点实测:那些逗号是 **U+002C**、括号是 **U+0028/U+0029**
   —— **这份语言包的中文文案一律用半角逗号/括号**。
   92 个 zh 值里能被 `/[，；：？！（）]/` 命中的**只有 1 条**:
   **`aiKbNtDeleteTitle` = `删除该笔记？`**(`？` = U+FF1F)。
   → 🔴 **例外清单 = 1 条**(附录 A §A.5 是权威)。**照治理那份写 `toBe` 强断言会当场红 3 条。**
   ⚠️ `。` / `「」` / `·` / `—` / `…` / `×` **不在**那个正则里,别把它们当例外。
3. **R3 / C-1 —— 附录 A 的值只许从 §A.2 抄,不许从 §A.4 抄。**
   §A.4 是 labelKey 归属核对表,它的 zh 列**曾经有 5 个自译值**(T0 修复轮已订正并加了「zh 以 §A.2 为准」)。
   🔴 **§A.2 的 92 行经两轮程序化逐字比对、zh/en 双列零 mismatch —— 它是唯一值来源。**
4. **E-42 —— 行号以 T0 报告 §2 为准**(治理若与它冲突,信 T0)。

## 3. 本刀最容易翻车的三处(计划书已点名,这里加权)

1. 🔴 **八组撞车必须配 en 正/反向断言 —— 只比 zh 的断言零判别力。**
   P5c §9.2 实测:把断言换成被禁的键,**47/47 全绿**。最容易被「顺手复用」的三个:
   `aiKbNavNotes`(同区、zh 都是「笔记」)· `aiOpenInFileManager`(en 只差首字母大小写)·
   `filesCopiedPath`(**en 同、zh 不同**,镜像方向)。
   ⚠️ **N32-8 是 P5d 自己内部的撞车**(`Source` 与 `Sources` zh 都是「来源」)→ **两个键都要建。**
2. 🔴 **K42:4 个相对时间键必须新建,不许复用 `aiKbMinAgo`/`aiKbHrAgo`/`aiKbDaysAgo`。**
   它们的占位符名是 **`{m}`/`{h}`/`{d}`**(`indexedFilesView.ts:53-57`),蓝本用 **`{n}`** →
   复用会**渲染出字面量 `{n}`**。唯一可复用的是 `aiKbJustNow`。
   **落地判据:一条「渲染出真实数字而非字面量 `{n}`」的用例 + 一条反向断言(≠ 既有键的 en 值)。**
3. 🔴 **复跑双向撞车扫描,并用真实模块导入计键数**(基线 1503)。
   **假定协调者给的 8 组不完整** —— P5c 连续三刀每刀都扫出协调者不知道的。
   新扫出的补进附录 A §A.7 并同样配 en 断言。

## 4. 明确不做的

- **N23 / N22 家族:不许给技术串补 i18n 键。** 本期至少 3 处照抄成**裸字符串**:
  `conflictMessage` 的英文串(N23,只当布尔谓词用)· `NoteEditPane.vue:56` 的 `Markdown` 按钮文字 ·
  `:68` 的 `WYSIWYG` / `.md source`。
- **零产品组件**:本刀不碰任何 `.vue`、不碰 `src/ai/**`、不装依赖。
- `messageSyntax.test.ts` 的三条守卫**只圈本批 92 键**,**不许全量生效**。
- 🔴 **禁部署**、禁写 `/var/lib`、禁 `git push`/`rebase`/`reset`/`stash`/`merge`、禁 `git add -A`/`git add .`。
- 🔴 别碰 `/home/nimo/NimoTech/NimoOS-New-UI` 与 `/home/nimo/NimoTech/.sp7/NimoOS-New-UI`(**并发会话**)。
- 🔴 `.sp8/NimoOS-Service` 本期零改动;**T0 已核 `dist` 与 `src` 一致 → 不需要跨仓 `pnpm build`**(裁定 R12)。

## 5. 三门(提交前必须全过,**全量、输出完整落盘、不许 `| tail`**)

```bash
cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI
pnpm test                      > /tmp/p5d-t1-test.log  2>&1; echo "exit=$?"
pnpm exec vue-tsc --noEmit     > /tmp/p5d-t1-tsc.log   2>&1; echo "exit=$?"
pnpm build                     > /tmp/p5d-t1-build.log 2>&1; echo "exit=$?"
```

报告贴 `Test Files` / `Tests` 两行。**已知噪声**(只它们红才复跑一次并说明,**不要顺手改**):
`src/files/upload/persist.test.ts > … dropPersisted removes record + blob and frees budget`(IndexedDB flaky)·
`AgentComposer.test.ts` 的 vue-i18n teardown 竞态。
**包管理器 `pnpm`**,勿用 yarn/npm。

## 6. 报告契约

- 全文写 `.superpowers/sdd/p5d-task-1-report.md`(治理 §10 契约照用)。
- 必须含:计划书 §T1 **DoD 1–8 逐条** · **verify 脚本的两段输出**(92/92 MATCH + 7/7 MATCH)·
  「复用 7 / 新增 92 / Vue2 有权威 zh 值 92 / 本期新造 0 / **死键 N 条(逐条列出)**」·
  **双向撞车复扫结果**(新扫出的组 + 是否配了 en 断言)· **命中的每一条 K/N 编号申报** ·
  凡计划书写「必配 RED 探针」的,贴**两段输出**(报红 + 还原后转绿)+ `git status` 干净证明。
  🔴 **探针还原禁用 `git checkout -- <path>` / `git restore`**(会连未提交编辑一起抹掉)——
  只许「先存副本 → 注入 → 用副本覆盖 → md5 比对」;**注入要行首锚定并先证注入真落盘**。
- **返回给协调者 ≤ 20 行**:状态 · 提交 sha · 三门四个数字 · 92/92 与 7/7 是否 MATCH ·
  新扫出的撞车组 · 死键条数 · 遗留 `NEEDS_CONTEXT`。
- 拿不准 → 写 `NEEDS_CONTEXT` 并**停下**,不要自己拍。

## 7. 提交

**一刀 = 一个语义提交**(`feat(i18n): …` 或本档习惯前缀)。台账/脚本 `git add -f` 具体路径。
提交后 `git show --stat HEAD` + `git status` 自查。
