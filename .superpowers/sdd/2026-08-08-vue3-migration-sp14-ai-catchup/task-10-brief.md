### Task 10: 收尾门 + 台账

**Files:**
- Create: `.superpowers/sdd/sp14/closeout.md`

- [ ] **Step 1: 跑整支收尾门，逐条记录真实数字**

```bash
pnpm exec vitest run                      # 全量,记录 文件数/用例数/失败数
pnpm exec vue-tsc --noEmit                # 类型
pnpm exec vitest run src/styles           # color-guard 等样式守卫
pnpm exec vitest run src/i18n             # parity
pnpm build                                # 构建
```

> ⚠️ 任何一条不绿都**不许**记「通过」。`vitest run` 退出码非 0 但零失败的情况本仓出现过（`sp7-photos-migration-progress` 那次是别处的 mock 缺口）—— 如实写清楚是哪一条、为什么。

- [ ] **Step 2: 跑 oss 导出的安全形式**

```bash
node oss/export.mjs --out /tmp/claude-1000/-home-nimo-NimoTech/9be6eba5-49d2-4544-b285-669477868c4c/scratchpad/oss-sp14 --no-commit --allow-dirty-oss
```
**不得裸调 `export.mjs`。** 新增的 AI 区文件（两张卡、composable、两个纯函数）属于开源产物树里被剔除的 AI 面 —— 确认导出没有因为新文件而报错，若报错按 `oss-web-ui-export-project` 那条记忆里的配方补 manifest。

- [ ] **Step 3: 真浏览器自查**

起 dev server：`pnpm dev --host --port 5279`，然后按 Task 0 的结论二选一：
- **后端支持** → 用一个会 elicit 的 MCP server 真触发，两张卡都过一遍（含 `<select>` 的**弹出列表**要在深浅两套主题下各看一次，确认不是白底白字）。
- **后端不支持或无法判定** → 用 CDP 往 `dispatchEvent` 注入两条事件看渲染（配方见 `newui-cdp-probe-auth-bypass`：localStorage 要连 `version` 一起塞，带 query 整页直达）。**在台账里如实写「渲染已验、端到端未验」。**

#141 与 #98 无论如何都要真机走一遍：MCP 详情页点「测试连接」看协议行；桌面 Dock「更多」里找到知识库磁贴、点进 `/ai/knowledge`。

- [ ] **Step 4: 写台账并提交**

`.superpowers/sdd/sp14/closeout.md`：每道门的**原始输出数字**、真浏览器自查的截图或结论、以及所有「未验」项的清单。

```bash
git add .superpowers/sdd/sp14/closeout.md
git commit -m "$(cat <<'EOF'
docs(sp14): record the closeout gates and what stayed unverified

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## 自查（写完计划后的核对）

**Spec 覆盖：** 设计文档 §4 的 8 个任务 → 本计划 T1–T9 全部落到具体文件与代码（T1=T1、T2=T2、T3=T3、T4=T4+T5、T5=T6、T6=T7、T7=T8、T8=T9），另加 T0（后端探测，来自 §7 风险 1）与 T10（收尾门，来自 §5/§6）。§3.2 校验分工 → T4 的注释与测试；§3.3 状态机三行表 → T1 的四个用例；§3.4 的「不渲染而非打印 undefined」→ T8 Step 1 的两例；§3.5 的「老用户靠 Dock/AddPanel」→ T9 的 `SYSTEM_APP_KEYS` 去重用例 + Step 3 的红判据。

**类型一致：** `useConfirmResolve` 的返回名（`decision/submitting/expired/submitError/run/fail`）在 T5/T6/T7 三处解构一致；`ElicitField` 的 snake_case 字段名在 T4 定义、T5 使用一致；`McpTestView` 的 `protocolEra/protocolVersion/supportedVersions` 在 T8 的类型、`toTestView`、`protocolLine`、测试四处一致；`resolveElicitation(confirmId, action, content)` 的签名在 T3 定义、T5/T6 调用一致。

**三处刻意留白**（不是占位符，是必须落笔时按现场核对的）：T2 的 `PREFIX` 实际字符串、T8 Step 5 的 import 相对深度、T9 Step 4 的空格子坐标 —— 三处都写明了「按该文件既有形状核对，别照抄我这行」以及核对方法。
