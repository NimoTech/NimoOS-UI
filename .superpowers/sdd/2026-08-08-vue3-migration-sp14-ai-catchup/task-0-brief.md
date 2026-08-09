### Task 0: 探测设备端 agent 是否支持 elicitation

**Files:**
- Create: `.superpowers/sdd/sp14/task-0-backend-probe.md`

**Interfaces:**
- Produces: 一条结论（`支持` / `不支持` / `无法判定`），Task 10 的验收步骤据此二选一。

**背景：** Python agent 跑在容器里（`:8282` 有响应但 `pgrep` 看不到进程）。`GET /openapi.json` 判不出来 —— confirm 端点收的是无类型裸 body，elicitation 是 SSE 事件种类而不是 HTTP 端点。

- [ ] **Step 1: 按顺序试这四条，记录每条的真实输出**

```bash
# 1) 容器在不在（本会话可能无权限，无权限就如实记「无法判定」，不要猜）
docker ps --format '{{.Names}}\t{{.Image}}' | grep -i agent

# 2) 容器里的 agent 代码有没有这两个事件种类
docker exec <上一步的容器名> grep -rl "mcp_elicit_form" /app 2>/dev/null

# 3) 退而求其次:本地仓库的版本(只能说明「我们手上的代码有」,不代表设备上有)
grep -n "mcp_elicit_form" /home/nimo/NimoTech/NimoOS-AI/agent/mcp_client/elicitation.py

# 4) 设备上 Go 侧 AI 服务的构建时间(判断新旧的旁证)
ls -l --time-style=long-iso /usr/bin/nimoos-ai 2>/dev/null
```

- [ ] **Step 2: 写结论文件**

`.superpowers/sdd/sp14/task-0-backend-probe.md` 必须包含：每条命令的**原始输出**、一句结论、以及结论对 Task 10 验收的影响。
**不允许写「应该支持」这类推测** —— 拿不到证据就写「无法判定，验收走 CDP 注入路径」。

- [ ] **Step 3: Commit**

```bash
git add .superpowers/sdd/sp14/task-0-backend-probe.md
git commit -m "$(cat <<'EOF'
docs(sp14): record whether the device agent speaks MCP elicitation

Acceptance for the two elicitation cards depends on whether a real
elicitation can be triggered on this device. The agent runs in a container,
so neither pgrep nor the OpenAPI document answers the question -- the
confirm endpoint takes an untyped body and elicitation is an SSE event kind,
not a route. Records what the probe actually returned so the acceptance
round does not have to guess.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

