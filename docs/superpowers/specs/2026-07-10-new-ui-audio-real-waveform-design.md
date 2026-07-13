# NimoOS-New-UI 音频真实波形（合成占位 + 后台解码替换）设计

- 日期：2026-07-10
- 状态：已实现（2026-07-13，commit 见 git log）
- 范围仓库：`NimoOS-New-UI`（Vue 3 + TS + Vite，挂 `/app/`）
- 影响文件：`src/files/viewers/MediaViewer.vue`（音频分支）、新增 `src/files/viewers/waveform.ts` + `waveform.test.ts`

## 1. 背景与目标

`MediaViewer.vue` 的音频播放器已把进度条做成「录音 app 声波」观感：居中圆角竖条 + 静音处虚线基线，已播部分染强调色，可点击/拖拽 seek（见 `.np-wave` 相关实现）。

但当前波形是**合成的**：用文件名做种子确定性生成一串「像语音」的竖条（`synthWaveform`），**与音频实际的响度/静音位置对不上**——只是视觉上像，内容上是虚构的。这与本播放器其余写死的 demo 数据（转录、摘要、Ask Nimo）一致。

目标：让竖条高度**真实对应音频波形**，同时不牺牲打开速度、不拖垮低配设备。

核心策略：**合成占位 + 后台解码替换 + 大小上限**。打开即见（合成，0 延迟），后台解码真实音频，算好后无缝替换成真波形；失败/超限一律静默保持合成，功能永不退化。

## 2. 关键决策（已确认）

- **缓存**：内存缓存，作用域=本次会话（`Map`，页面刷新即清）。不做 IndexedDB 持久化（YAGNI）。
- **大小上限**：`> 50 MB` 的音频不解码真波形，永久用合成波形。理由：约 40 分钟 128k MP3 以内都能解，那个 ~40MB 讲座能覆盖，同时挡住大文件的卡顿/内存风险。
- **峰值指标**：绝对值最大（peak），非 RMS——要录音 app 那种带尖峰的观感。
- **不改渲染结构**：复用现有 `.np-wave` / `.np-wave-bar` / `.np-wave-base` 与已播染色、seek 逻辑；仅换数据源 + 加一次切换过渡。
- **无新增 i18n**：波形无文案。

## 3. 数据流（每次打开音频）

```
挂载音频
  │
  ├─ ① 立即渲染合成波形 synthWaveform(name, 96)      → 状态 synth（0 延迟）
  │
  ├─ ② 查内存缓存 key = `${path}|${size}|${mtime}`
  │       命中 → 用缓存峰值                           → 状态 real，结束
  │
  └─ ③ 未命中 → 后台异步 decodeWaveform():
          fetch(fileUrl, { signal })
          读 Content-Length
            > 50MB  → abort，保持合成，标记 final（不再重试）→ 状态 synth（终态）
            无该头  → 边读边计字节，超 50MB 即 abort → 同上
          arrayBuffer() → AudioContext.decodeAudioData()
          取第 1 声道 → bucketPeaks(samples, 96) → 归一化 [0,1]
          写缓存 + 替换 waveBars                      → 状态 real（带切换过渡）
          任一步抛错/离线/解码失败 → 静默保持合成      → 状态 synth（终态）
```

- **中止**：组件卸载或切换文件（`props.item` 变化）→ `AbortController.abort()` + 复用现有 `disposed` 标志 + `AudioContext.close()`。在途结果到达时若已 `disposed` 或已换文件，丢弃。
- **状态机**：`waveState: 'synth' | 'real'`。仅用于内部判断是否已替换/是否加过渡；模板不需要区分展示。

## 4. 模块划分（`src/files/viewers/waveform.ts`）

抽出独立文件，纯函数与浏览器编排分离，便于单测与隔离：

```ts
// 竖条数（与现有渲染一致）
export const WAVE_N = 96

// —— 纯函数（可单测，无浏览器依赖）——
// 合成波形：文件名做种子，确定性生成「像语音」的包络（说话簇 + 静音间隙）。
export function synthWaveform(seed: string, n: number): number[]
// 分桶取峰：把解码后的单声道样本压成 n 条，每桶取 |max|，按全局最大归一化到 [0,1]，真静音置 0。
export function bucketPeaks(samples: Float32Array, n: number): number[]

// —— 浏览器编排（薄封装，不单测，手动验收）——
// 解码真实波形；返回 number[]（长度 n，值域 [0,1]）或 null（超限/失败/被中止）。
export function decodeWaveform(
  url: string,
  n: number,
  opts: { maxBytes: number; signal: AbortSignal },
): Promise<number[] | null>
```

- `synthWaveform` / `hashStr` / `mulberry32` 从 `MediaViewer.vue` 迁到此文件（现有逻辑原样搬，不改行为）。
- `MediaViewer.vue` 消费这三者；`waveBars` 由 `computed` 改为 `ref<number[]>`（先合成、后替换）；`playedBars` 仍按 `progressPct × WAVE_N` 计算。

### `bucketPeaks` 细节
- 输入单声道 `Float32Array`（样本值域 [-1, 1]）。
- 桶宽 `Math.floor(len / n)`；每桶扫描取 `Math.max(|x|)`。
- 全局归一化：除以所有桶峰值的最大值（避免整体偏低时波形太扁）；最大值为 0 时返回全 0。
- 真静音（桶峰值 0）保持 0，让虚线基线透出。

### `decodeWaveform` 细节
- `fetch(url, { signal })`；先看 `response.headers.get('content-length')`，`> maxBytes` 直接 `return null`。
- 无 Content-Length 时，用 `response.body` 的 reader 累加字节，超 `maxBytes` 即 `controller.abort()` 并 `return null`（避免无头大文件读爆）。
- `decodeAudioData` 后**只取 `getChannelData(0)`**（省内存），交给 `bucketPeaks`；随后不再持有 `AudioBuffer`，让其被回收。
- `AudioContext` 用完 `close()`。
- 任一异常（含 `AbortError`）→ `return null`（调用方据此保持合成）。

## 5. 渲染与交互（复用现有，不改结构）

- 竖条/虚线基线/已播染色/点击拖拽 seek 全部沿用现有实现。
- **切换过渡**：给 `.np-wave-bar` 加 `transition: height .3s var(--ease)`。高度只在「合成→真波形」换源时整体变化，seek 不改高度、不触发过渡；因此得到一次平滑「变形」而不会在播放中抖动。
- 颜色仍全部走 theme token（`--accent` / `--accent2` / `--fg-subtle` / `--fg-faint`），遵守本仓库配色硬约束，无新增字面量。

## 6. 缓存

- 模块级 `Map<string, number[]>`，键 `${path}|${size}|${mtime}`（`size`/`mtime` 取自 `FileEntry`；缺字段则回退键 `${path}`）。
- 命中即同步返回真波形，跳过网络与解码。
- 不设淘汰上限：单条仅 96 个 number，量级极小；会话级生命周期，刷新即清。

## 7. 测试

- `waveform.test.ts`（vitest）：
  - `synthWaveform`：同 seed 输出稳定、长度 = n、值域 [0,1]、不同 seed 不同。
  - `bucketPeaks`：输出长度 = n；已知样本的归一化正确（构造一个含明显峰与静音段的 `Float32Array`，断言峰桶=1、静音桶=0）；全零输入 → 全零输出；`len < n` 的边界不崩。
- `decodeWaveform`（依赖 `fetch`/`AudioContext`）：不做单测，走真机手动验收。
- i18n parity：无新增键，`parity.test.ts` 不受影响。
- 类型检查 `pnpm exec vue-tsc --noEmit` 必须通过。

## 8. 验收（真机 `/app/`）

1. 小歌曲（几 MB）：打开近乎立即出**真波形**，形状随音频内容变化；换不同歌曲波形不同且对得上响度。
2. ~40MB 讲座：打开先见合成波形，几秒后**无缝替换**为真波形（能观察到一次平滑变形）。
3. 重开同一文件：秒出真波形（命中内存缓存）。
4. 构造/挑一个 >50MB 文件：始终保持合成波形，不卡、不报错。
5. 播放中 seek、快进/快退、变速：均正常，波形已播染色随进度更新。
6. 打开后立刻关闭/切下一个文件：无控制台报错（在途解码被中止）。

## 9. 已知取舍与风险

- **解码内存瞬时峰值**：50MB 立体声 128k 文件解成 PCM 可达 ~1GB（`decodeAudioData` 按原生采样率解全部声道，取单声道只影响后续读取、不影响解码本身的分配）。缓解：用完立即释放 buffer、`AudioContext.close()`。**若真机低配设备（如树莓派）实测吃紧，再补一道时长上限闸**（已有 `durTime`，可在解码前 `duration > N 分钟` 直接回退合成）——本期先不加，避免过度设计。
- **波形精度**：96 桶对长音频是高度压缩的概览，只表达大致响度轮廓，不表达细节；符合进度条定位。
- **首次仍要下整文件**：≤50MB 时最长下载+解码约数秒；因合成占位先行，用户感知打开时间为 0。
- **后端预生成峰值**是更优解（秒开、不下整文件），但需改后端，超出本期范围，留作后续。
