### Task 7: `usePlacesView.ts` —— 视图变换与手势

**Files:**
- Create: `src/photos/composables/usePlacesView.ts`
- Create: `src/photos/composables/__tests__/usePlacesView.test.ts`
- Read-only 参考: `PhotosPlacesView.vue:561-735`(整段 —— svgPoint / visibleCenterVb / applyZoom / stopViewAnim / animateView / centerOn / zoomBy / setScale / onWheel / splitScaleFor 调用 / zoomToCluster / screenToVbScale / onPointerDown/Move/Up / autoPan / pickPin)

**Interfaces:**
- Consumes: `MAX_SCALE`, `splitScaleFor`, `type Place`, `type Pin`(T2);`MAP_W`, `MAP_H`, `project`(`util/worldMap.ts`)
- Produces:
  ```ts
  export interface PlacesView { tx: number, ty: number, scale: number }
  export interface UsePlacesViewOptions {
    svgEl: Ref<SVGSVGElement | null>
    wrapEl: Ref<HTMLElement | null>       // 地图包裹层(算可见中心用),显式 ref 不靠 parentElement(偏离登记 10)
    hasDetailPanel: () => boolean         // P6a 恒 false;P6b 接上详情面板后返回真
  }
  export function usePlacesView(opts: UsePlacesViewOptions): {
    view: Ref<PlacesView>
    zoomFrac: ComputedRef<number>         // (scale - 1) / (MAX_SCALE - 1)
    svgPoint(clientX: number, clientY: number): { x: number, y: number }
    screenToVbScale(): number
    visibleCenterVb(): { x: number, y: number }
    applyZoom(next: number, vbX: number, vbY: number): void
    animateView(target: PlacesView, duration?: number): void
    stopViewAnim(): void
    centerOn(wx: number, wy: number, scale: number): void
    zoomBy(factor: number): void
    setScale(s: number): void
    reset(): void
    autoPanTo(place: Place | null | undefined): void
    zoomToCluster(pin: Pin, currentScale: number): void
    onWheel(e: WheelEvent): void
    onPointerDown(e: PointerEvent): void
    onPointerMove(e: PointerEvent): void
    onPointerUp(e: PointerEvent): void
    dispose(): void
  }
  ```

**关键实现约束(逐条照 Vue2,每条都要有测试):**

1. **`svgPoint` 必须补 letterbox 偏移**(Vue2 `:564-576`):`preserveAspectRatio="xMidYMid meet"` 会在 svg 元素内留黑边,`fit = Math.min(rect.width / MAP_W, rect.height / MAP_H) || 1`,`ox = (rect.width - MAP_W * fit) / 2`、`oy` 同理,返回 `((clientX - rect.left - ox) / fit, ...)`。**svg 为 null 时返回地图正中 `(MAP_W/2, MAP_H/2)`**。
2. **`applyZoom(next, vbX, vbY)` 定点缩放**(Vue2 `:585-594`):先 `stopViewAnim()`;`clamped = clamp(next, 1, MAX_SCALE)`;**`clamped === old` 时直接 return**(不产生新对象,避免无谓重渲染);`wx = (vbX - tx) / old`、`wy` 同理;新 `tx = vbX - wx * clamped`。**不变量:换算前后 `(vbX, vbY)` 对应的世界点不变** —— 这是最重要的测试。
3. **`animateView(target, duration = 420)` easeOutCubic**(Vue2 `:605-620`):`ease = t => 1 - (1 - t) ** 3`;用 `requestAnimationFrame`;`k` 用 `Math.min(1, (now - t0) / duration)` 钳制;`k < 1` 时续帧、否则把 `_raf` 置 null。**起手先 `stopViewAnim()`**。
4. **`stopViewAnim`**(Vue2 `:597-602`):有 `_raf` 就 `cancelAnimationFrame` + 置 null。**`onWheel` / `onPointerDown` 都必须先调它**(即时交互抢占在途缓动,Vue2 `:636`/`:704`)。
5. **`visibleCenterVb`**(Vue2 `:578-583`):`panelFrac = (rect && hasDetailPanel()) ? Math.min(0.55, 420 / rect.width) : 0`,返回 `{ x: MAP_W * (1 - panelFrac) / 2, y: MAP_H / 2 }`。**P6a 的 `hasDetailPanel()` 恒 false 于是 panelFrac 恒 0,但分支要建齐并单测**(spec §7b 的中间态登记)。
6. **`centerOn(wx, wy, scale)`**(Vue2 `:622-626`):把世界点(`project()` 输出,scale-1 单位)放到可见中心;走 `animateView`(不是瞬移)。
7. **`autoPanTo(place)`**(Vue2 `:724-735`):**必须从传入的 place 取 lon/lat,绝不从「当前详情」取** —— Vue2 的注释写明了原因:autoPan 在 `activeId` watcher 里、`loadDetail` 之前触发,此时详情还是上一个地点的(且详情 payload 没有 lon/lat),会平移到错位置或 NaN(地图完全不动)。`place` 为空直返;`centerOn(x, y, Math.max(view.scale, 1.8))`。
8. **`zoomToCluster(pin, currentScale)`**(Vue2 `:661-664`):`next = Math.max(currentScale + 0.01, splitScaleFor(pin.members, currentScale))`,`centerOn(pin.x, pin.y, next)`。**`+0.01` 不能省** —— 否则裂不开的簇点了完全没反应。
9. **拖拽**(Vue2 `:701-723`):`onPointerDown` 里 **`e.target.closest('.geo-pin')` 命中时直接 return**(图钉点击不触发平移);记 `{x, y, tx, ty, s: screenToVbScale()}`;`setPointerCapture`。`onPointerMove` 用 `tx + (e.clientX - x) * s`。`onPointerUp` 清 `_drag` + `releasePointerCapture`(**包 try/catch**,Vue2 `:717-722`;P2 教训:丢失的 pointerup 会让 capture 泄漏)。
10. **`onWheel`**(Vue2 `:635-639`):`e.preventDefault()`;`factor = e.deltaY < 0 ? 1.18 : 1 / 1.18`;以指针所在 viewBox 点为锚做 `applyZoom`。**注册时必须 `{ passive: false }`**(偏离登记 11-⑤;由 T11 容器用 `addEventListener` 显式注册,**不用 `@wheel` 模板绑定** —— Vue 的模板绑定默认不给 passive:false 保证,Chrome 会警告 preventDefault 被忽略)。
11. **`dispose()`**:取消在途 rAF(照 Vue2 `beforeDestroy` `:359-361`)。T11 在 `onUnmounted` 里调。

- [ ] **Step 1: 写失败测试**

测试要点(jsdom 里 `getBoundingClientRect` 恒返 0,**必须 mock**):

```ts
// 让 svgEl.getBoundingClientRect 返回可控矩形。故意用非等比矩形把 letterbox 逼出来:
// 1200×400 对 1000×500 → fit = min(1.2, 0.8) = 0.8 → ox = (1200 - 800)/2 = 200, oy = 0
function mockSvg(width: number, height: number, left = 0, top = 0): SVGSVGElement {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  el.getBoundingClientRect = () => ({ width, height, left, top, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) }) as DOMRect
  el.setPointerCapture = vi.fn()
  el.releasePointerCapture = vi.fn()
  return el
}
```

必含用例:
- `svgPoint`:1200×400 的 svg、点 `(200, 0)` → viewBox `(0, 0)`;点 `(1000, 400)` → `(1000, 500)`。**这两个数手算自 fit=0.8/ox=200,不许拿实现输出反填。**
- `svgPoint`:`svgEl` 为 null → `(500, 250)`。
- **定点缩放不变量**:`applyZoom(3, 400, 250)` 后,`(400 - tx) / 3` 必须等于缩放前的 `(400 - tx0) / scale0`(用 `toBeCloseTo`)。再随机取三组 `(scale, anchor)` 重复验。
- `applyZoom` 钳制:传 0.1 → scale 变 1;传 999 → 变 `MAX_SCALE`;**已在 MAX_SCALE 再传更大值时 `view` 对象引用不变**(证明 `clamped === old` 的 early return 生效)。
- `zoomFrac`:scale=1 → 0;scale=MAX_SCALE → 1;scale=8.5 → 0.5。
- `animateView`:用 `vi.useFakeTimers()` + 手动驱动 rAF(把 `globalThis.requestAnimationFrame` 换成收集回调的假实现),断言起点值、中途 `k` 落在 (0,1) 时 scale 在起止之间、`t >= duration` 后**精确等于** target 且 `_raf` 已置 null。
- `animateView` 期间调 `applyZoom` → 在途动画被取消(断言假 rAF 的 cancel 被调用,且后续手动推帧不再改 `view`)。
- `visibleCenterVb`:`hasDetailPanel()` 返 false → `x === MAP_W / 2`;返 true 且 wrap 宽 1000 → `panelFrac = 0.42`、`x = 290`;wrap 宽 500 → `panelFrac` 被 `Math.min(0.55, …)` 钳到 0.55、`x = 225`。**三个数手算。**
- `autoPanTo`:传含 lon/lat 的 place → 最终 `view` 让该点落在可见中心(推完动画帧后断言);**传 null / undefined → `view` 完全不变**;`scale` 至少 1.8(当前 1 时升到 1.8,当前 3 时保持 3)。
- `zoomToCluster`:共点成员的簇(`splitScaleFor` 返 MAX_SCALE)→ 目标 scale 为 MAX_SCALE;可裂开的簇 → 目标 scale > 当前;**当前已在 MAX_SCALE 时目标仍 > 当前(靠 `+0.01`)但被钳回 MAX_SCALE**,且不抛。
- `onWheel`:`deltaY < 0` 放大、`> 0` 缩小;`preventDefault` 被调用;缩放锚点是指针位置(复用定点不变量断言)。
- 拖拽:`onPointerDown` 后 `onPointerMove` 位移 100px、`screenToVbScale` 为 1.25(svg 1000 宽对 MAP_W 1000... 用可控矩形算)→ `tx` 增量 = 100 × 1.25。**`onPointerMove` 未经 down 时是 no-op。**
- 拖拽:`e.target` 在 `.geo-pin` 内时 `onPointerDown` 直接返回(`setPointerCapture` 未被调用、后续 move 不改 view)。**用真实 DOM:造 `<g class="geo-pin"><circle/></g>`,target 取 circle,验 `closest` 生效。**
- `onPointerUp`:`releasePointerCapture` 抛异常时不冒泡(包了 try/catch),且 `_drag` 已清(后续 move 不改 view)。
- `dispose()` 取消在途 rAF。

- [ ] **Step 2: 跑测试确认失败**
- [ ] **Step 3: 实现**
- [ ] **Step 4: 跑测试确认通过 + 逐个删码验证**

删码清单(一次只删一处):①`svgPoint` 的 `ox`/`oy` 去掉 → letterbox 用例红;②`applyZoom` 的 `clamped === old` early return 删掉 → 「对象引用不变」红;③`applyZoom` 的定点换算改成直接改 scale(不动 tx/ty)→ 定点不变量红;④`animateView` 起手的 `stopViewAnim()` 删掉 → 「在途动画被取消」红;⑤`autoPanTo` 的空值守卫删掉 → 「传 null 不变」红;⑥`zoomToCluster` 的 `+0.01` 删掉 → 「已在 MAX_SCALE 时不抛且目标 > 当前」红;⑦`onPointerDown` 的 `.geo-pin` 排除删掉 → 图钉拖拽用例红;⑧`onPointerMove` 的 `if (!_drag) return` 删掉 → no-op 用例红;⑨`ease` 换成线性 → 中途值用例红(**若不红说明中途断言太松,要改成断言具体 easeOutCubic 值**)。

- [ ] **Step 5: Commit** — `feat(photos): P6a-T7 地图视图变换与手势 composable(letterbox 换算/定点缩放/easeOutCubic 缓动/拖拽)`

---

