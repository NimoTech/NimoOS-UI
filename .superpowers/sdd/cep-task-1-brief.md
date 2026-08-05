### Task 1: 后端事件契约（EventType 声明）

**Files:**
- Modify: `/home/nimo/NimoTech/NimoOS-AppManagement/common/message.go`
- Test: `/home/nimo/NimoTech/NimoOS-AppManagement/common/message_test.go`（新建）

**Interfaces:**
- Produces: `common.PropertyTypeContainerAction`（Name=`docker:container:action`）、`common.EventTypeContainerStateChanged`（Name=`docker:container:state-changed`），且后者已加入 `common.EventTypes`（Task 2 发布用；启动时随该列表自动注册到 MessageBus）。

- [ ] **Step 1: 写失败测试** — 新建 `common/message_test.go`：

```go
package common

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestContainerStateChangedRegistered(t *testing.T) {
	assert.Equal(t, "docker:container:state-changed", EventTypeContainerStateChanged.Name)
	assert.Equal(t, "docker:container:action", PropertyTypeContainerAction.Name)

	found := false
	for _, et := range EventTypes {
		if et.Name == EventTypeContainerStateChanged.Name {
			found = true
		}
	}
	assert.True(t, found, "EventTypeContainerStateChanged must be in EventTypes for startup registration")
}
```

- [ ] **Step 2: 跑测试确认失败** — `cd /home/nimo/NimoTech/NimoOS-AppManagement && go test ./common -run TestContainerStateChangedRegistered -v`，预期：编译错误 `undefined: EventTypeContainerStateChanged`。

- [ ] **Step 3: 最小实现** — 在 `common/message.go`：

在 `PropertyTypeContainerName` 定义后追加（约 68 行处，container properties 区）：

```go
	PropertyTypeContainerAction = message_bus.PropertyType{
		Name:        "docker:container:action",
		Description: utils.Ptr("docker daemon event action, one of `start`, `die`, `destroy`"),
	}
```

在 `EventTypeContainerRemoveError` 定义后（约 510 行处）追加：

```go
	// EventTypeContainerStateChanged 来自 docker daemon 事件流(而非本服务 API 操作),
	// 覆盖终端/外部工具直接操作容器的场景。消费方:New-UI 桌面秒级同步。
	EventTypeContainerStateChanged = message_bus.EventType{
		SourceID: AppManagementServiceName,
		Name:     "docker:container:state-changed",
		PropertyTypeList: []message_bus.PropertyType{
			PropertyTypeContainerID,
			PropertyTypeContainerName,
			PropertyTypeContainerAction,
		},
	}
```

在 `EventTypes` 列表的 `EventTypeContainerRemoveBegin, ...` 行后追加一行：

```go
	EventTypeContainerStateChanged,
```

- [ ] **Step 4: 跑测试确认通过** — 同 Step 2 命令，预期 PASS。
- [ ] **Step 5: 提交** — `git add common/ && git commit -m "feat(events): 新增 docker:container:state-changed 事件契约(daemon 事件流转发)"`

---

