### Task 3: API 响应解析 + `avail` 核对 + `status` 子命令

**Files:**
- Modify: `nimo_os_docs/scripts/raidlab.sh`(追加函数)
- Modify: `nimo_os_docs/scripts/raidlab.test.sh`(追加用例)

**Interfaces:**
- Consumes: Task 2 的 `is_fake_disk`
- Produces:
  - `avail_disk_names` → 从 stdin 读 `GET /v1/disks` 的响应 JSON,往 stdout 打 `data.avail[]` 里每个盘的设备名(每行一个)。JSON 畸形/缺键时输出空且返回 0(不炸)。
  - `verify_avail_only_fake` → 从 stdin 读设备名清单(每行一个),全是假盘则返回 0;出现任何非假盘则往 stderr 报出是哪个并返回 1;**清单为空也返回 1**(见下)。
  - `api_get <path>` → `curl` 拿 `$RAIDLAB_API_BASE<path>`,失败返回非 0。
  - `cmd_status` → 打印测试台四视图,始终返回 0。

**空清单为什么算失败:** `up` 的核对点是「假盘已经能被后端看见」。空 `avail` 恰恰是 Task 1 白名单补丁未部署时的表现(实测:补丁前 4 块假盘齐全而 `avail` 恒为 `[]`)。把空当失败,`up` 才能给出「补丁未生效」这个准确诊断,而不是含糊地说没盘。

- [ ] **Step 1: 写失败测试**

在 `raidlab.test.sh` 的 `echo` 汇总行**之前**插入:

```bash
echo
echo "== avail_disk_names / verify_avail_only_fake =="

# 真实响应形状(GET /v1/disks):{"success":200,"message":"ok","data":{"avail":[...],"disks":[...]}}
JSON_TWO_FAKE='{"success":200,"message":"ok","data":{"avail":[{"name":"sda","path":"/dev/sda"},{"name":"sdb","path":"/dev/sdb"}],"disks":[{"name":"nvme0n1"}]}}'
JSON_EMPTY='{"success":200,"message":"ok","data":{"avail":[],"disks":[{"name":"nvme0n1"}]}}'
JSON_HAS_REAL='{"success":200,"message":"ok","data":{"avail":[{"name":"sda"},{"name":"nvme0n1"}]}}'
JSON_NO_NAME='{"success":200,"message":"ok","data":{"avail":[{"path":"/dev/sdb"}]}}'
JSON_NO_DATA='{"message":"no matching operation was found"}'

t_eq "解析出两块假盘" "sda
sdb" "$(printf '%s' "$JSON_TWO_FAKE" | avail_disk_names)"
t_eq "avail 为空时输出空" "" "$(printf '%s' "$JSON_EMPTY" | avail_disk_names)"
t_eq "缺 name 时回退用 path 尾段" "sdb" "$(printf '%s' "$JSON_NO_NAME" | avail_disk_names)"
t_eq "缺 data 键时输出空而不报错" "" "$(printf '%s' "$JSON_NO_DATA" | avail_disk_names)"
t_ok "缺 data 键时退出码仍为 0" bash -c "printf '%s' '$JSON_NO_DATA' | avail_disk_names"

t_ok "全是假盘 → 通过"    bash -c "printf 'sda\nsdb\n' | verify_avail_only_fake"
t_no "混进真盘 → 拒绝"    bash -c "printf 'sda\nnvme0n1\n' | verify_avail_only_fake"
t_no "空清单 → 拒绝(补丁未生效的信号)" bash -c "printf '' | verify_avail_only_fake"
```

**注意:** `t_ok`/`t_no` 用 `bash -c` 包一层是因为要走管道;`bash -c` 起的子 shell 不继承已 source 的函数,所以这几条用例需要在 `raidlab.test.sh` 顶部 `source` 之后加一行 `export RAIDLAB_SYSFS_ROOT` (已有) 并把函数导出。在 harness 的 `source` 行**之后**补上:

```bash
export -f is_fake_disk assert_fake_disk list_fake_disks avail_disk_names verify_avail_only_fake
export FAKE_DISK_MODEL
```

- [ ] **Step 2: 跑测试确认它失败**

```bash
cd /home/nimo/NimoTech/nimo_os_docs/scripts && ./raidlab.test.sh
```

预期:Task 2 的 12 条仍全绿;新增 8 条里凡调用未定义函数的全 FAIL(`export -f` 会先报 `not a function`)。

- [ ] **Step 3: 最小实现**

在 `raidlab.sh` 的 `list_fake_disks` 之后追加:

```bash
# --- API 视图 ---------------------------------------------------------------

# api_get <path> —— 取 $RAIDLAB_API_BASE<path>。走本机 Gateway,localhost
# 免 JWT,所以不需要带令牌。
api_get() {
	curl -sS -m 20 "$RAIDLAB_API_BASE$1"
}

# avail_disk_names —— stdin 读 GET /v1/disks 响应,stdout 打 avail 里的设备名。
# 用 python3 而不是 grep/sed:响应是嵌套 JSON,文本切割在 children 数组上必错。
# 任何解析失败都输出空 + 退出 0,由调用方(verify_avail_only_fake)去判定。
avail_disk_names() {
	python3 -c '
import json, sys
try:
    doc = json.load(sys.stdin)
except Exception:
    sys.exit(0)
data = doc.get("data") if isinstance(doc, dict) else None
if not isinstance(data, dict):
    sys.exit(0)
for entry in data.get("avail") or []:
    if not isinstance(entry, dict):
        continue
    name = entry.get("name") or (entry.get("path") or "").rsplit("/", 1)[-1]
    if name:
        print(name)
'
}

# verify_avail_only_fake —— stdin 读设备名清单(每行一个)。
# 全是假盘返回 0;出现非假盘返回 1;空清单也返回 1 —— 空 avail 正是 Task 1
# 白名单补丁未部署时的表现,当成失败才能给出准确诊断。
verify_avail_only_fake() {
	local dev
	local count=0
	while IFS= read -r dev; do
		[[ -n "$dev" ]] || continue
		count=$((count + 1))
		if ! is_fake_disk "$dev"; then
			echo "raidlab: 后端 avail 里出现非假盘 '$dev',中止。" >&2
			echo "         测试台不能在真盘可被选中的状态下使用。" >&2
			return 1
		fi
	done
	if [[ "$count" -eq 0 ]]; then
		echo "raidlab: 后端 avail 为空 —— 假盘存在但后端看不见。" >&2
		echo "         几乎肯定是 IsDiskSupported 白名单补丁未部署:" >&2
		echo "         cd ~/NimoTech && nimo_os_docs/scripts/deploy.sh local-storage" >&2
		return 1
	fi
	return 0
}

# --- status ----------------------------------------------------------------

# cmd_status —— 打印测试台四视图,验收时对账用。始终返回 0(纯观测)。
cmd_status() {
	echo "=== 假盘(sysfs model == scsi_debug)==="
	local fakes
	fakes="$(list_fake_disks)"
	if [[ -n "$fakes" ]]; then
		echo "$fakes"
	else
		echo "(无)"
	fi

	echo
	echo "=== /proc/mdstat ==="
	cat "${RAIDLAB_PROC_MDSTAT:-/proc/mdstat}" 2>/dev/null || echo "(读不到)"

	echo
	echo "=== lsblk ==="
	lsblk -o NAME,SIZE,TYPE,FSTYPE,MOUNTPOINT,MODEL 2>/dev/null || echo "(lsblk 失败)"

	echo
	echo "=== 后端 avail(GET /v1/disks)==="
	local names
	names="$(api_get /v1/disks 2>/dev/null | avail_disk_names)"
	if [[ -n "$names" ]]; then
		echo "$names"
	else
		echo "(空 —— 若假盘已在场,说明白名单补丁未部署)"
	fi

	echo
	echo "=== 后端快照卷(GET /v2/snapshot/volumes)==="
	api_get /v2/snapshot/volumes 2>/dev/null || echo "(请求失败)"
	echo

	echo "=== 后端 RAID 阵列(GET /v2/raid)==="
	api_get /v2/raid 2>/dev/null || echo "(请求失败)"
	echo
}
```

- [ ] **Step 4: 跑测试确认通过**

```bash
cd /home/nimo/NimoTech/nimo_os_docs/scripts && ./raidlab.test.sh
```

预期:`通过 20,失败 0`。

- [ ] **Step 5: 手工确认 `cmd_status` 在真机上不炸**

`status` 是纯观测、无破坏性,可以直接跑:

```bash
cd /home/nimo/NimoTech/nimo_os_docs/scripts && RAIDLAB_LIB_ONLY=1 bash -c 'source ./raidlab.sh; cmd_status'
```

预期:五段都打印出来;当前状态下「假盘」应为 `(无)`、mdstat 无阵列、`avail` 为空。**这是基线,记录进报告** —— Task 6 的验收清单要拿它对账。

- [ ] **Step 6: 提交**

```bash
cd /home/nimo/NimoTech/nimo_os_docs
git add scripts/raidlab.sh scripts/raidlab.test.sh
git commit -m "feat(raidlab): avail 解析/核对 + status 子命令

avail_disk_names 用 python3 解析嵌套 JSON(文本切割会在 children 上出错)。
verify_avail_only_fake 把「空 avail」也判为失败并指向 deploy.sh —— 空 avail
正是白名单补丁未部署时的实测表现,当成失败才能给出准确诊断而非含糊报没盘。

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

