# 容器事件推送 — 进度台账

计划: NimoOS-UI/docs/superpowers/plans/2026-07-16-container-event-push.md
基线: AppManagement 94774ee (feat/desktop-label-recognition) · New-UI f3fa2b9 (master)
注意: New-UI 工作区有无关未提交改动 (MediaViewer.vue / audioTranscripts.ts, 音频转录) — 本功能任务不碰; Task 5 部署前须与用户确认处理方式。

## 任务状态

(完成一项追加一行: Task N: complete (commits <base7>..<head7>, review clean))
Task 1: complete (AppManagement 94774ee..5b12898, review clean)
Task 2: complete (AppManagement 5b12898..a5b915c, review clean)
Task 3: complete (New-UI 75877bc..f5e91c2, review clean; 注:75877bc 是用户并行提交的无关 i18n commit,不在本功能范围)
Task 4: complete (New-UI f5e91c2..d0526e7, 1 个 Important[去抖定时器卸载不取消,计划参考代码自带]已修复并复审通过)

## Minor findings 汇总 (最终评审 triage 用)

(记录任务评审中的 Minor 项)
- T1: PropertyTypeContainerAction 缺 Example 字段(邻居有);新增 EventType 带解释性注释是本文件独例(计划文本要求的,非实现者自作主张)
- T2: 每事件 go PublishEventWrapper 无上限(事件风暴下 goroutine 增长,计划文本如此);本服务 API 自发操作会双路发事件(state-changed + 既有 Begin/End),前端须幂等消费(现设计已幂等);重连每次新建 docker client(可接受)
- T3: 新测试未断言持久化副作用(localStorage/setCustomStorage);toBeGreaterThan(0) 断言偏松(计划文本如此)
- T4(复审): Home.vue bridge 引用 dispose 后未置 null(与文件既有风格一致,纯外观);无"先退订后 dispose 顺序"专项测试(两种顺序皆正确,非必要)

## 终审(全功能跨仓库, 2026-07-17)

- Critical 1: evict 无 seen 守卫→同名容器 destroy 会永久误删系统/手动图标(spec 盲点,计划参考代码自带)。修复中:加 `if (!seen.value.has(key)) return` + 回归测试。
- Minor(均记债不阻塞): 在途 appgrid 响应可短暂复活刚清除的图标(自愈,≤45s);去抖无 max-wait(崩溃循环容器下退化为纯轮询节奏);后端每事件 goroutine 无序无上限(appgrid 对账兜底)。
- 台账 Minor 全部判定为可接受债务(T3 断言收紧随 Critical 修复顺手做)。
- 结论: With fixes(仅 Critical 1);修复后需重新部署前端 + 用户验收(Task 5 Step 5)。
- Critical 1 修复: d1b1f46(seen 守卫+回归测试+断言收紧), 终审复核 RESOLVED(两种失效场景封死,正常路径不受影响,回归测试无守卫时确会失败)。守卫版前端已于 07-17 重新部署实机。
- Task 5: complete。用户验收 4 场景全过(2026-07-17): run 秒现/stop 秒消/start 秒回/rm 秒消(桌面网格)。
- 验收中用户新发现(非本功能回归,既有行为): 已停止容器仍显示在 Dock 与添加面板——appgrid 后端故意保留停止容器(老 UI 依赖),useDock/useAddPanel 不按 status 过滤。是否隐藏=产品决定,待用户拍板,未动。
- 功能 commit 清单: AppManagement 5b12898+a5b915c(feat/desktop-label-recognition); New-UI f5e91c2+25f99fa+d0526e7+d1b1f46(master)。
