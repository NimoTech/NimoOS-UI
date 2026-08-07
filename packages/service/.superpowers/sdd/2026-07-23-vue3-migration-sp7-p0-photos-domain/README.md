# SP7-P0 台账 · 共享包 photos 域全量(2026-07-23)

这一批原本只活在 `.sp7/NimoOS-Service/.superpowers/sdd/` 里(平铺在顶层),而该目录当时被
`.superpowers/sdd/.gitignore` 的一条 `*` 全量忽略 ⇒ **git 救不回**。2026-08-05 撤 `.sp7`
worktree 前搬进来并入库,顺带把那条 `*` 换成与 NimoOS-New-UI 一致的入库规则。

**为什么收进独立目录**:主工作树 `sdd/` 顶层已有另一期(SP9,`sys.hardwareInfo()` 那批)的
同名 `task-N-{brief,report}.md` —— 14 份同名但内容不同,直接搬会互相覆盖。文件内容一个字没动。

内容:P0 把 photos 域从 4 个方法扩到 60+(核心/搜索/收藏/相册/人物/地点/智能视图/回收站/
上传/sprite)的 7 组任务简报 + 实现报告 + `final-fix-report.md`(终审修复波)。
**其中最要紧的一条实现事实**:Photos v1 后端(同 KVM)**无标准信封** —— 裸 JSON 直出 +
部分 204 空体,故响应层用 `body<T>()` 裸体透传;`listPersons`/`listTasks`/`listPlaces` 返
对象包裹体、由 store 侧解包。

同批未入库的 12 份 `review-*.diff`:按入库规则,评审 diff 包能用 `git diff <base>..<head>`
原样重放,不进库。
