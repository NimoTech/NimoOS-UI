# NimoOS-New-UI 可复用思维导图组件 + 音频「思维导图」tab 设计

- 日期：2026-07-13
- 状态：设计已定，待实现
- 范围仓库：`NimoOS-New-UI`（Vue 3 + TS + Vite，挂 `/app/`）
- 影响文件：新增 `src/components/MindMap.vue` + `src/components/mindmap.ts` + `src/components/mindmapLayout.ts`（+测试）；修改 `src/files/viewers/MediaViewer.vue`、`src/files/viewers/audioTranscripts.ts`、`src/i18n/{zh_cn,en_us}.ts`

## 1. 背景与目标

音频预览面板现有三个 tab：摘要 / 转录文稿 / 问 Nimo。新需求（用户定稿）：

1. 加第三个 tab「思维导图」，「问 Nimo」挪到第四；
2. 为 `New recording 21.m4a` 手工提炼一张课程思维导图（demo 数据，同转录）；
3. **组件必须可复用**：思维导图组件与音频完全解耦，以后文档预览、Wiki、AI 输出等场景喂一棵树即可复用；
4. 视觉：经典右向脑图（根在左、分支往右、SVG 曲线连接），手写零依赖，颜色全走主题 token；
5. 交互（用户选定）：点带时间戳的节点跳播 + 分支折叠/展开 + **滚轮缩放 + 拖拽画布** + 复位按钮。悬停 note 提示本期不做。

## 2. 通用数据结构与组件 API（可复用核心）

`src/components/mindmap.ts`（纯类型 + 常量，无依赖）：

```ts
/** 通用思维导图节点——与业务(音频)无关,任何场景喂一棵树即可。 */
export interface MindMapNode {
  /** 节点文字 */
  label: string
  /** 子节点(缺省=叶子) */
  children?: MindMapNode[]
  /** 可选业务时间戳(m:ss)。音频场景点击跳播;其他场景不填 */
  t?: string
  /** 可选补充说明。本期不渲染,为后续悬停提示留位 */
  note?: string
}
```

`src/components/MindMap.vue` 对外契约：

- **Props**：`data: MindMapNode`（仅此一个）。
- **Emits**：`node-click(node: MindMapNode)`——任何节点被点击都会发（含根/分支/叶子），怎么响应由宿主决定。组件内部不认识 `t` 的语义。
- 复用方式：`<MindMap :data="tree" @node-click="onNode" />`，放进任何一个有确定高度的容器即可（组件自身 `width/height: 100%`）。

## 3. 布局与连线实现

- **节点布局交给浏览器**：嵌套 flex——每个节点渲染为一行「胶囊 + 子节点列」，子节点列为 `flex-direction: column`，天然形成右向树。不手算坐标。
- **连线是测量后补画的 SVG 覆盖层**：渲染完成后（`onMounted` + `nextTick` + `ResizeObserver`），对每个胶囊取 `offsetLeft/offsetTop/offsetWidth/offsetHeight`（沿 offsetParent 链累加到画布内容根）。**offset 系值是布局值，不受 CSS transform（缩放/拖拽）影响**，所以缩放状态下测量依然正确。连线画在绝对定位、`pointer-events: none` 的 `<svg>` 上（尺寸=内容 `scrollWidth/Height`），路径为三次贝塞尔：父胶囊右缘中点 → 子胶囊左缘中点，控制点取两点水平中线。
- **重画时机**：挂载后、折叠/展开后、容器尺寸变化（ResizeObserver）。字体晚加载导致的胶囊宽度变化由 ResizeObserver 兜住。**`typeof ResizeObserver === 'undefined'` 时（jsdom 测试环境）静默跳过监听**——连线不画不影响节点渲染与交互，组件测试不崩。卸载时 disconnect。
- **纯函数抽离**（`src/components/mindmapLayout.ts`，vitest 单测）：
  - `nodeId(path: number[]): string` — 树路径 → 稳定 id（`"r"`、`"r.0"`、`"r.0.2"`），折叠集合与 DOM ref 都按它索引；
  - `visibleEdges(root, collapsed: ReadonlySet<string>): Array<[parentId, childId]>` — 折叠状态下应画哪些连线（收起节点的子树整体不可见）；
  - `edgePath(a: {x,y}, b: {x,y}): string` — 两锚点 → SVG `d` 字符串（`M a C …`）；
  - `branchColor(rootChildIdx: number): string` — 一级分支序号 → `var(--spk-N)`（复用既有 `speakerToken` 的 %5 循环规则，直接 `import { speakerToken }`？**不行**——components 层不应依赖 files/viewers；把 5 色循环写成 mindmapLayout 自己的一行实现，返回同样的 `var(--spk-N)` 字符串）。整条分支（连线+子孙节点圆点）继承一级分支的颜色。

## 4. 交互

全部在组件内部实现，宿主无感：

- **折叠/展开**：有子节点的胶囊右缘外侧一个小圆钮（16px，显示 `−`/`+`，底色=分支色的 `color-mix` 淡化），点击 toggle 该节点 id 在 `collapsed: Set<string>` 中的存在；收起后子树 `v-if` 移除、连线随 `visibleEdges` 消失，圆钮显示 `+`（不做子孙计数徽标，YAGNI）。默认全展开。折叠圆钮点击**不**触发 `node-click`（`@click.stop`）。
- **缩放**：画布 `@wheel.prevent`，以鼠标位置为不动点：`scale' = clamp(scale × (deltaY<0 ? 1.1 : 1/1.1), 0.5, 2)`，`translate' = cursor − (cursor − translate) × (scale'/scale)`。变换施加在内容包裹层 `transform: translate(x,y) scale(s)`，`transform-origin: 0 0`。
- **拖拽画布**：画布空白处 `pointerdown` → `setPointerCapture` → move 改 translate → up 释放（与波形拖拽同手法）。胶囊/圆钮上的 pointerdown 不启动拖拽（检查 `e.target`）。拖拽中抑制本次 click（移动超过 4px 视为拖拽，不发 node-click）。
- **复位**：画布右下角悬浮小圆钮（图标：十字准星/1×），点击回 `scale=1, translate=(0,0)`。
- **节点点击**：胶囊 click → `emit('node-click', node)`。光标：带 `t` 或有子节点的胶囊 `cursor: pointer`。

## 5. 样式（全 token，禁字面量）

- 胶囊：`background: var(--card)`、`border: 1px solid var(--border)`、圆角 999px、字号 14px、`color: var(--fg)`；根节点加重（字号 15px、`font-weight: 700`、边框用分支中性 `--accent-soft-bd`、底 `--accent-soft`）。
- 分支色注入：一级分支容器上内联 `--mm-c: var(--spk-N)`，子孙经 CSS 变量继承——连线 `stroke: var(--mm-c)`（透明度用 `color-mix(in oklab, var(--mm-c) 55%, transparent)`）、胶囊左侧 6px 圆点 `background: var(--mm-c)`、折叠圆钮同色系。带 `t` 的节点在 label 后附小号时间戳文字（`color: var(--accent-text)`，同转录时间列）。
- 悬停：胶囊 `background: var(--hover)`、边框提亮为 `--mm-c`。
- 画布：占满面板，`overflow: hidden`（内容靠缩放/拖拽移动），背景透明沿用面板底。复位钮样式同 `.ap-tool` 圆形化。
- 连线宽 1.5px，`fill: none`，圆头。
- **零新增颜色 token**：分支色复用 `--spk-1..5`（语义=区分并列项，两套主题都有值）；其余全是既有 token。`color-mix(… var(--mm-c) …)` 属 token 派生，color-guard 可过。

## 6. 音频侧接入（MediaViewer）

- tab 类型改为 `'summary' | 'transcript' | 'mindmap' | 'ask'`，按钮顺序：摘要 / 转录文稿 / 思维导图 / 问 Nimo。**`transcript.mindmap` 存在才渲染「思维导图」tab 按钮**——无导图数据的音频界面与现状完全一致。
- i18n 新键 `audioMindmap`：zh「思维导图」/ en "Mind Map"（parity 测试强制两份）。
- tab 内容：`<div v-else-if="tab === 'mindmap'" class="ap-mindmap"><MindMap :data="transcript.mindmap" @node-click="onMindNode" /></div>`，`.ap-mindmap` 撑满剩余高度（`flex: 1 1 auto; min-height: 0`）。
- 联动：`function onMindNode(n: MindMapNode): void { if (n.t) seekTo(n.t) }`（复用现有 `seekTo`）。
- 数据：`AudioTranscript` 接口加 `mindmap?: MindMapNode`。

## 7. 演示数据（内容定稿，英文与既有 summary/keywords 数据语言一致）

`audioTranscripts.ts` 中 `new recording 21.m4a` 增加 `mindmap`，树如下（6 大分支 28 节点，时间戳对齐既有分段）：

```
Digital Audio 101 (根,无 t)
├─ Timbre & Harmonics (0:00)
│  ├─ Formants: mouth & throat shape timbre (0:00)
│  ├─ Harmonic vs non-harmonic sounds (0:23)
│  └─ Inharmonic: bells & gongs (1:09)
├─ Phase (1:35)
│  ├─ Phase sums & cancels (2:00)
│  ├─ Multi-mic phase problems (3:45)
│  └─ Flanging & chorus effects (4:08)
├─ Recording History (4:13)
│  ├─ Wax cylinders (4:38)
│  ├─ Magnetic tape era (6:37)
│  └─ Why digital won: edit & copy (12:18)
├─ Sound in Computers (13:56)
│  ├─ Sampling the waveform (15:12)
│  ├─ Nyquist theorem (17:15)
│  ├─ Why 44.1 kHz (17:51)
│  ├─ 48 kHz & film frame rates (18:53)
│  └─ Aliasing artifacts (20:40)
├─ Bit Depth (23:37)
│  ├─ 16 / 24 / 32-bit dynamic range (24:33)
│  └─ Quantization noise (26:55)
└─ File Formats (27:40)
   ├─ Uncompressed: WAV & AIFF (27:57)
   ├─ Lossless: FLAC (30:14)
   ├─ Lossy: MP3 / M4A / OGG (32:31)
   └─ Mahler listening demo (34:29)
```

## 8. 模块与测试

- `src/components/mindmap.ts`：类型（无运行时代码，无需测试）。
- `src/components/mindmapLayout.ts` + `mindmapLayout.test.ts`（vitest）：
  - `nodeId`：`[]→"r"`、`[0,2]→"r.0.2"`；
  - `visibleEdges`：全展开=每条父子边；收起 `"r.1"` → `r.1` 的子孙边全消失但 `r→r.1` 这条仍在；收起根 → 只剩根（无边）；
  - `edgePath`：输出以 `M` 开头含 `C` 的字符串，端点数值正确；
  - `branchColor`：`0→var(--spk-1)`、`5→var(--spk-1)`（%5 循环）。
- `MindMap.vue` 组件测试（`@vue/test-utils`，jsdom）：渲染节点数正确；点胶囊 emit `node-click` 且携带原节点对象；点折叠钮后子树消失且**不** emit node-click。（缩放/拖拽属 DOM 几何交互，jsdom 覆盖性价比低，真机验收。）
- i18n parity、color-guard 既有测试自动覆盖。
- `pnpm exec vue-tsc --noEmit` + 全量 `pnpm test` 须绿。

## 9. 验收（真机 `/app/`，New recording 21.m4a）

1. tab 顺序：摘要 / 转录文稿 / 思维导图 / 问 Nimo；无导图数据的音频（如临时改名测试）不出现该 tab。
2. 导图：根在左、6 条分支各一色、SVG 曲线连接、带时间戳的节点显示小时间标。
3. 点「Nyquist theorem (17:15)」→ 音频跳到 17:15 播放。
4. 折叠「File Formats」→ 该子树与连线消失、钮变 +；再点恢复。
5. 滚轮缩放以鼠标为中心、0.5×–2× 有界；按住空白拖动整图；点复位钮回原位。
6. dark/light 两主题下配色都成立；Console 无报错。

## 10. 取舍与说明

- **不用第三方库**（markmap 等）：主题 token 融不进、加依赖，与仓库"无 UI 框架、样式手写"路线冲突。
- 悬停 note 本期不做，`note` 字段留在类型中为后续扩展。
- 连线采用"DOM 测量后补画"而非纯 JS 布局：文字宽度只有浏览器知道，手算脆弱；offset 系测量不受 transform 影响，是零依赖方案里最稳的。
- 分支色复用 `--spk-1..5` 是有意为之（语义=并列项区分色），不为导图新造一组 token；若未来两处撞色观感不适，再拆新 token 也只改 theme.css。
- 组件放 `src/components/`（与 AppToast 同级）,类型独立成文件,保证 files/viewers 之外的场景 import 不带业务包袱。
