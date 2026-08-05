# SP4-P5a 挂载管理 —— SDD 进度台账

Plan: NimoOS-UI/docs/superpowers/plans/2026-07-07-vue3-migration-sp4-p5a-mount-management.md
Repos: NimoOS-Service (sp3-shared-http, Task1) · NimoOS-New-UI (master, Task2-8)

## 任务进度
- Task 1 (Service samba+disks 域): 进行中, BASE Service@e62a4bc
- Task 1: complete (Service commits e62a4bc..a659237, review clean) — 70/70. Minor(记终审): deleteConnection/umountUsb 不 unwrap → DELETE 错误信封会静默成功(brief 指定,deleteConnection 返 void)。
- Task 2 (New-UI 纯 util): 进行中
- Task 2: complete (New-UI 9985e2a..6edf69a, review clean) — full suite 496/496, tsc 0. Minor(记终审): locationOrder 损坏JSON 测试只覆盖缺失键非坏串(impl 有 try/catch,无功能问题)。
- Task 3 (mountsStore): 进行中, BASE New-UI@6edf69a
- Task 3: complete (New-UI 6edf69a..4462e7f, review clean) — full suite 502/502, tsc 0. socket 热插刷新在 Task 6 接线(reviewer ⚠️,controller 已跟踪)。跨仓 gotcha:改共享包加新文件须在 Service 跑 build 重建 dist + New-UI pnpm install(Task3 已修,dist 已在)。
- Task 4 (NetworkStorageDialog): 进行中, BASE New-UI@4462e7f
- Task 4 (NetworkStorageDialog): 实现 fa77a52;终审=Spec✅,但 Important bug(历史存 raw address 而非 bare host→datalist 双前缀+dedup 失效)已回退 implementer 修。Minor(记终审):parseAddress 在 canConnect+connect 各调一次(无害);历史不保留 nfs 协议(Task2 SambaHost 接口所限)。
- Task 4: complete (New-UI 4462e7f..8f546d3 [amended], review clean after fix) — tsc 0, full 502/502. Important bug 已修(host bare)。
- Task 5 (AddMountMenu): 进行中, BASE New-UI@8f546d3
- Task 5: complete (New-UI 8f546d3..82491ef, review clean, no findings) — tsc 0, full 502/502.
- Task 6 (FilesSidebar 集成): 进行中, BASE New-UI@82491ef
- Task 6 (FilesSidebar 集成): 实现 40ecfa0 DONE_WITH_CONCERNS。Important: socket 事件名 `storage_status` 是 Vue2 死订阅 bug,后端真名 `local-storage:storage_status`(disk.go/main.go 实证),已回退 implementer 修。concern2(Files.test.ts 加 samba mock 消 warn)=合理必要,接受。待修后 full 任务评审。
- Task 6: complete (New-UI 82491ef..70ec162 [amended], review clean after fix) — tsc 0, full 502/502, 既有行为保留。Minor(记终审):mounts.usb computed(Task3)无人消费=死代码(侧栏直接用 files.disks/disk.usb),终审定夺删否。
- Task 7 (盘拖拽排序+默认位置): 进行中, BASE New-UI@70ec162
- Task 7 (盘拖拽+默认位置): 实现 2ac6bd9。High bug: orderedDisks computed 读 localStorage(readOrder)非响应式→拖拽后视觉回弹(jsdom 可复现),已回退 implementer 修(加 orderVersion 触发 + 回归测试)。Minor(记终审):readDefault 指向已弹出盘→stale 导航(files.load 容错,同 Vue2)。
- Task 7: complete (New-UI 70ec162..d0751c0 [amended], review clean after fix) — tsc 0, full 503/503(+1 回归). orderVersion 响应式触发已修+守卫。
- === 全部 7 代码任务完成。待:整支终审(opus)→ Task 8 build+deploy → finishing。===

## 整支终审(opus)= Changes needed,2 Important(1 fix 处理)
- IMP1: 网络挂载 /mnt/<host> 泄漏进 router/breadcrumb/clipboard——displayNames 只含块设备(/storage),不含网络挂载→toVirtualPath 对 /mnt/* 成 no-op。违反路径安全铁律 + spec §3.3。修:filesStore 加 mountNames + setMountNames + rebuildDisplayNames(合并 disks+mount 名),mountsStore.loadMounts 调 setMountNames({mountPoint:host})。
- IMP2: storage_status 是 5s 心跳非变更事件,无防抖→每 5s 2 个 HTTP 永续轮询 + loadRoots churn 可能移位拖拽。修:Files.vue 去掉 local-storage:storage_status 订阅(保留 disk:added/removed 覆盖变更;偏离 spec §3.3 列表但服务其防抖意图)。
- 5 个已知 Minor 终审triage:全部 acceptable-to-defer(deleteConnection 不 unwrap=Service侧;mounts.usb 死代码;readDefault stale;nfs 历史不留协议;parseAddress 双调)。→ 记 P5b 清理/终审归档。

- 终审 2 Important 已修(New-UI@abbfb1a,507/507,tsc0,+2 回归):Fix1 网络挂载经 displayNames 映射(mountNames+setMountNames)、Fix2 去 storage_status 轮询。已 build+deploy /app/ 200。
- Task 8: build+deploy 完成,/app/ HTTP 200。
- === SP4-P5a 全部完成。坐标:New-UI master@abbfb1a(9985e2a..abbfb1a)、Service sp3-shared-http@a659237(samba+disks 域)。待用户真机验收。 ===
