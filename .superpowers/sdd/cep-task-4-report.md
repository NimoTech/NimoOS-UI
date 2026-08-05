# Task 4 报告:前端事件桥 + Home.vue 接线

## 实现内容

严格按 brief 逐步执行,代码与 brief 提供的代码块逐字一致(未做任何改动)。

1. **`src/home/containerEventBridge.ts`**(新建) — 纯逻辑桥:
   - `export const CONTAINER_EVENT = 'docker:container:state-changed'`
   - `createContainerEventHandler({ evict, refresh, debounceMs? })`:
     - 畸形/非对象 `props` 兜底为 `{}`,不抛错
     - `action === 'destroy' && name` 时立即 `evict(name)`
     - 每次调用都 (re)设置一个 `debounceMs`(默认 500ms)的 `setTimeout`,连续事件只在静默期后触发一次 `refresh()`

2. **`src/home/containerEventBridge.test.ts`**(新建) — 4 个用例,覆盖:契约字符串、destroy 立即 evict 且仅一次、连发事件去抖成一次 refresh、畸形消息不抛错不触发 evict。

3. **`src/views/Home.vue`**(修改) — 接线:
   - import 追加 `useMessageBus` 与 `createContainerEventHandler, CONTAINER_EVENT`
   - `let offContainerEvents: (() => void) | null = null` 追加到既有 `let` 声明组
   - `onMounted` 内 `window.addEventListener('focus', onFocus)` 之后订阅 `CONTAINER_EVENT`,`evict` 桥接到 `layout.evict(k)`,`refresh` 桥接到既有 `refreshApps`
   - `onUnmounted` 内追加 `if (offContainerEvents) offContainerEvents()` 做清理

## TDD 证据

**RED**(模块不存在):
```
$ pnpm exec vitest run src/home/containerEventBridge.test.ts
 FAIL  src/home/containerEventBridge.test.ts [ src/home/containerEventBridge.test.ts ]
Error: Failed to resolve import "./containerEventBridge" from "src/home/containerEventBridge.test.ts". Does the file exist?
...
 Test Files  1 failed (1)
      Tests  no tests
```

**GREEN**(实现后):
```
$ pnpm exec vitest run src/home/containerEventBridge.test.ts
 Test Files  1 passed (1)
      Tests  4 passed (4)
```

## 类型检查 + 全量测试(Step 6)

```
$ pnpm exec vue-tsc --noEmit
(无输出 = 无类型错误)

$ pnpm test
 Test Files  150 passed (150)
      Tests  688 passed (688)
   Duration  28.32s
```

无任何失败,无既有失败用例需要记录。

## 文件变更

- 新建 `/home/nimo/NimoTech/NimoOS-New-UI/src/home/containerEventBridge.ts`
- 新建 `/home/nimo/NimoTech/NimoOS-New-UI/src/home/containerEventBridge.test.ts`
- 修改 `/home/nimo/NimoTech/NimoOS-New-UI/src/views/Home.vue`(+10 行,均为 import/声明/订阅/清理,无既有逻辑改动)

## 提交

```
25f99fa feat(home): 订阅 docker 容器事件推送,桌面秒级同步(destroy 即清,余者去抖刷新)

 src/home/containerEventBridge.test.ts | 38 +++++++++++++++++++++++++++++++++++
 src/home/containerEventBridge.ts      | 20 ++++++++++++++++++
 src/views/Home.vue                    | 10 +++++++++
 3 files changed, 68 insertions(+)
```

`git add` 严格限定为 brief 指定的三个文件;`git status` 确认 `src/files/viewers/MediaViewer.vue` 与
`src/files/viewers/audioTranscripts.ts` 的既有未提交改动未被触碰、未被暂存、未被提交,提交前后保持
"modified, not staged" 状态不变。

## 自查(self-review)

- 契约字符串逐字核对:`docker:container:state-changed`、`docker:container:name`、
  `docker:container:action` —— 与 brief/后端契约完全一致。
- 无颜色字面量、无新增 i18n key(本任务纯逻辑 + 接线,无样式无文案)。
- `containerEventBridge.ts` 是纯函数模块,不依赖 Vue/Pinia/messageBus,便于单测,Home.vue 只做胶水代码 —— 符合 brief 设计意图。
- 幂等性/多事件合并:`evict` 由 `layout.evict` 自身保证幂等(内部按数组过滤 + `Set.delete`,重复调用无副作用);`refresh` 通过 debounce 合并多次事件为一次 `refreshApps()` 调用,满足"一次用户操作产生 die+destroy 两个 daemon 事件"时不重复刷新的要求。
- `offContainerEvents` 清理时机与既有 `onFocus`/`onResize` 等清理模式一致,无遗漏。
- 未改动 `useMessageBus.ts` 或 `layout.ts`(均为既有接口按原样消费)。

## 关注点(concerns)

无。实现与 brief 逐字一致,typecheck 与全量测试(150 文件 / 688 用例)全绿,未发现回归。

---

## 追加:评审修复(dispose 可取消去抖定时器)

### 问题(评审提出,Important)

`createContainerEventHandler` 原实现把去抖 `setTimeout` 封闭在返回的回调函数闭包里,
外部除了能从 `useMessageBus` 的 listener `Set` 里摘掉回调(`offContainerEvents()`)之外,
**没有任何手段能取消已经排定但尚未触发的定时器**。若组件卸载前 500ms 内恰好收到一个
容器事件,卸载后定时器仍会在到期时调用一次 `refreshApps()`——当前只是浪费一次 HTTP
请求,但若未来 `refreshApps` 触碰组件局部状态(如 ref/emit),会变成真实的"访问已卸载
组件"bug。

### 修复内容

1. **`src/home/containerEventBridge.ts`**:`createContainerEventHandler` 返回值从单个
   回调函数改为 `{ handle: (props: unknown) => void; dispose: () => void }`。
   `dispose()` 检查闭包内的 `timer`,若非空则 `clearTimeout` 并置回 `null`;重复调用
   `dispose()` 无害(幂等)。`handle` 的行为与原实现完全一致(destroy 立即 evict + 去抖
   刷新)。

2. **`src/views/Home.vue`**:
   - 新增 `let containerEventBridge: ReturnType<typeof createContainerEventHandler> | null = null`
   - `onMounted` 内:先 `containerEventBridge = createContainerEventHandler({ evict, refresh })`,
     再 `offContainerEvents = useMessageBus().on(CONTAINER_EVENT, containerEventBridge.handle)`
   - `onUnmounted` 内:`offContainerEvents()` 退订消息总线监听 **之后**,追加
     `if (containerEventBridge) containerEventBridge.dispose()` 取消待触发定时器

3. **`src/home/containerEventBridge.test.ts`**:既有 4 个用例改为解构 `{ handle }` 后调用
   `handle(...)`(原先直接调用返回的函数);新增第 5 个用例——事件到达后(排定了去抖
   定时器)、500ms 静默期结束前调用 `dispose()`,推进 fake timers 到 500ms 之后,断言
   `refresh` 未被调用;并断言重复调用 `dispose()` 不抛错(幂等)。

### TDD 证据(修复)

**RED**(测试文件先改为 `.handle`/新增 dispose 用例,此时实现仍是旧签名):
```
$ pnpm exec vitest run src/home/containerEventBridge.test.ts
 FAIL  src/home/containerEventBridge.test.ts > containerEventBridge > 连发事件去抖成一次 refresh
TypeError: handle is not a function
 FAIL  src/home/containerEventBridge.test.ts > containerEventBridge > 畸形消息(缺属性/非对象)不抛错不触发 evict
AssertionError: expected [Function] to not throw an error but 'TypeError: handle is not a function' was thrown
 FAIL  src/home/containerEventBridge.test.ts > containerEventBridge > dispose 取消待触发的去抖定时器,卸载后不再 refresh
TypeError: handle is not a function

 Test Files  1 failed (1)
      Tests  4 failed | 1 passed (5)
```

**GREEN**(实现改为 `{ handle, dispose }` 后):
```
$ pnpm exec vitest run src/home/containerEventBridge.test.ts
 Test Files  1 passed (1)
      Tests  5 passed (5)
```

### 类型检查与全量测试(修复后)

```
$ pnpm exec vue-tsc --noEmit
(无输出 = 无类型错误)

$ pnpm test
 Test Files  150 passed (150)
      Tests  689 passed (689)
   Duration  27.43s
```

（较修复前的 688 增加 1 —— 新增的 dispose 用例；无任何失败，无既有失败用例。）

### 提交

```
d0526e7 fix(home): 容器事件桥去抖定时器可显式 dispose,卸载后不再残留 refresh

 src/home/containerEventBridge.test.ts | 13 +++++++++++--
 src/home/containerEventBridge.ts      | 12 ++++++++----
 src/views/Home.vue                    | 21 +++++++++++----------
 3 files changed, 31 insertions(+), 15 deletions(-)
```

`git add` 仍严格限定为这三个文件;`src/files/viewers/MediaViewer.vue` 与
`src/files/viewers/audioTranscripts.ts` 的既有未提交改动继续未被触碰。

### 自查(本次修复)

- `dispose()` 幂等:内部先判空再 `clearTimeout`,重复调用安全,已有专门用例覆盖。
- `handle` 的原有语义(destroy 立即 evict、去抖合并 refresh、畸形消息兜底)未改动,仅
  返回结构从函数变为对象,调用方(`useMessageBus().on` 的第二参)传 `bridge.handle`
  即可,签名 `(props: unknown) => void` 不变。
- `Home.vue` 卸载顺序:先退订消息总线(防止 `dispose` 之后、卸载完成前又收到新事件重新
  排定定时器),再 `dispose()` 清理已排定的旧定时器——顺序正确,不存在竞态窗口。
- 无颜色字面量、无新增 i18n key(纯逻辑修复)。
