### Task 6 报告: `AlbumLibraryPicker.vue` —— 从图库挑照片加入本相册

**Commit**: `6990e00` feat(photos): 图库选择器(挑照片加入相册,已在相册项禁选)

## 实现了什么

`src/photos/components/AlbumLibraryPicker.vue`,契约严格照 brief:

```ts
props:  { open: boolean; albumId: string | number; albumName: string }
emits:  { 'update:open': [boolean]; added: [count: number] }
```

- **数据源**:`useTimelineStore().allPhotos`(展平 computed)取来再本地按 `takenAt` 降序排序,不重写展平逻辑。
- **已在相册判定(铁律)**:`existingIds = new Set(albums.assetsOf(albumId).map(p => String(p.id)))`,`isExisting(p)` 用 `existingIds.has(String(p.id))`。已在相册的瓦片:图片变暗(`opacity:0.45`)+ 满铺覆盖标记(check 图标 + `photosAlbumPickerAlready` 文案),点击直接 `return`,不进 `selected`。
- **缩略图**:`service.photos.thumbnailUrl(p.id, 'small')`,无手拼 URL。
- **选择/提交**:选中态 outline + 打勾徽标;主按钮 `photosAlbumPickerAdd {count}`,`disabled` 于无选择或 `adding` 中;点击后 `adding=true` → `albums.addAssetsToAlbum(albumId, ids)` → 成功 toast `photosAlbumAddedToast` + `emit('added', count)` + 关闭;失败 `console.error` + toast `photosAlbumAddFailed`,**面板不关、`selected` 不清空**,`finally` 里 `adding=false`。
- **放弃未保存选择确认条**(Vue2 `window.confirm` 记账偏离为面板内联条,同 T5 理由):有选择时点取消 → 显示确认条(`photosAlbumPickerDiscard` + 两个按钮);「返回」收起确认条(不关面板,选择保留);「确认」(复用已有通用键 `filesConfirm`,见下方“brief 出入”)才真正关闭。无选择时点取消直接关闭。
- **Esc**:document 级 `keydown` 监听(不用模板 `@keydown.esc`),`watch(open)` 负责挂/摘,`onUnmounted` 兜底摘除。分层:确认条展开时 Esc 只收起确认条(不强制关闭——放弃必须显式点确认按钮,与鼠标路径的安全语义一致);无确认条时 Esc 走 `attemptClose()`(有选择先弹确认条,无选择直接关)。
- **`open` 监听**:变 true 时清空 `selected`/`discardConfirm`/`adding`;若 `timeline.months` 为空则 `void timeline.fetchTimeline()`。
- **颜色**:遮罩 `--overlay-bg`,面板 `--popup-bg`(不用 `--card-bg`),文字/边框/分割线均 token;打勾图标背景 `--accent` + 前景 `--on-accent`(Vue2 `color="white"` 的等价物);「已在相册」覆盖标记背景 `--overlay-bg` + 文字 `--fg`(沿用 `PhotosGrid.vue` 的 `.tile-fav` 已验证过的同一组合,未另造 token)。

## 测了什么及结果(TDD 证据)

**RED**(组件文件尚不存在,先写 11 条测试):
```
pnpm test -- src/photos/components/__tests__/AlbumLibraryPicker.test.ts
```
```
FAIL  src/photos/components/__tests__/AlbumLibraryPicker.test.ts [ ... ]
Error: Failed to resolve import "../AlbumLibraryPicker.vue" from
"src/photos/components/__tests__/AlbumLibraryPicker.test.ts". Does the file exist?
 Test Files  1 failed (1)
      Tests  no tests
```
该失败是预期的(模块不存在),证明测试确实先于实现落地。

写完组件首次跑,又暴露第二层 RED(`timeline.allPhotos` 未从 store 导出,见下方“brief 出入”):
```
TypeError: Cannot read properties of undefined (reading 'slice')
 ❯ ComputedRefImpl.fn src/photos/components/AlbumLibraryPicker.vue:44:34
      const out = timeline.allPhotos.slice()
 Tests  11 failed (11)
```
修 `timeline.ts` 导出 `allPhotos` 后:

**GREEN**:
```
pnpm test -- src/photos/components/__tests__/AlbumLibraryPicker.test.ts
 Test Files  1 passed (1)
      Tests  11 passed (11)
```

11 条测试覆盖 Step 1 全部行为清单条目 + 硬约束项:
1. 展平按 `takenAt` 降序(断言瓦片顺序 `t-newest→t-mid→t-oldest`)
2. 已在相册判定 + **跨类型交叉**(相册资产走 `fetchAlbumAssets` 真实转换管线得到数字 `id:5`;时间线照片原始 `id:'5'`(字符串)命中;点击不进 selected)
3. 选中两张 → 按钮文案含 2 → 点击 → `batchAddToAlbum` 被正确参数调用 → `added(2)` + `update:open(false)` + toast
4. store 抛错 → 面板仍 open、失败 toast、按钮恢复可用、已选保留
5. 有选择点取消 → 确认条 → 确认才关;无选择点取消直接关
6. 确认条「返回」→ 收起确认条,面板仍 open,选择保留
7. 时间线为空 → `photosAlbumPickerEmpty`
8. `open` false→true 时 `months` 为空触发 `fetchTimeline`
9. `open` false→true 清空本地 `selected`
10. 瓦片走 `service.photos.thumbnailUrl` 生成(非手拼 URL)
11. Esc 分层(document 级派发):确认条展开先收起;无选择时 Esc 直接关闭

**全量 + tsc**:
```
pnpm test        → Test Files 249 passed (249) / Tests 1585 passed (1585)
pnpm exec vue-tsc --noEmit → (no output, clean)
pnpm test -- src/styles/color-guard.test.ts src/i18n/parity.test.ts → 2 passed / 115 passed
```
(基线 1573 + 11 新增 = 1584,实测 1585——多出的 1 条来自主线上其它任务在此期间的常规增量,与本任务无关,已用 `pnpm test -- <本文件>` 单独验证过 11/11。)

## 改了哪些文件

- 新增 `src/photos/components/AlbumLibraryPicker.vue`
- 新增 `src/photos/components/__tests__/AlbumLibraryPicker.test.ts`
- 修改 `src/photos/stores/timeline.ts`(+1 行,`allPhotos` 加入 store 返回对象)

## 自审

- **完整性**:brief 结构清单(标题+计数/瓦片网格/已在相册覆盖/底部按钮/空态/放弃确认)与行为规则(confirm 流程、open 监听、失败不关)逐条落实。
- **YAGNI**:~~未加 brief 未要求的东西(无 X 关闭按钮——Vue2 原版也没有;无拖拽/多选框等其它相册组件才有的功能)~~ **【更正,见文末「评审修复」】此条自审事实有误**:Vue2 源 `PhotosAlbumLibraryPicker.vue:10-12` 其实**确有**头部 X 关闭按钮(`<button class="icon-btn" @click="onScrimClose"><photos-icon name="x"/></button>`),是我核对时漏看了。brief 结构清单没列它,不算 spec 违规,但本期「界面严格 1:1 照 Vue2」的纪律要求补——已在评审后补上,见文末。无拖拽/多选框那部分判断不受影响,仍成立。
- **测试真验行为**:全部断言具体输出/调用参数/emit 载荷/toast 内容/DOM 属性,无 smoke-mount。
- **颜色全 token**:已 grep 确认无 `#hex`/`rgb()`/`rgba()`(唯一匹配是 HTML 实体 `&#10003;` 打勾字符,误报)。
- **无手拼 URL**:`thumb()` 唯一实现是 `service.photos.thumbnailUrl(id, 'small')`,测试断言了具体调用参数与 `img[src]`。
- **Esc 是 document 级**:`document.addEventListener('keydown', ...)`,由 `watch(open)` 挂/摘 + `onUnmounted` 兜底,测试用 `document.dispatchEvent(new KeyboardEvent(...))` 派发(非模板绑定、非依赖真实焦点)。
- **归一是否到位**:`existingIds` 用 `String(p.id)` 归一,测试专门构造了「相册资产数字 id 5 / 时间线照片字符串 id '5'」的交叉用例并断言命中。

## 遗留疑虑

1. ~~确认条「确认放弃」按钮文案复用了跨域通用键 `filesConfirm`~~ **【已按评审要求修复,见文末】**——评审裁定这条不成立:本期约定新 key 用 `photos` 前缀驼峰,借用 files 域的键会让两个团队日后各自改动时互相牵连。已新增 `photosAlbumPickerDiscardConfirm` 专属键,组件改用它。
2. 「返回」按钮复用了已有的 `photosCancel`(与底部默认态的取消按钮同一文案但语义不同——一个是「取消整个操作」,一个是「取消放弃、回去继续选」)。评审复核后**认可**这条的成本收益判断,不要求升级,维持现状。

## Brief 出入记录(逐段核对 Vue2 源发现)

1. **`timeline.ts` 的 `allPhotos` computed 定义了但没导出**(Pinia setup store 只暴露 `return {}` 里列出的字段)。brief 明确写「时间线 store 有 `allPhotos`(`timeline.ts:61`,已展平)...优先复用它」,但实测 `useTimelineStore().allPhotos` 是 `undefined`——这是 T2 遗留的一个小疏漏(内部定义了但没导出)。已修:把 `allPhotos` 加入 `timeline.ts` 的 `return` 对象(+1 行),使其可以按 brief 指示被外部消费。这属于第三处发现的出入(T2/T3 各报过 1/0 处,本任务 1 处,均已现场修复,非绕过)。
2. Vue2 源(`PhotosAlbumLibraryPicker.vue`)本身没有 `<style>` 块——实际 CSS 定义在 `NimoOS-UI/src/views/Photos/photos.scss:4361-4423`(全局样式表,非组件 scoped)。为核对视觉细节(打勾徽标位置/尺寸、已在相册徽标底色)额外去读了这份 scss,brief 本身没提及这个文件——不算「出入」,但记一下溯源过程,以防后续任务需要同样交叉核对。**注**:首版实现读了这份 scss 却仍把 `opacity` 写成 `0.45`,与 scss `:4402` 的 `0.4` 不一致——不是没查,是查完抄错了数字,评审后已订正(见文末)。
3. Vue2 源头部**确有** X 关闭按钮(`:10-12`,`onScrimClose`)——首版实现遗漏,brief 结构清单也没列出它,双重疏漏叠加导致做漏。评审后按 Vue2 1:1 补上,行为复用同一套 `attemptClose()` 分层确认逻辑(不是无条件直接关)。
4. 其余(props/emits 签名、行为规则、i18n 键集)与 brief 完全一致,未发现出入。

---

## 评审修复(第二轮)

评审结论:铁律执行、Esc 分层、失败路径、五条被点名测试、双主题 token 均**通过**;`timeline.allPhotos` 漏导出的修复**裁定为最小必要修复,无异议**。以下 3 项要求整改:

### 1(Important,必须修)`filesConfirm` 跨域借键 → 新增专属键

- `src/i18n/zh_cn.ts` / `en_us.ts` 各加一行:`photosAlbumPickerDiscardConfirm`(zh `'确定'` / en `'OK'`),紧邻「库选择器」分组的 `photosAlbumPickerDiscard` 之后。
- `AlbumLibraryPicker.vue` 确认条的确认按钮改用 `t('photosAlbumPickerDiscardConfirm')`,不再引用 `filesConfirm`。
- parity 测试(`src/i18n/parity.test.ts`)在全量里自动过,无需额外断言。

### 2(顺带修)补 Vue2 头部 X 关闭按钮

- **RED 先行**:在 `AlbumLibraryPicker.test.ts` 新增一条测试(「头部 X 关闭按钮:有选中时点击 → 出确认条,update:open 未 emit;无选中时点击 → 直接关闭」),先跑红:
  ```
  pnpm vitest run src/photos/components/__tests__/AlbumLibraryPicker.test.ts
  ...
   × 头部 X 关闭按钮:有选中时点击 → 出确认条,update:open 未 emit;无选中时点击 → 直接关闭
  Error: Unable to get [data-test="lib-picker-close"] within: ...
   Tests  1 failed | 11 passed (12)
  ```
  (因为组件里当时确实没有 `data-test="lib-picker-close"` 这个按钮,失败符合预期。)
- **实现**:头部 `.lib-picker-head` 改 `display:flex`,拆出 `.lib-picker-head-text` 包裹标题+计数,新增 `<button class="lib-picker-close" data-test="lib-picker-close" @click="attemptClose">×</button>`(写法照本仓 `AlbumPickerDialog.vue` 的 `.alb-picker-close` 既有范式——24px 圆形透明底、`:hover` 用 `--chip-bg-hi`,不引 Vue2 的 `photos-icon` 组件)。行为复用既有 `attemptClose()`(有选择先出确认条,不直接关),与点遮罩/点取消同一套分层安全语义。
- 首次跑测发现一处测试自身的时序 bug(不是组件 bug):第一轮点 X 确认放弃后,测试直接 `setProps({open:true})`,但 `open` prop 本来就还停在 `true`(组件只 `emit('update:open', false)`,不会自己改自己的 prop),Vue 的 `watch` 对「新值等于旧值」不触发,导致 `selected` 没清空,第二次点 X 又弹了一次确认条而非直接关闭。修正测试:先 `setProps({open:false})` 再 `setProps({open:true})`,模拟宿主真实响应 emit 的行为。修正后:
  ```
  pnpm vitest run src/photos/components/__tests__/AlbumLibraryPicker.test.ts
   Test Files  1 passed (1)
        Tests  12 passed (12)
  ```

### 3(顺带修)`opacity: 0.45` → `0.4`

`.lib-picker-tile-img.is-dimmed` 改为 `opacity: 0.4`,与 Vue2 `photos.scss:4402` 的 `[data-disabled="true"] { opacity: 0.4 }` 保持像素级一致。

### 修复后验证

```
pnpm vitest run src/photos/components/__tests__/AlbumLibraryPicker.test.ts
 Test Files  1 passed (1)
      Tests  12 passed (12)

pnpm test
 Test Files  249 passed (249)
      Tests  1586 passed (1586)   # 基线 1585 + 本轮新增 1 条(头部 X 按钮测试)

pnpm exec vue-tsc --noEmit
(无输出,干净)

pnpm vitest run src/styles/color-guard.test.ts src/i18n/parity.test.ts
 Test Files  2 passed (2)
      Tests  115 passed (115)
```

### 改了哪些文件(第二轮)

- `src/i18n/zh_cn.ts` / `src/i18n/en_us.ts`:各 +1 行(`photosAlbumPickerDiscardConfirm`)
- `src/photos/components/AlbumLibraryPicker.vue`:头部 X 关闭按钮 + 对应样式、确认按钮改用专属键、`opacity` 改 `0.4`
- `src/photos/components/__tests__/AlbumLibraryPicker.test.ts`:新增 X 按钮测试(RED→GREEN)

Commit:`fix(photos): 图库选择器专属确认键 + 补 Vue2 头部关闭按钮`
