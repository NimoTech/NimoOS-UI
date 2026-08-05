### Task 5: `up` / `down` 子命令 + `main` 接线

**Files:**
- Modify: `nimo_os_docs/scripts/raidlab.sh`(追加子命令与 `main`,末尾加执行守卫)
- Modify: `nimo_os_docs/scripts/raidlab.test.sh`(追加参数校验用例)

**Interfaces:**
- Consumes: Task 2–4 的全部函数
- Produces:
  - `cmd_up` → 加载 scsi_debug、等设备就绪、核对 `avail`,成功返回 0
  - `cmd_down` → 核查并停阵列、清 fstab/mdadm.conf、卸模块、复核基线,成功返回 0
  - `main <subcmd>` → 分派;未知子命令打用法并返回 1
  - 执行守卫:`RAIDLAB_LIB_ONLY=1` 时不跑 `main`

- [ ] **Step 1: 写失败测试**

在 `raidlab.test.sh` 汇总行之前插入。子命令本身要 root + 改内核状态,**不在单测里跑**;这里只锁参数分派与用法输出:

```bash
echo
echo "== main 参数分派 =="

t_no "未知子命令返回非 0"  main frobnicate
t_no "无参数返回非 0"      main
t_eq "未知子命令打出用法" "1" "$(main frobnicate 2>&1 | grep -c '用法: ')"
```

- [ ] **Step 2: 跑测试确认它失败**

```bash
cd /home/nimo/NimoTech/nimo_os_docs/scripts && ./raidlab.test.sh
```

预期:前 30 条绿,新增 3 条 FAIL(`main` 未定义)。

- [ ] **Step 3: 最小实现**

在 `raidlab.sh` 的 `cmd_status` 之后追加:

```bash
# --- up --------------------------------------------------------------------

# cmd_up —— 加载 scsi_debug、等设备就绪、核对后端能看见且只看见假盘。
cmd_up() {
	if [[ -n "$(list_fake_disks)" ]]; then
		echo "raidlab: 假盘已在场,无需重复 up。当前状态:" >&2
		list_fake_disks >&2
		echo "         要重建请先 ./raidlab.sh down。" >&2
		return 1
	fi

	echo "raidlab: 加载 scsi_debug(num_tgts=$RAIDLAB_NUM_TGTS dev_size_mb=$RAIDLAB_DEV_SIZE_MB)..."
	sudo modprobe scsi_debug \
		"num_tgts=$RAIDLAB_NUM_TGTS" \
		"dev_size_mb=$RAIDLAB_DEV_SIZE_MB" || {
		echo "raidlab: modprobe scsi_debug 失败。" >&2
		return 1
	}

	# 等设备节点出现(udev 异步)。10 次 × 1s 足够;实测约 2s。
	echo "raidlab: 等待设备节点..."
	local i count
	for i in $(seq 1 10); do
		count="$(list_fake_disks | wc -l)"
		[[ "$count" -ge "$RAIDLAB_NUM_TGTS" ]] && break
		sleep 1
	done
	count="$(list_fake_disks | wc -l)"
	if [[ "$count" -lt "$RAIDLAB_NUM_TGTS" ]]; then
		echo "raidlab: 只出现 $count 块假盘,期望 $RAIDLAB_NUM_TGTS 块。" >&2
		return 1
	fi
	echo "raidlab: 假盘就位:"
	list_fake_disks | sed 's/^/  /'

	# 后端磁盘列表有 100s 缓存(GetDiskList 走 LSBLK(false) 不吃缓存,但
	# SMART 缓存与 udev 仍需时间),重试几轮再判定。
	echo "raidlab: 核对后端 avail..."
	for i in $(seq 1 6); do
		if api_get /v1/disks 2>/dev/null | avail_disk_names | verify_avail_only_fake 2>/dev/null; then
			echo "raidlab: 后端已看见全部假盘,且 avail 里没有真盘。"
			echo
			echo "raidlab: 测试台就绪。下一步按验收清单在 5273 预览页操作。"
			return 0
		fi
		sleep 3
	done

	# 最后一次不吞 stderr,把准确诊断打给用户
	echo "raidlab: 核对失败,详情:" >&2
	api_get /v1/disks 2>/dev/null | avail_disk_names | verify_avail_only_fake
	return 1
}

# --- down ------------------------------------------------------------------

# cmd_down —— 拆台并复核回基线。顺序不可调换:必须在停阵列「之前」核查成员,
# 停完阵列成员信息就没了。
cmd_down() {
	local md rc=0

	# 1. 核查所有在场阵列都是测试台建的
	local arrays
	arrays="$(md_arrays)"
	if [[ -n "$arrays" ]]; then
		while IFS= read -r md; do
			[[ -n "$md" ]] || continue
			assert_md_all_fake "$md" || return 1
		done <<< "$arrays"
	fi

	# 2. 清 fstab(在停阵列前做,条目里的 /dev/md* 此刻还有意义)
	local fstab="${RAIDLAB_FSTAB:-/etc/fstab}"
	if [[ -r "$fstab" ]]; then
		local tmp_fstab
		tmp_fstab="$(mktemp)"
		fstab_drop_snapshots < "$fstab" > "$tmp_fstab"
		if ! diff -q "$fstab" "$tmp_fstab" >/dev/null 2>&1; then
			echo "raidlab: 清理 $fstab 里的 @snapshots 条目..."
			sudo cp "$fstab" "$fstab.raidlab.bak"
			sudo cp "$tmp_fstab" "$fstab"
		fi
		rm -f "$tmp_fstab"
	fi

	# 3. 卸挂载点并停阵列
	if [[ -n "$arrays" ]]; then
		while IFS= read -r md; do
			[[ -n "$md" ]] || continue
			echo "raidlab: 停止阵列 /dev/$md..."
			sudo umount -R "/dev/$md" 2>/dev/null || true
			sudo mdadm --stop "/dev/$md" || rc=1
		done <<< "$arrays"
	fi

	# 4. 清 mdadm.conf
	local mdconf="${RAIDLAB_MDADM_CONF:-/etc/mdadm/mdadm.conf}"
	if [[ -r "$mdconf" ]]; then
		local tmp_mdconf
		tmp_mdconf="$(mktemp)"
		mdadm_conf_drop_arrays < "$mdconf" > "$tmp_mdconf"
		if ! diff -q "$mdconf" "$tmp_mdconf" >/dev/null 2>&1; then
			echo "raidlab: 清理 $mdconf 里的 ARRAY 行..."
			sudo cp "$mdconf" "$mdconf.raidlab.bak"
			sudo cp "$tmp_mdconf" "$mdconf"
		fi
		rm -f "$tmp_mdconf"
	fi

	# 5. 卸模块
	if lsmod | grep -q '^scsi_debug'; then
		echo "raidlab: 卸载 scsi_debug..."
		sudo rmmod scsi_debug || rc=1
	fi

	# 6. 复核基线
	echo "raidlab: 复核基线..."
	local left
	left="$(list_fake_disks)"
	if [[ -n "$left" ]]; then
		echo "raidlab: 仍有假盘残留:" >&2
		echo "$left" >&2
		rc=1
	fi
	if [[ -n "$(md_arrays)" ]]; then
		echo "raidlab: 仍有 md 阵列残留:" >&2
		md_arrays >&2
		rc=1
	fi

	if [[ "$rc" -eq 0 ]]; then
		echo "raidlab: 已回到基线。"
	else
		echo "raidlab: 拆台未完全成功,请跑 ./raidlab.sh status 查看。" >&2
	fi
	return "$rc"
}

# --- 分派 ------------------------------------------------------------------

usage() {
	cat <<'EOF'
用法: ./raidlab.sh <子命令>

  up      加载 scsi_debug 造假盘,核对后端能看见且只看见假盘
  down    核查并停阵列、清 fstab/mdadm.conf、卸模块、复核回基线
  status  打印假盘/mdstat/lsblk/后端 avail/快照卷/RAID 六视图(纯观测)

环境变量(默认值):
  RAIDLAB_NUM_TGTS=4          假盘数量
  RAIDLAB_DEV_SIZE_MB=512     每块假盘大小
  RAIDLAB_API_BASE=http://127.0.0.1
EOF
}

main() {
	case "${1:-}" in
	up) cmd_up ;;
	down) cmd_down ;;
	status) cmd_status ;;
	*)
		usage >&2
		return 1
		;;
	esac
}

# 执行守卫:被 source 时(测试)只定义函数,不跑 main。
if [[ "${RAIDLAB_LIB_ONLY:-0}" != "1" ]]; then
	main "$@"
fi
```

- [ ] **Step 4: 跑测试确认通过**

```bash
cd /home/nimo/NimoTech/nimo_os_docs/scripts && ./raidlab.test.sh
```

预期:`通过 33,失败 0`。

- [ ] **Step 5: 确认执行守卫两个方向都对**

```bash
cd /home/nimo/NimoTech/nimo_os_docs/scripts
# 直接执行无参数 → 打用法、退出码 1
./raidlab.sh; echo "退出码=$?"
# status 子命令 → 正常打印
./raidlab.sh status | head -5
```

预期:第一条打出 `用法: ./raidlab.sh <子命令>` 且 `退出码=1`;第二条打出「假盘」段。

**不要在本步跑 `up` 或 `down`。**

- [ ] **Step 6: 提交**

```bash
cd /home/nimo/NimoTech/nimo_os_docs
git add scripts/raidlab.sh scripts/raidlab.test.sh
git commit -m "feat(raidlab): up/down 子命令 + main 分派与执行守卫

down 的步骤顺序不可调换:必须在停阵列之前核查成员并清 fstab,停完成员信息
就读不到了。改 fstab/mdadm.conf 前都留 .raidlab.bak 备份。up 对后端 avail
重试 6 轮 × 3s 后才判失败(udev 与 SMART 缓存需要时间),最后一次不吞
stderr 以便打出准确诊断。

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

