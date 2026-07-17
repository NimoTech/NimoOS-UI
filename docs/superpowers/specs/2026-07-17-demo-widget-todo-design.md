# 演示小组件改造：真实 Todo List — 设计文档

日期：2026-07-17
状态：已与用户对齐（存储 = localStorage；功能 = 添加 + 删除 + 打勾完成）

## 背景

`examples/demo-widget/` 是桌面容器小组件识别（`nimoos.*` label 契约）的真机验收工具。
其 `html/widget/index.html` 目前是写死的假数据（"演示任务 / 3 个进行中 / 速度 2.1 MB/s"），
无任何交互。用户希望它成为一个真正可用的 todo list：能添加、能打勾完成、能删除。

## 范围

**只改一个文件**：`examples/demo-widget/html/widget/index.html`（原生 HTML+JS，无构建步骤）。

不改动：Dockerfile（保持 `nginx:alpine` 纯静态）、run.sh、label 契约、widget-kit.css、
容器主页面 `html/index.html`、NimoOS-AI 的 desktop-app-builder skill seed（本次不动契约，无需升版本）。

## 数据

- 存储：浏览器 `localStorage`，键 `nimoos.demo.todos`。
- 格式：`[{ id: string, text: string, done: boolean }]`。
- 首次打开（键不存在）预置两条示例待办。
- 读取时 JSON 解析失败或结构不对 → 回退为空数组（不崩）。
- 特性说明：数据跟浏览器走（按 origin 隔离），换设备/浏览器各自独立——演示场景可接受，
  已与用户确认。

## 界面与交互

沿用官方 widget-kit（`nk-*` 类 + `--nk-*` 颜色变量），主题跟随桌面 `?theme=` 参数，
现有的 theme/引入 widget-kit 的 `<script>` 头保持原样。

布局（2×2 小卡片）自上而下：

1. `nk-title` 标题「待办事项」
2. `nk-stat`：`N 个进行中`（未完成条数，实时更新）
3. `nk-progress` 进度条：宽度 = 已完成 / 总数（总数为 0 时宽度 0）
4. 输入行：文本输入框 + `+` 按钮；回车或点按钮添加；空白输入忽略
5. 待办列表（超高时列表区内部滚动）：
   - 每条 = 勾选框 + 文本 + `×` 删除按钮
   - 打勾 → `done=true`，文本划掉线变淡；再点可取消
   - `×` → 直接删除该条（无确认，演示组件不做二次确认）
   - 文本过长单行截断（ellipsis），`title` 属性悬停可见全文
6. 列表为空时显示「没有待办」空态文案

所有交互后立即写回 localStorage 并重渲染计数/进度条。

自定义样式仅限少量内联 `<style>`，颜色一律用 `--nk-fg/--nk-muted/--nk-faint/--nk-accent/
--nk-divider/--nk-track` 等 kit 变量，不写死色值，保证深浅主题都正常。

新增文本渲染必须用 `textContent`（不用 innerHTML 拼接用户输入），避免注入。

## 错误处理

- localStorage 不可用（隐私模式等极端情况）：功能退化为仅内存态，刷新丢失，不报错。
- JSON 损坏：回退空列表。

## 测试与验证

纯静态演示 HTML，不纳入主仓 vitest。验证方式为真机手动验收：

```bash
cd NimoOS-New-UI/examples/demo-widget && ./run.sh
```

30 秒内 `/app/` 桌面出现小组件，依次验证：添加若干条 → 打勾 → 计数/进度条变化 →
删除 → 全删空态 → 刷新页面数据仍在 → 切浅色主题样式正常。
