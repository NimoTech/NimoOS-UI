# 可切换配色主题 — 进度台账

Plan: docs/superpowers/plans/2026-07-10-new-ui-theme-system.md
Repo: NimoOS-New-UI, branch master(用户指定不新建分支)
模式: **不提交**(用户指定)。工作树有大量既有 WIP(38改+8新)。每任务前 git stash create 抓快照做隔离审查, 全程零 commit。改动留在工作树, 收尾走 ./scripts/deploy.sh。

- [x] Task 1: 主题 store (theme.ts + test) — complete (files src/stores/theme.ts + theme.test.ts, 4/4 tests, review clean)
- [x] Task 2: mount 前应用防闪 (main.ts + index.html) — complete (main.ts import+applyTheme call, index.html head script; build+tsc 绿; review clean)
- [x] Task 3: 白色覆盖块 (theme.css) — complete (插入 :root[data-theme=light] 全 token+滚动条+光斑关闭, 值 byte-match THEMING.md, 纯新增, build 绿; review Approved)
- [x] Task 4: 顶栏 ThemeToggle + i18n — complete (ThemeToggle.vue+test, 3 i18n键双份, HomeTopbar 挂载; review 抓到 --hover/--accent-text 未全局定义 Important, 已修为 --tool-bg-hi/--accent; 2/2+parity+tsc 绿)
- [x] Task 5: 提升扩展/语义 token 为全局 — complete (27 token 加入 :root+light 两块, 值 byte-match, THEMING.md §2.12 同步, 纯新增, build 绿; review Approved)
- [x] Task 6: 删 SearchDialog/MediaViewer 本地板 — complete (两处 local palette 全删, 改吃全局 token, 残留字面色均加 theme-exception 注释; 42 测试+tsc 绿; review Approved, 3 concerns 全 accept)
- [x] Task 7: 收编全站散落硬编码色 — complete (5 并行 batch + 1 集中清理; 关键发现: 多数为 var(--token,fallback) 本就themeable; 补 --remove-fg/--drop-bad/--skeleton-bg 3 全局token; 裸阴影→--card-shadow-hi; 装饰bokeh/缩略图徽标→theme-exception)
- [x] Task 8: guard 测试(import.meta.glob, 允许 var(fallback)+声明级 theme-exception) + 全量验证 — guard 66/66, 全套 625/625, tsc 干净, build 绿; 部署待用户确认

## Minor findings (for final review)
- T1 Minor: theme.ts 中 localStorage key 'theme' 字面量重复两处, 未抽常量(locale.ts 同样未抽)。非阻塞。
- T3 note(doc): Vite 压缩会去掉属性选择器引号, Task 8 验证 grep 应用 'data-theme=light'(无引号)。
- T6 Minor: SearchDialog L418 注释写"米白纸感"但 --overlay-bg 白主题实为暖色暗 scrim, 注释误导, 待修。
- T6 followup: 视觉冒烟未做, Task 8 部署时人工扫搜索面板/音频面板 白+蓝两态。

## 最终整分支审查 (opus)
- 覆盖: token 一致性 verified SOUND(全 color token 两块都有值; 无结构token误入light; 无无fallback的未定义token)。
- 阻塞2项已修: B1 ClockWidget 表盘刻度写死白(light 不可见)→ --spark-grid/--fg-faint/--fg-muted; B2 ImageViewer 工具条 --card-bg(蓝主题白玻璃washout)→ --popup-bg+blur。
- defer: ViewerShell .overlay::before bokeh 在 light 仍显(装饰,cosmetic); guard 不抓具名色/同行多字面量(当前0命中,future-proof); theme key字面量重复; SearchDialog 注释措辞; np-time=--fg-muted(accept); 阴影几何(accept)。
- 修后: guard 66/66, viewers+widgets 52/52, 全套绿, tsc 干净, build ✓。
