### Task 6: 验收清单文档

**Files:**
- Create: `nimo_os_docs/docs/acceptance/2026-07-28-sp6-p5.5-验收清单.md`

**Interfaces:**
- Consumes: Task 1 的部署产物、Task 5 的 `raidlab.sh`
- Produces: 用户逐条勾选的验收清单。执行者不勾 —— 这份文档的读者是用户。

**写作要求:** 每条必须是「点哪里 → 应该看到什么」的可判定描述,不要写「验证 X 功能正常」这种没法判定的话。假盘的 SMART/温度/通电时长字段为空,凡涉及这些字段的观察点标 `N/A(假盘无 SMART)`。

- [ ] **Step 1: 写清单文档**

创建 `nimo_os_docs/docs/acceptance/2026-07-28-sp6-p5.5-验收清单.md`,内容结构如下,**每一条都要写全**:

```markdown
# SP6-P5.5 实盘验收清单

> 前置:① `nimo_os_docs/scripts/deploy.sh local-storage` 部署白名单补丁;
> ② `NimoOS-New-UI` 起 5273 预览(`pnpm build && pnpm exec vite preview --host`);
> ③ 5273 是独立端口,localStorage 独立 → 需要重新登录一次。
>
> 每轮开始前 `./raidlab.sh status` 记录基线,结束后 `./raidlab.sh down` 复核回基线。

## 第 0 步:补丁生效自检
- [ ] `./raidlab.sh up` 最后一行是「测试台就绪」。若报「avail 为空 / 白名单补丁未部署」,回去确认 Task 1 已部署。

## 第一轮:两个 2 盘 RAID1 —— 专验换阵列复位
(建阵列步骤、逐条观察点……)

## 第二轮:3 盘 RAID5 + 1 备用 —— P4 写操作全套
(创建向导 / 故障注入 / 换盘 / 恢复 / 快照面板 / 删阵列,逐条观察点……)

## 收尾
- [ ] `./raidlab.sh down` 输出「已回到基线」
- [ ] `./raidlab.sh status` 显示假盘 `(无)`、mdstat 无阵列、avail 为空
- [ ] `grep -c raidlab /etc/fstab` 为 0;`ls /etc/fstab.raidlab.bak` 存在(备份保留备查)
```

具体逐条内容按 spec §4.3 展开。第一轮必须包含:两个阵列都建成后在 `/storage/raid` 看到两张卡;进阵列 A 详情页记下快照开关状态/快照数/策略摘要;**直接切到阵列 B 的详情页**;确认面板显示的是 B 自己的状态而非 A 的残留;在 B 上开启保护并保存策略;回到 A 确认 A 的策略没被改。第二轮必须包含 spec §4.3 列出的 6 个步骤,每步展开成可判定的观察点。

- [ ] **Step 2: 自查清单可判定性**

通读一遍,把任何「验证 X 正常」「检查 Y 是否正确」改写成「点 X → 应看到 Y」。确认每条都有明确的失败判据。

- [ ] **Step 3: 提交**

```bash
cd /home/nimo/NimoTech/nimo_os_docs
git add docs/acceptance/2026-07-28-sp6-p5.5-验收清单.md
git commit -m "docs(acceptance): SP6-P5.5 实盘验收清单(两轮建台)

第一轮两个 2 盘 RAID1 专验 P5 终审那条 Critical(换阵列后面板复位);
第二轮 3 盘 RAID5 + 1 备用走 P4 写操作全套故障演练。
假盘无 SMART,相关观察点标 N/A。

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## 验收环节(Task 6 之后,由用户主导)

计划到 Task 6 为止是**代码与文档交付**。之后的实盘验收不是 Task,因为它需要用户在浏览器里点、判断视觉与交互是否符合预期:

1. 执行者跑 `deploy.sh local-storage` 部署白名单补丁
2. 执行者起 5273 预览并确认可访问
3. 执行者跑 `./raidlab.sh up` 并确认「测试台就绪」
4. **用户**按清单逐条验收,把结果告诉执行者
5. 暴露的缺陷按 TDD 修 —— 每个缺陷单独走一轮「失败测试 → 修 → 通过 → 提交」
6. 执行者跑 `./raidlab.sh down` 复核回基线
7. 更新 roadmap:关闭台账 C11、C12,记录 P5.5 结论

## Self-Review

**Spec 覆盖检查:**
- §4.1 机制选型(白名单补丁)→ Task 1 ✅
- §4.2 `raidlab.sh` 护栏 → Task 2 ✅;up/down/status → Task 3(status)、Task 5(up/down)✅
- §4.3 两轮验收拓扑 → Task 6 清单 ✅
- §4.4 5273 验收伺服 → Task 6 清单前置 ✅
- §4.5 缺陷 TDD 处理 → 验收环节第 5 步 ✅
- §4.6 完成定义 6 条 → Task 1(补丁+单测)、Task 2 Step 5 与 Task 4 Step 5(护栏反向测试)、Task 6(清单)、验收环节 6–7(基线复核、台账关闭)✅

**类型/命名一致性检查:** `is_fake_disk`/`assert_fake_disk`/`list_fake_disks`/`avail_disk_names`/`verify_avail_only_fake`/`api_get`/`md_arrays`/`md_members`/`assert_md_all_fake`/`fstab_drop_snapshots`/`mdadm_conf_drop_arrays`/`cmd_up`/`cmd_down`/`cmd_status`/`usage`/`main` —— 全文命名一致,Task 3/4 的 `export -f` 行与实际定义的函数集合对齐。环境变量 `RAIDLAB_SYSFS_ROOT`/`RAIDLAB_PROC_MDSTAT`/`RAIDLAB_FSTAB`/`RAIDLAB_MDADM_CONF`/`RAIDLAB_API_BASE`/`RAIDLAB_NUM_TGTS`/`RAIDLAB_DEV_SIZE_MB`/`RAIDLAB_LIB_ONLY` 一致。

**已知缺口(有意留白,非计划失败):**
- Task 6 的清单正文没有把每一条逐字写死,只给了必含项与写作标准。理由:清单是给人读的验收脚本,逐字写死会让执行者机械抄写而不检查每条是否真的可判定;必含项已经把 spec §4.3 的全部场景钉住了。
- 混规格盘验不了(`scsi_debug` 单次 modprobe 尺寸统一),已在 spec §7 与 roadmap 台账 B8 记账,不在本计划范围。
