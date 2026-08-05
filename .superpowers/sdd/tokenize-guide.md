# 收编硬编码色 → theme token（共享映射指南）

在你负责的文件的 `<style>` 块 / `.css` 里，把写死的颜色(`#hex` / `rgb()` / `rgba()` / 具名色如 `white`/`black`)换成 `var(--token)`。token 已全局定义在 `src/styles/theme.css` 的 `:root`(蓝)和 `:root[data-theme="light"]`(白)两块，任何 `var(--…)` 都会随主题自动切换。

## 铁律
- **不要编辑 `src/styles/theme.css`、`src/i18n/*`、任何 `*.test.ts`。** 只改分配给你的文件。
- 若某处颜色**现有 token 表达不了**(需要新语义)，**不要新增 token、不要就地写死**——在你的报告里列出「文件:行 + 原色值 + 建议语义名」，留给协调者集中加。该行**暂时保留原样**。
- 已经带 `/* theme-exception: … */` 注释的行(注释在同一行**或紧邻上一行**)**保持不动**——那是有意例外。
- 只动颜色。不要改布局/尺寸/动画/逻辑,不要重排其它代码。
- 纯中性、确与主题无关的值(如叠在用户图片/视频缩略图上的图标白、纯黑投影),若换 token 会破坏语义,则**保留字面值并在该行加 `/* theme-exception: 原因 */`**。谨慎使用,大多数颜色都应能映射到 token。

## 语义 → token 映射
| 硬编码语义 | 换成 |
|---|---|
| 页面/根底色 | `var(--bg)` |
| 卡片/浮层面板底(白或深玻璃) | `var(--card-bg)`;实色卡片也可 `var(--card)` |
| 模态弹层底(Dialog/Menu/Context) | `var(--popup-bg)` |
| 内嵌区/子面板底 | `var(--inner-bg)` / `var(--inner-bg-hi)` |
| 工具按钮底 / hover 底 | `var(--tool-bg)` / `var(--tool-bg-hi)`;通用 hover 也可 `var(--hover)` |
| chip/胶囊按钮底 | `var(--chip-bg)` / `var(--chip-bg-hi)` |
| 正文/主文字 | `var(--fg)` |
| 次要文字 | `var(--fg-muted)` |
| 更弱提示文字 | `var(--fg-faint)` 或 `var(--fg-subtle)` |
| 描边/边框 | `var(--card-border)` / `var(--border)` / `var(--inner-border)` |
| 分隔线 | `var(--divider)` |
| 主强调(链接/选中/主按钮底/焦点环) | `var(--accent)`;强调文字 `var(--accent-text)` |
| 强调渐变(主按钮/高亮) | `linear-gradient(135deg, var(--grad-a), var(--grad-b))` |
| 强调淡底 / 更淡 / 描边 | `var(--accent-soft)` / `var(--accent-soft-2)` / `var(--accent-soft-bd)` |
| 强调色上的文字 | `var(--on-accent)` |
| 成功/正向 | `var(--good)` 或 `var(--success)` |
| 危险/删除/错误 | `var(--remove-bg)` |
| 语义:相关-绿 / 降权-琥珀 / 正文-灰 | `var(--sem-bg|-fg|-bd)` / `var(--dem-bg|-fg|-bd)` / `var(--nrm-bg|-fg|-bd)` |
| 搜索命中高亮 | `var(--hit-bg)` / `var(--hit-fg)` |
| 卡片柔投影 | `var(--card-shadow)` / `var(--card-shadow-hi)` |
| 图标方格投影 | `var(--icon-shadow)` |
| 模态遮罩底 | `var(--overlay-bg)`(配 `backdrop-filter: var(--overlay-blur)`) |
| 模糊 backdrop-filter | `var(--blur)` |
| 环形/迷你图轨道/填充 | `var(--ring-track)` / `var(--spark-fill)` / `var(--spark-grid)` |

## 验证(你自己做,轻量)
改完你负责的每个文件后:
1. `grep -nE '#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\(' <file>` 复查 `<style>` 内命中——应只剩带 `theme-exception` 注释的行,或你在报告里列出的「需新 token」暂留行。
2. **不要**跑 `pnpm build`(协调者集中跑)。只做上面的 grep 自查。
