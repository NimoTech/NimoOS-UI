# SP8-P5c · Task 10 —— 路由反转 ×3 + 占位摘项 + 收官(**本期最后一刀**)

做完这一刀,用户才第一次能在浏览器里看到本期成果。

## 必读

1. `.superpowers/sdd/p5c-common-constraints.md` —— **全文最新版**(已被协调者订正 30 次)。尤其
   §1.1 + **§1.3 / §1.3.1**、§3 的 **K7**、**§8.1 台账**、§8.2、§9(**第七~第十条**)、**§12.3 的 E-13**、§10、§11、**§13**
2. `.superpowers/sdd/p5c-plan.md` 的 **T10 节**(**那条 `dist` 构建管线门是从 T6 挪到本刀的**)
3. **先例**(照它们抄,别自己发明):`src/ai/knowledge/knowledgeRoutes.ts` 的**文件头注释**
   —— P5a T12 / P5b T5 / P5b T10 **三次同款反转**都在里面逐次登记;
   `src/ai/knowledge/knowledgeRoutes.test.ts` **`:26-63`** 是「反转断言、改前原文留成注释」的模板
4. `src/ai/knowledge/deferred.ts`(含 P5b 两次摘项的注释先例)

**权威优先级:治理文件 > 本 brief > 计划书。** 🔴 **本 brief 会出错**(前 9 刀累计核出 **23 处**)——
**每个行号自己回源核**,核出错登记编号(上一个是 **E-23**)。

---

## 0. 起点

- 可写仓 `/home/nimo/NimoTech/.sp8/NimoOS-New-UI`,分支 `sp8-ai`。**起点 sha 由协调者在派活消息里给**(以那个为准)。
- 三门基线**由协调者在派活消息里给实测值**(T9 收官后)。
- **本刀零新增文件、零新增 `.vue`** → 文件数与 `.vue`(**179**)都不变,`color-guard` 不变;只有用例数可能微调。

---

## 1. 交付

**改 4 个文件**(不多不少):
```
src/ai/knowledge/deferred.ts              ← DEFERRED_TABS 摘 'settings'(6 → 5)
src/ai/knowledge/knowledgeRoutes.ts       ← 三处 component 反转
src/ai/knowledge/knowledgeRoutes.test.ts  ← 反转断言(不删)
src/ai/knowledge/deferred.test.ts         ← 若存在;先 grep 确认
```
**不改其它任何文件。** 🔴 尤其那 4 个新视图与它们的测试(T3/T6/T7/T8/T9 已全部过评审)、
两份 scss 与其守卫、`src/i18n/*`、`parserStore.ts`、§1.1 全期零改动清单。

---

## 2. 三处反转(**行号自己回源核**)

| # | 位置 | 改法 |
|---|---|---|
| 1 | `deferred.ts` 的 `DEFERRED_TABS` | 摘掉 **`'settings'`** → **6 项变 5 项**。🔴 **`'allowlist'` 留着**(本期不做 `AllowlistView`,用户拍板)。`KnowledgeTabId` 类型**不动** |
| 2 | `knowledgeRoutes.ts` 约 `:59` | `{ path: 'settings', name: 'KnowledgeSettings', component: KnowledgeDeferred }` → 真 **`SettingsView`** |
| 3 | `knowledgeRoutes.ts` 约 `:62` / `:63` | `/ai/parser` → 真 **`ParserStatus`**;`/ai/parser/test` → 真 **`ParserTest`** |

🔴 **第 3 组那两条是顶层路由、不在 `DEFERRED_TABS` 里** —— **不用去 `deferred.ts` 摘它们**。
🔴 **import 路径**:`SettingsView` 在 `./views/`;`ParserStatus` / `ParserTest` 在 **`./parser/`**(治理 §5.1)。
🔴 **K7 占位机制本身保留** —— 反转 ≠ 删除。`KnowledgeDeferred` 仍被 5 个子路由使用。
**文件头注释按前三次先例的格式追加本期一条**(写清摘了哪项、反转了哪几条、其余剩几条)。

---

## 3. 🔴 `knowledgeRoutes.test.ts` 的断言:**反转,不删**

那条「其余子路由仍是 `KnowledgeDeferred`」的断言要**反转**(把 `settings` 与两条 parser 路由从「仍是占位页」
挪到「已是真组件」),**改前原文留成注释 + 写清为什么反转**。
🔴 **照该文件 `:26-63` 的既有模板抄**(P5a T12 / P5b T5 / P5b T10 三次都这么做的)。
🔴 **必须仍有断言证明 K7 机制活着**(剩下 5 个子路由仍指 `KnowledgeDeferred`)——
**这是承 P4 I2 的教训:「清空后要仍有用例证明它有能力,而不是只剩一段没人测的代码」。**
`deferred.test.ts`(若存在)里 `DEFERRED_TABS` 的长度/内容断言同步改成 **5**。

---

## 4. 🔴 本刀独有:承接 T2b/T6 的「构建管线」额外门(E-13)

路由反转后,`parser-styles.scss` 才第一次被入口可达地 import。**这是它真进构建管线的唯一证据。**

```bash
pnpm build
grep -o "parser-status-page" dist/assets/*.css | head
grep -o "parser-test-page"   dist/assets/*.css | head
grep -oE "\.parser-app\{[^}]*\}" dist/assets/*.css | head -3
grep -c "\.parser-app\.parser-status-page" dist/assets/*.css   # 复合形式应为 0
grep -c "\.parser-app \.parser-status-page" dist/assets/*.css   # 后代形式应命中
```
**要求全部满足并把原始输出贴进报告**:
1. `parser-status-page` 与 `parser-test-page` **都命中**;
2. `.parser-app{...}` 里 **K22 那三行**在(`height:100vh` / `height:100dvh` / `overflow-y:auto`),
   且**零颜色属性、零 `--x:` 声明**;
3. 🔴 **后代**选择器命中、**复合**形式 **0 处**(**K31 生效的证据**);
4. 顺带核 `SettingsView` 用到的类(如 `k-set-card` / `k-sw` / `kn-checkline` / `k-modal-head`)也在产物里。

⚠️ **T6/T7 达不到这条门是预期(E-13)**,别把它们报成缺陷。

---

## 5. 收官核对(本刀要给全期口径)

1. **三门**:文件数应 **326** · `.vue` **179** · tsc 0 · build 0。**用例数报实测终值。**
   已知噪声(只它们红就复跑一次并说明,**不要顺手改**):
   `src/files/upload/persist.test.ts > persist > dropPersisted removes record + blob and frees budget` ·
   `AgentComposer.test.ts` 的 vue-i18n teardown 竞态。
2. 🔴 **`.vue` 台账收官核对**(治理 §8.1):起点 175 → T3 176 → T6 177 → T7 178 → T8 **179**。
   **实测应为 179;若不是,停下查。**
3. 🔴 **§1.3.1 环境自查(本刀必做,这是收官刀的责任)**:
   - `.sp8/NimoOS-Service/dist/` 与 committed `src/` **一致**(T9 修过 07-31 遗留的 `pathX` 污染)——
     **自己重建 + 全目录 diff 核一遍**,`git status` **不构成证据**。
   - `node_modules/.vite/deps/` **无 `nimoos-service` 陈旧产物**(P5b T11 栽过「dev server 喂旧代码」)。
   - ⚠️ **扫残留别用宽松正则**(协调者扫的时候 `PREFIX` 被当成可疑标记假阳性)。
4. **全期零改动清单复核**:§1.1 那些文件在**整期**(从 `63a0b0d` 到 HEAD)**逐个 `numstat` 为 0**。
   ⚠️ **例外是治理明确授权的**:`knowledgeStore.parser.test.ts` **3 行**(§8.3)·
   `knowledgeStyles.test.ts` 的**中央 ③′ 守卫纯新增**(E-19)· `SettingsView.test.ts` 的 **E-22/E-23 四处**。
   **除这些之外有任何改动,按 Critical 报并停下。**
5. **i18n 收官**:`aiKb*` 键数 = P5a 96 + P5b 100 + P5c **99** = **295**;新增 **0**(本刀)。
   `parity.test.ts` / `messageSyntax.test.ts` 全绿。

---

## 6. 硬约束

- 禁 `git add -A` / `git add .`;禁 rebase / reset / stash / merge / push;不跑 `./scripts/deploy.sh`;
  不写 `/var/lib`;不改任何后端仓;**不动 `:5288` 的 dev server**(**收官后由协调者 kill 重起**)。
- **一个任务 = 一个语义提交**,提交后 `git show --stat HEAD` + `git status` 自查。报告 **`git add -f`**。
- **禁碰** `/home/nimo/NimoTech/NimoOS-New-UI`(SP6/SP9)与 `/home/nimo/NimoTech/.sp7/NimoOS-New-UI`(SP7,有并发会话)。
- 🔴 **不许新增 i18n 键**、不许碰任何 `.scss`、不许改那 4 个新视图。需要改 → **停下写 `NEEDS_CONTEXT`**。

---

## 7. 报告契约

完整报告写 `.superpowers/sdd/p5c-task-10-report.md`(**`git add -f`**),至少含:
- 三处反转的**改前/改后 diff** + 文件头注释追加内容
- 🔴 **`knowledgeRoutes.test.ts` 断言反转的完整 diff** + **「K7 机制仍被用例证明活着」的那条断言**
- 🔴 **§4 构建管线门的四项原始输出**(含**复合形式 0 处**这条 K31 证据)
- 🔴 **§5 收官核对逐项**:三门终值 · `.vue` 台账 179 · **§1.3.1 环境自查(dist 重建 diff + vite 缓存)** ·
  **全期零改动清单 `numstat` 逐个为 0(除三处授权例外)** · i18n 295 / 新增 0
- **RED 探针**(至少 2 条:把某条反转改回占位页 → 断言必须报红;`DEFERRED_TABS` 塞回 `'settings'` → 必须报红)
  + 还原确认 + `git status` 干净
- **§3 的 K1–K36 里本刀命中的**(至少 **K7**)
- 拿不准的一律 `NEEDS_CONTEXT`,**不要自己拍**

返回给协调者 **≤15 行**:状态 · 提交 sha · 一行三门结果 · 文件数/`.vue` ·
**构建管线门四项是否全过(含复合 0 处)** · **§1.3.1 环境自查结论** ·
**全期零改动清单是否干净** · RED 探针几条全过 · 顾虑。
