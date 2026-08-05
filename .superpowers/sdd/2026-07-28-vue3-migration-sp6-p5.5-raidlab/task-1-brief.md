### Task 1: 后端白名单补丁(`IsDiskSupported` 接受 `block:scsi:pseudo`)

**Files:**
- Modify: `NimoOS-LocalStorage/service/disk.go:774-785`
- Test: `NimoOS-LocalStorage/service/disk_test.go`(追加,文件已存在)

**Interfaces:**
- Consumes: 无(本 Task 是起点)
- Produces: 部署后 `GET /v1/disks` 的 `disks`/`avail` 数组会包含 `subsystems` 含 `block:scsi:pseudo` 的盘。Task 3 的 `avail_disk_names` 与 Task 5 的 `cmd_up` 依赖这个行为。

**背景(实施者需要知道的全部上下文):**

`route/v1/disk.go:128` 有一句 `if !service.IsDiskSupported(currentDisk) { continue }`,它会把不在白名单里的盘从 `disks` 和 `avail` **两个返回数组里同时抹掉**。`scsi_debug` 造出的假盘实测特征是 `tran` 为空、`subsystems` 为 `block:scsi:pseudo`,现有白名单一条都不匹配,所以假盘对前端完全不可见 —— 这是整个测试台唯一的阻塞点。

- [ ] **Step 1: 写失败测试**

在 `NimoOS-LocalStorage/service/disk_test.go` 末尾追加。注意 `package service`、`gotest.tools/v3/assert` 都是文件里已有的,不要重复 import:

```go
// scsi_debug 假盘(SP6-P5.5 测试台)的 subsystems 是 block:scsi:pseudo,
// tran 为空 —— 白名单必须认它,否则 route/v1/disk.go:128 会把它从
// disks/avail 两个数组同时抹掉,存储区实盘验收就无盘可用。
func TestIsDiskSupported(t *testing.T) {
	cases := []struct {
		name       string
		tran       string
		subSystems string
		want       bool
	}{
		{"nvme 真盘", "nvme", "block:nvme:pci", true},
		{"sata 真盘", "sata", "block:scsi:pci", true},
		{"usb 盘", "usb", "block:scsi:usb:pci", true},
		{"virtio 虚拟盘", "", "block:scsi:virtio:pci", true},
		{"scsi_debug 假盘", "", "block:scsi:pseudo", true},
		{"zram 之类裸 block", "", "block", false},
		{"未知传输方式", "fibre", "block:unknown", false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := IsDiskSupported(model.LSBLKModel{Tran: c.tran, SubSystems: c.subSystems})
			assert.Equal(t, got, c.want)
		})
	}
}
```

- [ ] **Step 2: 跑测试确认它失败**

```bash
cd /home/nimo/NimoTech/NimoOS-LocalStorage && go test ./service -run TestIsDiskSupported -v
```

预期:`scsi_debug 假盘` 这个子用例 FAIL(`got false, want true`),其余 6 个 PASS。**如果 `scsi_debug 假盘` 已经通过,停下来报告** —— 说明白名单已被人改过,后续步骤会变成空改动。

- [ ] **Step 3: 最小实现**

`service/disk.go:774` 的函数改成(只加一行,位置放在 `block:scsi:pci` 那条前面):

```go
func IsDiskSupported(d model.LSBLKModel) bool {
	return d.Tran == "sata" ||
		d.Tran == "nvme" ||
		d.Tran == "spi" ||
		d.Tran == "sas" ||
		strings.Contains(d.SubSystems, "virtio") ||
		strings.Contains(d.SubSystems, "block:scsi:vmbus:acpi") || // Microsoft Hyper-V
		strings.Contains(d.SubSystems, "block:mmc:mmc_host:pci") ||
		strings.Contains(d.SubSystems, "block:mmc:mmc_host:platform") ||
		// scsi_debug 伪 SCSI 主机(SP6-P5.5 存储区实盘验收测试台)。生产机上
		// 这个子系统链只可能来自主动 modprobe scsi_debug,不会自然出现。
		strings.Contains(d.SubSystems, "block:scsi:pseudo") ||
		strings.Contains(d.SubSystems, "block:scsi:pci") || d.Tran == "usb"
}
```

- [ ] **Step 4: 跑测试确认通过**

```bash
cd /home/nimo/NimoTech/NimoOS-LocalStorage && go test ./service -run TestIsDiskSupported -v
```

预期:7 个子用例全 PASS。

- [ ] **Step 5: 跑该包全量测试确认没打破别的**

```bash
cd /home/nimo/NimoTech/NimoOS-LocalStorage && go build ./... && go test ./service/... 2>&1 | tail -20
```

预期:`go build` 无输出(成功);测试全 PASS 或维持改动前的既有失败状态(若有既有失败,在报告里列出来,不要试图修 —— 超出本期范围)。

- [ ] **Step 6: 提交**

```bash
cd /home/nimo/NimoTech/NimoOS-LocalStorage
git add service/disk.go service/disk_test.go
git commit -m "feat(disk): IsDiskSupported 接受 block:scsi:pseudo,并补齐该函数单测

SP6-P5.5 存储区实盘验收需要 scsi_debug 假盘,但它 tran 为空、
subsystems=block:scsi:pseudo,白名单一条不沾,被 route/v1/disk.go:128
从 disks/avail 两个数组同时抹掉。生产机不会自然出现该子系统链。
该函数此前无任何单测,顺带补齐 7 例表驱动覆盖。

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

**⚠️ 不要在本 Task 里部署** —— 部署是 Task 6 之后验收环节的第一步,由执行者按验收清单做(需要 `sudo` 且会重启服务)。

---

