# SP7-P1/P2 台账(灯箱期,2026-07-23)

这一批 21 份文件在 `.sp7/NimoOS-New-UI/.superpowers/sdd/` 里是**平铺在顶层**的 ——
SP7 开工时还没有"每期一个目录"的约定(P3 起才有)。2026-08-05 台账入库时,
master 的 `.superpowers/sdd/` 顶层已经有另一期同名的 `task-N-{brief,report}.md`,
直接搬会互相覆盖,故整批收进本目录,**文件内容一个字没动**。

内容:P2 灯箱期的 9 组任务简报 + 实现报告(Task 1-9)、`final-fix-p1-report.md`
(P1 终审修复波)、`p1-restyle-report.md`(P1 选择框改 Files 风格的真机验收补丁)。

同批未入库的:161 份 `review-*.diff` —— 按 `.superpowers/.gitignore` 的规则,
评审 diff 包能用 `git diff <base>..<head>` 原样重放,不进库。
