# P5d · T5 任务 brief —— `openInApp.ts` 补两函数(§16)+ 票 3 守卫债(§15.3)

> **权威优先级:`p5d-coordinator-rulings-T0.md`(R1–R15)> `p5d-common-constraints.md` + P5a/P5b/P5c 治理
> > `p5d-plan.md` > 本 brief。** 🔴 **治理已查实有 15 处错(E-31 ~ E-45),冲突处信裁定书。**

## 0. 必读顺序

1. `.superpowers/sdd/p5d-coordinator-rulings-T0.md` 全文(**最高**)
2. `p5a-common-constraints.md` → `p5b-` → `p5c-` → **`p5d-common-constraints.md`** 全文
   (**§15.3 票 3** · **§16 openInApp** · **§9.6 守卫** · **§6.5**)
3. `p5d-plan.md` 的 **§0 开工必读** 与 **§T5**
4. 本 brief

路径相对 `/home/nimo/NimoTech/.sp8/NimoOS-New-UI/`。**计划书 §T5 的 1–8 条是你的验收口径。**

## 1. 坐标与基线

| | 值 |
|---|---|
| 可写仓 | `/home/nimo/NimoTech/.sp8/NimoOS-New-UI`,分支 `sp8-ai` |
| **起点 HEAD** | **`cb73071`**(T0–T4 **五刀全部关账、评审 clean**) |
| 蓝本 | `NimoOS-UI`@**`7a6ee6b7`**,`git -C /home/nimo/NimoTech/NimoOS-UI show 7a6ee6b7:<path>`。**禁读该仓工作树** · **永远禁 `checkout`/`stash`/`reset`** |
| 改 | `src/ai/services/openInApp.ts` · `openInApp.test.ts` · `src/ai/styles/knowledgeStyles.test.ts` |
| 文件数 | **零新建文件 → 仍 329** · `.vue` 仍 **180** |
| 🔴 **三门基线(T4 后)** | **329 文件 / `3607` 例** · `vue-tsc` 0 · `vite build` 0 |
| 其它基线 | 全表键数 **1595 / 1595** · `aiKb*` **387** · `KIcon.PATHS` **42**(E-35) |

🔴 **本刀是「加强守卫 + 补两个纯函数」——`src/` 下非测试文件的产品逻辑改动只有 `openInApp.ts` 那两三个新导出。**
**报告必须证明这一点。**

## 2. 半一:`openInApp.ts`(治理 §16)

1. **`openDirInNewTab(dirPath)`** —— **逐字照抄蓝本 `:52-55`**;`filesPathUrl` 用**本仓既有的那个**(`:41-43`)。
   🔴 **既有 7 个导出一字不动。**
2. **`agentSessionUrl(sessionId)` + `openAgentSessionInNewTab(sessionId)`** ——
   🔴 **按裁定 A-8 指向旧 Vue2 应用 `/#/ai/agent?session=…`(无 `/app` 前缀)。**
   **理由**(实测):New-UI 的 `AgentPage`/`agentStore` **零 `?session=` 读取**,指向 `/app/#/ai/agent?session=X`
   会**静默失效**;Vue2 `Agent.vue:129/164/212` 真的读它。
   → **加与 `photosAssetUrl`(`:37-39` + 文件头 `:5-9`)同款的申报注释。**
   🔴 **测试:URL 逐字断言 + 反向断言「不等于 `/app/#/ai/agent?session=…`」**
   —— 否则将来有人「顺手统一前缀」会**静默退化**。
3. **`!dirPath` / `!sessionId` 的早退两侧都要用例**(`window.open` **不被调用**)。
4. ⚠️ 🔴 **不许连 `openNoteInNewTab`(蓝本 `:112-115`)一起补** —— **本期无调用点,补了就是死代码。**
   **登记进 P5e/P5f 交接项。**
5. **开一张票**(写进报告,协调者会收进台账):**New-UI Agent 页补 `?session=` 深链**(A-8)。

## 3. 半二:票 3 守卫债(治理 §15.3)—— **本刀的判别力重心**

6. 🔴 **具名色扫描** —— 中央 ③′ 守卫与 `color-guard.test.ts` **都不扫 CSS 具名色**。
   **必须钉「属性值位置」**:只在 `color:` / `background:` / `background-color:` / `border-color:` / `border:` /
   `box-shadow:` / `fill:` / `stroke:` 等的**值**里找,**排除复合属性名与连字符词**。
   🔴 **RED + 反向探针两头验**:
   - ① 塞 `color: white` → **必须报红**;
   - ② **`QueueView.vue:474` 的 `white-space: nowrap` → 必须不报红**(治理 §6.5 点名的冤枉点)。
   **两头都过才算这条守卫成立** —— 只验一头会做出一条「逮不住真违规」或「天天误报」的守卫。
7. 🔴 **覆盖范围扩到 `src/ai/components/**`** —— 中央 ③′ 现在只覆盖 `src/ai/knowledge/**`。
   ⚠️ **扩范围可能扫出既有违规**(那些文件是 P2a/P2b 的产出、**不在本期范围**)。
   🔴 **若真扫出:停下写 `NEEDS_CONTEXT` 给协调者,不要自己改 `src/ai/components/**` 里的任何文件。**
8. **报告要证明 `src/` 下非测试文件除 `openInApp.ts` 外零改动。**

## 4. 常驻纪律与禁止事项

- 🔴 **探针/变异还原禁用 `git checkout -- <path>` / `git restore`** —— 只许「先 `cp` 存副本 → **行首锚定**注入 →
  **先证注入真落盘** → 用副本覆盖 → `md5sum` 逐字节比对」。**注入撞注释会伪造出「守卫无效」的假结论。**
- 🔴 **凡 DoD 里带 🔴 的「复跑 / 复扫 / 独立复核」项,不许用「采信上一刀的结论」替代;
  要跳过必须先停下写 `NEEDS_CONTEXT` 申报 —— 事后在报告里写一句不算申报。**
- ⚠️ **代码膨胀会被评审逐行追来历**(T3/T4 都被查过,两次都干净):TS 类型标注与 K 系列申报注释正当,
  **蓝本没有的新逻辑 / 被"修正"的行为 / 顺手抽的抽象 = 缺陷**。
- **移植纪律**:行为严格 1:1;Vue2 的 bug/竞态/吞错不照抄但要按治理 §3 **申报登记**;**禁无关重构**。
- **零 `any`**;`vue-tsc` 0。只有 **K1–K45** 登记过的偏离才许做;**照抄不改**的是 **N1–N32**;其余**先申报再做**。
- 🔴 **禁部署**、禁写 `/var/lib`、禁 `git push`/`rebase`/`reset`/`stash`/`merge`、禁 `git add -A`/`git add .`。
- 🔴 别碰 `/home/nimo/NimoTech/NimoOS-New-UI` 与 `/home/nimo/NimoTech/.sp7/NimoOS-New-UI`(**并发会话**)。
- 🔴 **不要 kill 或重起任何 dev server**(`:5288` 由协调者维护,当前在监听;`:5277`/`:5299` 属别的并发会话)。
  本刀不装依赖。
- `.sp8/NimoOS-Service` 零改动;**不需要跨仓 `pnpm build`**(裁定 R12)。
- **不碰** `src/i18n/**`(T1)· `src/ai/styles/knowledge.scss`(T2,**但 `knowledgeStyles.test.ts` 本刀要改**)·
  `src/ai/knowledge/util/**`(T3)· `NotesMarkdownEditor.*`(T4)。

## 5. 三门

```bash
cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI
pnpm test                      > /tmp/p5d-t5-test.log  2>&1; echo "exit=$?"
pnpm exec vue-tsc --noEmit     > /tmp/p5d-t5-tsc.log   2>&1; echo "exit=$?"
pnpm build                     > /tmp/p5d-t5-build.log 2>&1; echo "exit=$?"
```

**全量,输出完整落盘,不许 `| tail`。** 报告贴 `Test Files` / `Tests` 两行 +
**「3607 + 本刀新增 N = 实测值」的算式**(文件数应仍 **329**)。
**已知噪声**(只它们红才复跑一次并说明,**不要顺手改**):`src/files/upload/persist.test.ts > … dropPersisted …`
(IndexedDB flaky)· `AgentComposer.test.ts` 的 vue-i18n teardown 竞态。包管理器 **`pnpm`**。

## 6. 报告契约

- 全文写 `.superpowers/sdd/p5d-task-5-report.md`。**返回给协调者 ≤ 20 行。**
- 必须含:计划书 §T5 **1–8 条逐条** · **具名色守卫的两头探针各贴输出**(`color: white` 报红 /
  `white-space: nowrap` **不**报红)+ `md5` 比对 · **扩范围到 `src/ai/components/**` 的扫描结果**
  (**扫出既有违规就停下报 `NEEDS_CONTEXT`**)· **`agentSessionUrl` 的正向 + 反向断言** ·
  **`src/` 下非测试文件除 `openInApp.ts` 外零改动的自证** · **既有 7 个导出一字未动的自证** ·
  `openNoteInNewTab` **未补**的确认 + 交接项登记 · **A-8 那张票的原文** · 命中的每一条 K/N 编号申报 · 三门算式。
- 拿不准 → 写 `NEEDS_CONTEXT` 并**停下**。

## 7. 提交

一刀 = 一个语义提交(`feat(kb): P5d T5 …`)。台账 `git add -f` 具体路径。
提交后 `git show --stat HEAD` + `git status` 自查。
