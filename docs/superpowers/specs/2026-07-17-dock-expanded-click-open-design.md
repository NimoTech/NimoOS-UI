# Dock 展开态点击直接打开应用(设计)

日期:2026-07-17
状态:用户已确认(点开后展开区自动收起)

## 问题

Dock 点"所有应用"展开后,点击任何应用图标都没反应。根因:展开态为了支持拖拽排序,
`HomeDock.vue` 在 `pointerdown` 捕获阶段立即 `setPointerCapture` 把指针抓给 nav 容器;
按 Pointer Events 规范,capture 生效期间 `click` 会派发给 capture 元素而不是原目标,
`DockApp` 的 `@click`(→ `openApp`)永远收不到。收起态不启用拖拽,所以常用区平时正常。

## 设计

1. **惰性接管指针(根因修复)**:`setPointerCapture` 从 `onDragStart`(按下)挪到
   `onDragMove` 首次越过 5px 拖动阈值处(`root.setPointerCapture(drag.pointerId)`)。
   - 纯点击(未越阈值)全程不被劫持 → 原生 click 落到图标 → `openApp()`:
     运行中开页面、已停止弹启动确认框(2026-07-17 启动流程 spec)。
   - 拖拽排序不变:move/up 监听本来就挂在 window,capture 只为拖动中不丢事件,
     越阈值后才需要。拖后误触点击仍被 `justDragged` 拦截。
2. **点开后自动收起**:`DockApp.onClick` 在 `openApp()` 后,若 `dock.expanded` 为真则
   `toggleExpanded()` 收起。点已停止应用(弹启动框)同样收起,弹窗在上层不受影响。
   `justDragged` 早退分支不收起(拖完不算点开)。

## 测试

- HomeDock:展开态 `pointerdown` 不调用 `setPointerCapture`;pointermove 越过阈值后调用(spy)。
- DockApp/HomeDock:展开态点击应用 → 触发打开且 `expanded` 变 false;收起态点击不受影响。
- jsdom 不模拟 capture 对 click 的劫持,"点击可用"以真机验收为准;单测锁的是
  "不再提前抓指针"这一不变量,防回归。

## 不做的事

- 不动收起态的点击路径、不动拖拽落点计算(computeDropTarget)、不动放大动效。
