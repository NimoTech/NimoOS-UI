# Task 0：设备端 agent 是否支持 MCP elicitation —— 探测记录

结论先行：**不支持**（当前部署在设备上的 agent 容器不含 elicitation 代码，也没有支持它的 MCP SDK 版本）。Task 10 的两条验收路径中，AI 区新增的两张 elicitation 卡片（`mcp_elicit_form` / `mcp_elicit_url`）**必须走 CDP 注入路径**验收，不能指望在真实对话里触发一次真的 elicitation 事件。

---

## Step 1：四条命令的原始输出

### 1) 容器在不在

本会话下不带 sudo 直接跑会拿到权限错误：

```
$ docker ps --format '{{.Names}}\t{{.Image}}' | grep -i agent
permission denied while trying to connect to the docker API at unix:///var/run/docker.sock
```

改用 `sudo -n`（免密，本会话可用）之后拿到了结果：

```
$ sudo -n docker ps --format '{{.Names}}\t{{.Image}}'
arize-phoenix-phoenix-1                      arizephoenix/phoenix:version-17.12.0
nimoos-agent-agent-1                         localhost/nimoos-agent:bundled
nimoos-photos-ml-immich-machine-learning-1   localhost/nimoos-photos-ml:bundled

$ sudo -n docker ps --format '{{.Names}}\t{{.Image}}' | grep -i agent
nimoos-agent-agent-1	localhost/nimoos-agent:bundled
```

容器名：`nimoos-agent-agent-1`。

### 2) 容器里的 agent 代码有没有这两个事件种类

brief 里给的 `/app` 路径不对（容器里没有 `/app`）：

```
$ sudo -n docker exec nimoos-agent-agent-1 grep -rl "mcp_elicit_form" /app
grep: /app: No such file or directory
```

`docker inspect` 查到真实的 `WorkingDir` 是 `/usr/share/nimoos/agent`（`Entrypoint: ["/usr/bin/tini", "--", "python", "main.py"]`），且这个目录**没有**挂载条目（不在 `.Mounts` 列表里），说明它是打进镜像里的，不是运行时挂载的宿主机目录。容器实际挂载的只有 `/DATA`、`/media`、`/mnt`（宿主机存储，rslave）和三个 `/var/lib/nimoos/ai/*`、`/var/run/nimoos`（agent 数据/socket 目录）。

在真正的运行目录里查：

```
$ sudo -n docker exec nimoos-agent-agent-1 grep -rl "mcp_elicit_form" /usr/share/nimoos/agent
(无输出，exit 1)

$ sudo -n docker exec nimoos-agent-agent-1 grep -rl "mcp_elicit_url" /usr/share/nimoos/agent
(无输出，exit 1)

$ sudo -n docker exec nimoos-agent-agent-1 grep -rl "elicit" /usr/share/nimoos/agent
(无输出，exit 1)
```

三条 grep 全部零匹配。列一下容器里 `mcp_client/` 目录的内容做交叉验证：

```
$ sudo -n docker exec nimoos-agent-agent-1 ls -la /usr/share/nimoos/agent/mcp_client
total 56
drwxrwxr-x 1 1000 1001  4096 Jul 18 07:52 .
drwxr-xr-x 1 root root  4096 Aug  1 02:44 ..
-rw-rw-r-- 1 1000 1001   156 Jun 18 10:58 __init__.py
drwxr-xr-x 2 root root  4096 Jul 31 07:11 __pycache__
-rw-rw-r-- 1 1000 1001 19550 Jul 18 07:52 client.py
-rw-rw-r-- 1 1000 1001  6561 Jun 25 03:13 netns_stdio.py
-rw-rw-r-- 1 1000 1001  1600 Jun 18 10:58 runtime.py
-rw-rw-r-- 1 1000 1001  1690 Jul 18 07:52 schema.py
```

**没有** `elicitation.py`、也没有 `elicitation_schema.py`（本地仓库这两个文件都在，见 Step 1.3）。

顺带查了一下容器里装的 MCP SDK 版本，作为独立佐证（不是 brief 要求的步骤，但证据链更硬）：

```
$ sudo -n docker exec nimoos-agent-agent-1 sh -c "pip show mcp 2>/dev/null | head -5"
Name: mcp
Version: 1.28.1
Summary: Model Context Protocol SDK
Home-page:
Author: Anthropic, PBC.
```

而本地仓库 `agent/requirements.txt` 要求：

```
$ grep -i "^mcp" /home/nimo/NimoTech/NimoOS-AI/agent/requirements.txt
mcp>=2.0.0,<3
```

设备上跑的是 `1.28.1`（< 2.0.0），不满足本地仓库当前对 MCP SDK 的版本要求。

一个取证坑记录一下：brief Step 1.2 里按 `docker exec ... grep -rl "mcp_elicit_form" / --include='*.py'` 这种不带路径限制的写法，第一次跑到 `/` 根目录时会把 `/DATA/.system_data/home/nimo/NimoTech/NimoOS-AI/...` 也搜进去 —— 因为 `/DATA` 是宿主机 `/DATA` 的 bind mount（`rslave`），而宿主机 `/DATA/.system_data/` 下恰好有一份 `/home/nimo/NimoTech/...` 的镜像/备份，命中的是**这份宿主机文件树的镜像**，不是容器自己跑的代码。误把这当成"容器里有"就会得出错误结论。确认过 `docker inspect` 的 `WorkingDir` 之后才在真正的 `/usr/share/nimoos/agent` 里重新查，得到上面的零匹配结果。

### 3) 本地仓库版本

```
$ grep -n "mcp_elicit_form" /home/nimo/NimoTech/NimoOS-AI/agent/mcp_client/elicitation.py
137:    card = {"type": "confirmation_required", "kind": "mcp_elicit_form",
```

本地仓库确实有这个事件种类。但这只能说明"我们手上的代码有"，不代表设备上有——Step 1.2 已经证明设备容器里没有。

顺手查了这个文件是什么时候进仓库的：

```
$ cd /home/nimo/NimoTech/NimoOS-AI && git log --diff-filter=A --format='%H %ad %s' -- agent/mcp_client/elicitation.py
c5f91ba7f9ec48e5d16a47d85e8a692989eba4f2 Thu Aug 6 02:25:04 2026 -0700 Mcp 2.0 upgrade (#85)
```

`elicitation.py` 是 2026-08-06 由 PR #85（"Mcp 2.0 upgrade"）新增的。

### 4) 设备上 Go 侧 AI 服务的构建时间

```
$ ls -l --time-style=long-iso /usr/bin/nimoos-ai
-rwxr-xr-x 1 nimo nimo 17910112 2026-07-18 16:26 /usr/bin/nimoos-ai
```

Go 二进制构建于 2026-07-18，早于 Aug 6 的 MCP 2.0 升级提交。

补充查的容器镜像时间（不在 brief 四条里，但直接支撑结论）：

```
$ sudo -n docker inspect nimoos-agent-agent-1 --format 'ImageCreated(container)={{.Created}} StartedAt={{.State.StartedAt}}'
ImageCreated(container)=2026-07-18T07:59:46.308977796Z StartedAt=2026-08-04T02:09:38.776445936Z
```

容器镜像构建于 2026-07-18（与 Go 二进制同一天，符合"打包发布"惯例），最近一次启动是 2026-08-04（那是重启，不是重新构建镜像——`/usr/share/nimoos/agent` 没有挂载条目，说明代码是打进镜像层的，重启不会刷新代码）。二者都早于 Aug 6 的 elicitation 提交。

## Step 2：结论

**不支持。** 三条独立证据互相印证，指向同一个结论：

1. 设备上真实运行目录 `/usr/share/nimoos/agent`（经 `docker inspect` 的 `WorkingDir` 核实，非挂载、是打进镜像的）里，`mcp_client/` 目录没有 `elicitation.py` / `elicitation_schema.py`，对 `mcp_elicit_form`、`mcp_elicit_url`、乃至 `elicit` 这个词根的 grep 全部零匹配。
2. 容器镜像构建于 2026-07-18，早于本地仓库引入 elicitation 支持的提交（`c5f91ba`，2026-08-06，PR #85 "Mcp 2.0 upgrade"）。
3. 容器里装的 `mcp` SDK 是 `1.28.1`，低于本地仓库当前要求的 `mcp>=2.0.0,<3` —— 这个版本的 SDK 本身可能都不具备 elicitation 能力，不只是 agent 代码没写。

这不是"应该不支持"式的推测，是直接在设备容器的真实运行目录里 grep 到零匹配、并用镜像构建时间和 SDK 版本两条独立证据交叉核实过的。

Task 10 的验收因此二选一里选后者：**走 CDP 注入路径**，人工在浏览器里注入一条 `mcp_elicit_form` / `mcp_elicit_url` 的 SSE 事件 payload 来验收这两张新卡片的渲染与交互，而不是指望在真实对话中让 agent 真的发出这个事件种类——设备上跑的这份 agent 代码目前发不出这个事件。

如果之后 agent 走 `deploy-agent.sh` 或重建容器镜像更新到 Aug 6 之后的代码，这个结论需要重新探测（本文件不是永久事实，是这次探测时刻的快照）。
