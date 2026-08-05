### Task 2: 后端 Docker 事件监听 goroutine

**Files:**
- Create: `/home/nimo/NimoTech/NimoOS-AppManagement/service/docker_events.go`
- Test: `/home/nimo/NimoTech/NimoOS-AppManagement/service/docker_events_test.go`
- Modify: `/home/nimo/NimoTech/NimoOS-AppManagement/main.go`（"register at message bus" 代码块之后）

**Interfaces:**
- Consumes: Task 1 的 `common.EventTypeContainerStateChanged` / `common.PropertyType*`；既有 `service.PublishEventWrapper(ctx, eventType, map[string]string)`。
- Produces: `service.MonitorDockerEvents(ctx context.Context)`（main.go 以 `go` 调用）；内部纯函数 `containerEventProperties(msg events.Message) map[string]string`。

- [ ] **Step 1: 写失败测试** — 新建 `service/docker_events_test.go`：

```go
package service

import (
	"testing"

	"github.com/NimoTech/NimoOS-AppManagement/common"
	"github.com/docker/docker/api/types/events"
	"github.com/stretchr/testify/assert"
)

func TestContainerEventProperties(t *testing.T) {
	for _, action := range []string{"start", "die", "destroy"} {
		msg := events.Message{
			Action: action,
			Actor:  events.Actor{ID: "abc123", Attributes: map[string]string{"name": "tasklist"}},
		}
		props := containerEventProperties(msg)
		assert.Equal(t, "abc123", props[common.PropertyTypeContainerID.Name])
		assert.Equal(t, "tasklist", props[common.PropertyTypeContainerName.Name])
		assert.Equal(t, action, props[common.PropertyTypeContainerAction.Name])
	}
}
```

- [ ] **Step 2: 跑测试确认失败** — `go test ./service -run TestContainerEventProperties -v`，预期：编译错误 `undefined: containerEventProperties`。

- [ ] **Step 3: 最小实现** — 新建 `service/docker_events.go`：

```go
package service

import (
	"context"
	"time"

	"github.com/NimoTech/NimoOS-AppManagement/common"
	"github.com/NimoTech/NimoOS-Common/utils/logger"
	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/events"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/client"
	"go.uber.org/zap"
)

// MonitorDockerEvents 常驻订阅 docker daemon 事件流,把容器 start/die/destroy 转发到
// MessageBus,覆盖终端/外部工具直接操作容器、本服务 API 无从感知的场景(桌面秒级同步)。
// 流断开(daemon 重启等)后退避重连;ctx 取消即退出。
func MonitorDockerEvents(ctx context.Context) {
	logger.Info("docker events monitor started")
	for {
		err := watchDockerEventsOnce(ctx)
		if ctx.Err() != nil {
			return
		}
		logger.Error("docker events stream disconnected - reconnecting", zap.Error(err))
		select {
		case <-ctx.Done():
			return
		case <-time.After(2 * time.Second):
		}
	}
}

func watchDockerEventsOnce(ctx context.Context) error {
	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		return err
	}
	defer cli.Close()

	f := filters.NewArgs()
	f.Add("type", "container")
	for _, e := range []string{"start", "die", "destroy"} {
		f.Add("event", e)
	}

	msgCh, errCh := cli.Events(ctx, types.EventsOptions{Filters: f})
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case err := <-errCh:
			return err
		case msg := <-msgCh:
			go PublishEventWrapper(ctx, common.EventTypeContainerStateChanged, containerEventProperties(msg))
		}
	}
}

func containerEventProperties(msg events.Message) map[string]string {
	return map[string]string{
		common.PropertyTypeContainerID.Name:     msg.Actor.ID,
		common.PropertyTypeContainerName.Name:   msg.Actor.Attributes["name"],
		common.PropertyTypeContainerAction.Name: msg.Action,
	}
}
```

- [ ] **Step 4: 跑测试确认通过** — 同 Step 2 命令，预期 PASS。

- [ ] **Step 5: main.go 接线** — 在 `main.go` 的 `// register at message bus` 整个 `{...}` 块**之后**插入：

```go
	// watch docker daemon events and forward to message bus (desktop instant sync)
	go service.MonitorDockerEvents(ctx)
```

- [ ] **Step 6: 全量构建与测试** — `go build -o /tmp/claude-1000/-home-nimo-NimoTech/3ea8a681-0808-40b5-91ab-87dbe179c18e/scratchpad/nimoos-app-management . && go test ./common ./service -count=1`，预期编译通过、测试全绿（service 包既有测试如需 docker 环境而失败，仅本任务新增测试必须绿，记录既有失败为已知）。

- [ ] **Step 7: 提交** — `git add service/ main.go && git commit -m "feat(events): docker daemon 事件流监听并转发 MessageBus(桌面秒级同步)"`

---

