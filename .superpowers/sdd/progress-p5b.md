# SP4-P5b 云盘 OAuth —— SDD 进度台账
Plan: NimoOS-UI/docs/superpowers/plans/2026-07-07-vue3-migration-sp4-p5b-cloud-oauth.md
真机验收全部延后统一做(设备不在场)。
## 任务进度
- Task 1: complete (Service a659237..d257b0e, controller review clean) — 75 tests, dist 重建。cloud/driver 域,标准信封+裸守卫+camelCase,无 over-build。
- Task 2 (New-UI cloudAuth+recoverEvent): 进行中, BASE New-UI@abbfb1a
- Task 2: complete (New-UI abbfb1a..5937adf, controller review clean) — full 512/512, tsc0, diff 纯增(+7 测试,0 删)。cloudAuth/recoverEvent 纯 util 正确。
- Task 3 (mountsStore 扩 cloud): 进行中, BASE New-UI@5937adf
- Task 3: complete (New-UI 5937adf..88342d7, review clean) — full 515/515, tsc0。per-source 隔离(cloud/network 互不拖累)+合并 setMountNames,P5a 保留。Minor(记终审):samba-fail→cloud-survives 方向仅 inspection 验非测试覆盖。
- Task 4 (AddMountMenu 云盘项): 进行中, BASE New-UI@88342d7
- Task 4: complete (New-UI 88342d7..2b103fd, controller review clean) — full 515/515, tsc0。AddMountMenu 云盘驱动项(fetch 失败安全)+ connect-cloud emit + i18n,网络项保留。
- Task 5 (集成:云盘区+OAuth弹窗+recover订阅): 进行中, BASE New-UI@2b103fd
- Task 5: complete (New-UI 2b103fd..929f1d9, review clean) — full 515/515, tsc0，既有行为保留、无订阅泄漏。Minor(记终审):m.icon||diskIcon 回退实为死代码(icon 恒有值,brief 指定);null/undefined off-fn 风格不一(既有)。
- === 5 代码任务完成。待:整支终审(opus,New-UI abbfb1a..929f1d9)→ Task6 build+deploy。===
- 整支终审(opus)= Ready to merge。无 Critical/Important。合并 setMountNames 双源不互冲、路径安全(含子目录)、recover 订阅无泄漏、错误不抛 UI 全验。新 Minor(defer):虚拟路径显示名冲突(云盘名用户自取,与盘/host 同名会 toRealPath 解析错;P5a 设计固有)。5 个已知 Minor 全 defer。
- Task 6: build+deploy 完成,/app/ 200。
- === SP4-P5b 全部完成。坐标:New-UI master@929f1d9(abbfb1a..929f1d9,4 提交)、Service sp3-shared-http@d257b0e(cloud+driver 域)。真机+OAuth 验收延后统一做。===
