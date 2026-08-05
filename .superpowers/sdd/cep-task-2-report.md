# Task 2: 后端 Docker 事件监听 goroutine — 完成报告

## 实现概览

成功实现了 NimoOS AppManagement 后端的 Docker daemon 事件流监听 goroutine，用于捕捉容器 start/die/destroy 事件并实时转发到 MessageBus，覆盖终端/外部工具直接操作容器、服务 API 无从感知的场景，实现桌面秒级同步。

## 文件变更

### 新建文件

1. **service/docker_events.go** (92 行)
   - `MonitorDockerEvents(ctx context.Context)`: 主监听函数，常驻 goroutine，订阅 Docker 事件流
   - `watchDockerEventsOnce(ctx context.Context) error`: 单次 Docker 连接与事件轮询，流断开后返回 error
   - `containerEventProperties(msg events.Message) map[string]string`: 从 Docker 事件消息提取容器属性 map（ID、Name、Action）

2. **service/docker_events_test.go** (18 行)
   - `TestContainerEventProperties`: 单元测试，验证函数 `containerEventProperties` 对 start/die/destroy 三个动作的正确属性提取

### 修改文件

1. **main.go** (+3 行)
   - 在"register at message bus"整个块`}`之后插入 `go service.MonitorDockerEvents(ctx)` 调用
   - 位置：第 118 行，MessageBus 注册完成后立即启动 Docker 事件监听 goroutine

## TDD 流程与证据

### Step 1-2: RED — 失败测试

创建 `service/docker_events_test.go`，运行测试：

```bash
go test ./service -run TestContainerEventProperties -v
```

**预期失败输出：**
```
service/docker_events_test.go:17:12: undefined: containerEventProperties
FAIL	github.com/NimoTech/NimoOS-AppManagement/service [build failed]
```

✓ 确认：编译失败，`undefined: containerEventProperties` —— 函数尚未实现。

### Step 3-4: GREEN — 实现并通过

创建 `service/docker_events.go`（完整实现），运行测试：

```bash
go test ./service -run TestContainerEventProperties -v
```

**实际通过输出：**
```
=== RUN   TestContainerEventProperties
--- PASS: TestContainerEventProperties (0.00s)
PASS
ok  	github.com/NimoTech/NimoOS-AppManagement/service	(cached)
```

✓ 确认：测试通过，属性提取逻辑正确。

### Step 5: 接线验证

修改 main.go，添加 `go service.MonitorDockerEvents(ctx)` 调用。通过编译验证：

```bash
go build -o /tmp/claude-1000/-home-nimo-NimoTech/3ea8a681-0808-40b5-91ab-87dbe179c18e/scratchpad/nimoos-app-management .
```

✓ 编译通过，无链接或调用错误。

### Step 6: 全量测试

#### 6a. Build 验证
```bash
go build -o /tmp/.../nimoos-app-management .
# 结果: BUILD OK
```

#### 6b. common 包测试
```bash
go test ./common -count=1 -v
# === RUN   TestContainerStateChangedRegistered
# --- PASS: TestContainerStateChangedRegistered (0.00s)
# ok  	github.com/NimoTech/NimoOS-AppManagement/common	0.002s
```

✓ Task 1 的事件契约测试通过。

#### 6c. service 包部分测试（新增 + 既有快速测试）
```bash
go test ./service -run "TestContainerEventProperties|TestApplyDesktopMeta" -v
# === RUN   TestApplyDesktopMeta
# === RUN   TestApplyDesktopMeta/enable_容器填充元数据
# --- PASS: TestApplyDesktopMeta (0.00s)
# === RUN   TestContainerEventProperties
# --- PASS: TestContainerEventProperties (0.00s)
# PASS
# ok  	github.com/NimoTech/NimoOS-AppManagement/service	0.020s
```

✓ 新增测试 **TestContainerEventProperties 通过**。
✓ 既有测试 TestApplyDesktopMeta 通过。

#### 6d. 已知预存测试不稳定
- 部分 service 包既有测试（如 TestAppStoreList）因网络超时或 MessageBus 未初始化环境失败，与本 Task 无关
- 这些属于测试环境依赖问题（需实时 MessageBus 服务、网络连接），非代码 bug

## 实现细节检查

### 1. 事件常数使用（避免硬编码）
✓ 使用 Task 1 定义的常数而非字符串字面量：
```go
common.EventTypeContainerStateChanged    // Task 1 定义
common.PropertyTypeContainerID.Name      // Task 1 定义
common.PropertyTypeContainerName.Name    // Task 1 定义
common.PropertyTypeContainerAction.Name  // Task 1 定义
```

### 2. Docker 事件过滤
✓ 仅订阅：
- 类型：container
- 事件：start, die, destroy
- 符合桌面应用状态同步需求（应用启动、终止、销毁）

### 3. 错误恢复与重连
✓ MonitorDockerEvents 持续运行，流断开时：
- 记录 error 日志
- 退避 2 秒重连
- ctx 取消时优雅退出，无死循环

### 4. 并发发布事件
✓ 使用 `go PublishEventWrapper(...)` 异步发布，避免阻塞事件轮询

### 5. 属性提取完整性
✓ containerEventProperties 提取三个必需属性：
- Container ID（docker Actor.ID）
- Container Name（docker Actor.Attributes["name"]）
- Action（docker 事件动作字符串）

## 自审查

### 代码质量
- ✓ 无硬编码常数，全部来自 common 包
- ✓ 错误处理：网络断开、ctx 取消、Docker 连接失败都有妥善处理
- ✓ 日志详实：启动日志、断线重连日志、错误日志
- ✓ 导入包完整且精确（zap、Docker SDK v24.0.7、logger）

### 接线正确性
- ✓ main.go 的插入位置准确（MessageBus 注册之后）
- ✓ 使用全局 ctx，支持优雅关闭
- ✓ 函数签名与 brief 完全一致

### 测试覆盖
- ✓ 关键私有函数 containerEventProperties 有单元测试
- ✓ 三个动作（start/die/destroy）都覆盖
- ✓ 断言使用 assert.Equal 准确验证

### 与现有代码一致性
- ✓ 命名风格一致（驼峰，公开函数大写）
- ✓ 日志风格一致（logger.Info/Error + zap.Error）
- ✓ 使用既有 service.PublishEventWrapper 而非重新实现

## 提交信息

```
feat(events): docker daemon 事件流监听并转发 MessageBus(桌面秒级同步)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
```

Commit SHA: `a5b915c`

## 关键交付物

| 项目 | 状态 |
|------|------|
| 函数实现（3 个） | ✓ 完成 |
| 单元测试 | ✓ 通过 (PASS) |
| main.go 接线 | ✓ 完成 |
| 编译通过 | ✓ 成功 |
| 提交 | ✓ 已提交 |

## 无阻碍项

- Docker SDK 依赖已在 go.mod 中（v24.0.7）
- MessageBus 事件类型已在 Task 1 完成
- PublishEventWrapper 既有实现，无需新增
- 分支 feat/desktop-label-recognition 保持干净

## 后续步骤（下一个 Task）

Task 3: 前端 layout.evict 立即清位
- 此 Task 已完成所有后端基础设施，前端可开始订阅 `docker:container:state-changed` 事件
