# 音频真实波形(合成占位 + 后台解码替换)Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让音频播放器进度条的竖条高度真实对应音频波形——打开即见合成占位波形,后台解码真实音频后无缝替换;失败/超 50MB 静默保持合成。

**Architecture:** 从 `MediaViewer.vue` 抽出 `src/files/viewers/waveform.ts` 模块:纯函数(`synthWaveform` 迁移 + 新增 `bucketPeaks` 分桶取峰)与浏览器编排(`decodeWaveform`:fetch → `AudioContext.decodeAudioData` → 取第 1 声道)分离。`MediaViewer.vue` 的 `waveBars` 由 `computed` 改为 `ref`(先合成、后替换),配会话级内存缓存与 `AbortController` 中止。

**Tech Stack:** Vue 3 `<script setup>` + TS(strict)· vitest · Web Audio API(`AudioContext.decodeAudioData`)· fetch streams。

**Spec:** `docs/superpowers/specs/2026-07-10-new-ui-audio-real-waveform-design.md`(决策已确认,本计划不再重议)。

## Global Constraints

- 大小上限:`> 50 MB`(`50 * 1024 * 1024` 字节)的音频不解码,永久用合成波形;任何失败(含 AbortError)静默回退合成,**功能永不退化**。
- 峰值指标:每桶取 `|max|`(peak),非 RMS;全局归一化到 [0,1];真静音桶置 0(让虚线基线透出)。
- 不改渲染结构:复用现有 `.np-wave` / `.np-wave-bar` / `.np-wave-base`、已播染色、seek 逻辑;仅换数据源 + 加一次高度过渡。
- 无新增 i18n 键(波形无文案),`parity.test.ts` 不受影响。
- **配色硬约束(仓库级)**:一切颜色必须走 theme token(`var(--…)`),禁止颜色字面量;本计划只新增 `transition`,不新增颜色。
- 缓存:模块级 `Map`,键 `${path}|${size}|${date}`(`FileEntry` 无 `mtime` 字段,用 `date` 代替 spec 里的 mtime;`size`/`date` 缺失时该位留空串)。会话级,不做持久化,不设淘汰上限。
- 类型检查 `pnpm exec vue-tsc --noEmit` 必须通过;全量 `pnpm test` 必须绿。
- 包管理器 pnpm(勿用 yarn/npm);提交信息沿用仓库 conventional-commits 风格,结尾带 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`。

## File Structure

- **Create** `src/files/viewers/waveform.ts` — 波形模块:常量 `WAVE_N`、纯函数 `synthWaveform`/`bucketPeaks`、缓存 `waveCacheKey`/`getCachedWave`/`setCachedWave`、浏览器编排 `decodeWaveform`。
- **Create** `src/files/viewers/waveform.test.ts` — 纯函数与缓存键的单测(`decodeWaveform` 依赖 fetch/AudioContext,不单测,真机验收)。
- **Modify** `src/files/viewers/MediaViewer.vue` — 删除内联的 `WAVE_N`/`hashStr`/`mulberry32`/`waveBars` computed(当前第 48-88 行),改从模块导入;`waveBars` 改 `ref`;`onMounted` 音频分支启动后台解码;`onBeforeUnmount` 中止;`.np-wave-bar` 加高度过渡。

---

### Task 1: `waveform.ts` 纯函数 — `synthWaveform` 迁移 + `bucketPeaks` + 缓存键

**Files:**
- Create: `src/files/viewers/waveform.ts`
- Test: `src/files/viewers/waveform.test.ts`

**Interfaces:**
- Consumes: 无(`hashStr`/`mulberry32`/合成逻辑从 `MediaViewer.vue:51-88` 原样搬入,不改行为;本 task 只新建文件,**不动 MediaViewer**)。
- Produces(Task 2/3 依赖,签名必须一字不差):
  - `export const WAVE_N = 96`
  - `export function synthWaveform(seed: string, n: number): number[]`
  - `export function bucketPeaks(samples: Float32Array, n: number): number[]`
  - `export function waveCacheKey(e: { path: string; size?: number | string; date?: string }): string`
  - `export function getCachedWave(key: string): number[] | undefined`
  - `export function setCachedWave(key: string, bars: number[]): void`

- [ ] **Step 1: 写失败测试**

创建 `src/files/viewers/waveform.test.ts`(测试风格对齐邻居 `mediaKind.test.ts`:中文 it 描述):

```ts
import { describe, it, expect } from 'vitest'
import { WAVE_N, synthWaveform, bucketPeaks, waveCacheKey, getCachedWave, setCachedWave } from './waveform'

describe('synthWaveform', () => {
  it('同 seed 输出稳定、长度 = n、值域 [0,1]', () => {
    const a = synthWaveform('demo.mp3', WAVE_N)
    const b = synthWaveform('demo.mp3', WAVE_N)
    expect(a).toEqual(b)
    expect(a).toHaveLength(WAVE_N)
    for (const v of a) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
  })
  it('不同 seed 输出不同', () => {
    expect(synthWaveform('a.mp3', WAVE_N)).not.toEqual(synthWaveform('b.mp3', WAVE_N))
  })
})

describe('bucketPeaks', () => {
  it('输出长度 = n;峰桶归一化为 1、静音桶为 0、半峰桶为 0.5', () => {
    // 4 桶 × 每桶 100 样本:桶0 峰 0.4、桶1 全 0、桶2 峰 0.8(全局最大)、桶3 峰 -0.8(取绝对值)
    const s = new Float32Array(400)
    s[10] = 0.4
    s[250] = 0.8
    s[350] = -0.8
    const out = bucketPeaks(s, 4)
    expect(out).toHaveLength(4)
    expect(out[0]).toBeCloseTo(0.5)
    expect(out[1]).toBe(0)
    expect(out[2]).toBeCloseTo(1)
    expect(out[3]).toBeCloseTo(1)
  })
  it('全零输入 → 全零输出(不除以 0)', () => {
    expect(bucketPeaks(new Float32Array(100), 4)).toEqual([0, 0, 0, 0])
  })
  it('len < n 的边界不崩,输出仍是 n 条 [0,1]', () => {
    const out = bucketPeaks(new Float32Array([0.5, -1, 0.25]), 8)
    expect(out).toHaveLength(8)
    for (const v of out) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
    expect(Math.max(...out)).toBe(1)
  })
  it('空输入 → 全零输出', () => {
    expect(bucketPeaks(new Float32Array(0), 4)).toEqual([0, 0, 0, 0])
  })
})

describe('wave cache', () => {
  it('waveCacheKey 用 path|size|date;size/date 缺失时该位留空', () => {
    expect(waveCacheKey({ path: '/DATA/a.mp3', size: 123, date: '2026-07-01' })).toBe('/DATA/a.mp3|123|2026-07-01')
    expect(waveCacheKey({ path: '/DATA/a.mp3' })).toBe('/DATA/a.mp3||')
  })
  it('set 后 get 命中;未 set 的键 → undefined', () => {
    expect(getCachedWave('nope')).toBeUndefined()
    setCachedWave('k1', [0, 0.5, 1])
    expect(getCachedWave('k1')).toEqual([0, 0.5, 1])
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run src/files/viewers/waveform.test.ts`
Expected: FAIL — `Cannot find module './waveform'`(或等价的解析错误)。

- [ ] **Step 3: 写最小实现**

创建 `src/files/viewers/waveform.ts`:

```ts
// 音频波形模块:合成占位(纯函数) + 真实解码(浏览器编排) + 会话级缓存。
// 设计:docs/superpowers/specs/2026-07-10-new-ui-audio-real-waveform-design.md
// 策略:打开即渲染合成波形(0 延迟),后台解码真实音频后无缝替换;
//       超 50MB / 任一失败 → 静默保持合成,功能永不退化。

/** 进度条竖条数(与 MediaViewer 渲染一致) */
export const WAVE_N = 96

// —— 以下两个 PRNG 辅助从 MediaViewer.vue 原样迁入,不改行为 ——
function hashStr(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
function mulberry32(a: number): () => number {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * 合成波形:seed(文件名)确定性生成「像语音」的包络——
 * 交替「说话簇」(正弦升降包络 + 抖动)与「静音间隙」(幅值 0 → 只留虚线基线)。
 */
export function synthWaveform(seed: string, n: number): number[] {
  const rnd = mulberry32(hashStr(seed || 'audio'))
  const amps: number[] = []
  while (amps.length < n) {
    if (rnd() < 0.22) {
      const gap = 2 + Math.floor(rnd() * 4)
      for (let k = 0; k < gap && amps.length < n; k++) amps.push(0)
    } else {
      const len = 5 + Math.floor(rnd() * 16)
      const peak = 0.35 + rnd() * 0.65
      for (let k = 0; k < len && amps.length < n; k++) {
        const env = Math.sin((k / Math.max(1, len - 1)) * Math.PI)
        const jitter = 0.7 + rnd() * 0.5
        amps.push(Math.min(1, Math.max(0.08, env * peak * jitter)))
      }
    }
  }
  return amps
}

/**
 * 分桶取峰:把解码后的单声道样本压成 n 条。
 * 每桶取 |max|(peak,非 RMS),按全局最大归一化到 [0,1];真静音桶保持 0。
 * 桶边界按比例索引(而非固定桶宽),len < n 时相邻桶共享样本,天然不崩。
 */
export function bucketPeaks(samples: Float32Array, n: number): number[] {
  const out = new Array<number>(n).fill(0)
  const len = samples.length
  if (!len || n <= 0) return out
  for (let i = 0; i < n; i++) {
    const start = Math.floor((i * len) / n)
    const end = Math.max(start + 1, Math.floor(((i + 1) * len) / n))
    let peak = 0
    for (let j = start; j < end && j < len; j++) {
      const v = Math.abs(samples[j])
      if (v > peak) peak = v
    }
    out[i] = peak
  }
  const max = Math.max(...out)
  return max === 0 ? out : out.map((v) => v / max)
}

// —— 会话级内存缓存:单条仅 96 个 number,不设淘汰;刷新即清 ——
const cache = new Map<string, number[]>()

/** 缓存键 = path|size|date(FileEntry 无 mtime,用 date;缺失位留空串)。 */
export function waveCacheKey(e: { path: string; size?: number | string; date?: string }): string {
  return `${e.path}|${e.size ?? ''}|${e.date ?? ''}`
}
export function getCachedWave(key: string): number[] | undefined {
  return cache.get(key)
}
export function setCachedWave(key: string, bars: number[]): void {
  cache.set(key, bars)
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run src/files/viewers/waveform.test.ts`
Expected: PASS(7 个用例全绿)。

- [ ] **Step 5: Commit**

```bash
git add src/files/viewers/waveform.ts src/files/viewers/waveform.test.ts
git commit -m "feat(files): waveform module — synth placeholder + bucketPeaks + session cache

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: `decodeWaveform` 浏览器编排(fetch + 大小闸 + decodeAudioData)

**Files:**
- Modify: `src/files/viewers/waveform.ts`(文件末尾追加)

**Interfaces:**
- Consumes: Task 1 的 `bucketPeaks(samples: Float32Array, n: number): number[]`。
- Produces(Task 3 依赖):
  - `export function decodeWaveform(url: string, n: number, opts: { maxBytes: number; signal: AbortSignal }): Promise<number[] | null>`
  - 返回长度 n、值域 [0,1] 的数组;超限/失败/被中止一律 `null`(调用方据此保持合成)。

**测试策略(spec §7 已定):** `decodeWaveform` 依赖 `fetch`/`AudioContext`(jsdom 均无),不做单测,走真机手动验收(Task 4)。本 task 的验证 = 类型检查 + 既有测试不回归。

- [ ] **Step 1: 追加实现**

在 `src/files/viewers/waveform.ts` 末尾追加:

```ts
/**
 * 解码真实波形:fetch 整个文件 → AudioContext.decodeAudioData → 取第 1 声道 → bucketPeaks。
 * 大小闸:Content-Length > maxBytes 直接放弃;无该头则边读边计字节,超限即中止——
 * 避免无头大文件读爆内存。任一异常(含 AbortError)→ null,调用方静默保持合成波形。
 */
export async function decodeWaveform(
  url: string,
  n: number,
  opts: { maxBytes: number; signal: AbortSignal },
): Promise<number[] | null> {
  try {
    const res = await fetch(url, { signal: opts.signal })
    if (!res.ok || !res.body) return null
    const lenHeader = res.headers.get('content-length')
    if (lenHeader && Number(lenHeader) > opts.maxBytes) return null

    const reader = res.body.getReader()
    const chunks: Uint8Array[] = []
    let total = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > opts.maxBytes) {
        void reader.cancel()
        return null
      }
      chunks.push(value)
    }
    // 用显式 ArrayBuffer 承接,避免 Uint8Array#buffer 的 ArrayBufferLike 类型歧义。
    const ab = new ArrayBuffer(total)
    const buf = new Uint8Array(ab)
    let off = 0
    for (const c of chunks) {
      buf.set(c, off)
      off += c.byteLength
    }

    const ctx = new AudioContext()
    try {
      const audio = await ctx.decodeAudioData(ab)
      // 只取第 1 声道(省内存);bucketPeaks 返回后不再持有 AudioBuffer,任其回收。
      return bucketPeaks(audio.getChannelData(0), n)
    } finally {
      void ctx.close()
    }
  } catch {
    return null
  }
}
```

- [ ] **Step 2: 类型检查 + 全量测试不回归**

Run: `pnpm exec vue-tsc --noEmit && pnpm exec vitest run src/files/viewers`
Expected: vue-tsc 无输出(通过);viewers 目录测试全绿(含 Task 1 的 waveform.test.ts)。

- [ ] **Step 3: Commit**

```bash
git add src/files/viewers/waveform.ts
git commit -m "feat(files): decodeWaveform — fetch with 50MB gate + decodeAudioData peaks

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: MediaViewer 接入 — waveBars 改 ref、后台解码替换、高度过渡

**Files:**
- Modify: `src/files/viewers/MediaViewer.vue`

**Interfaces:**
- Consumes(Task 1/2 产物): `WAVE_N`、`synthWaveform`、`decodeWaveform`、`waveCacheKey`、`getCachedWave`、`setCachedWave`(均自 `./waveform`)。
- Produces: 无(终端消费者)。模板对 `waveBars`/`playedBars` 的既有绑定不变。

**上下文(现状,行号基于 commit 06313c8):** 内联波形代码在 48-88 行(注释 + `WAVE_N` + `hashStr` + `mulberry32` + `waveBars` computed);`playedBars` 在 90 行;`url` 在 21 行(`service.file.fileUrl(props.item.path)`,组件内不变——每个文件一个 MediaViewer 实例,无换源);`disposed` 标志在 32 行;`onMounted` 音频分支在 341-365 行;`onBeforeUnmount` 在 367-372 行;`.np-wave-bar` 样式在 604 行。

- [ ] **Step 1: 替换内联合成波形为模块导入 + ref**

在 imports 区(第 7 行 `audioTranscripts` import 附近)加:

```ts
import { WAVE_N, synthWaveform, decodeWaveform, waveCacheKey, getCachedWave, setCachedWave } from './waveform'
```

删除第 48-88 行的整块内联实现(`// ── 声波进度条…` 注释、`const WAVE_N = 96`、`hashStr`、`mulberry32`、`waveBars` computed),原位替换为:

```ts
// ── 声波进度条(仿录音 app)──────────────────────────────────────────
//   进度条画成语音波形:居中的圆角竖条 + 静音处的虚线基线。已播部分染强调色。
//   数据源两级:先按文件名合成占位(0 延迟),后台解码真实音频后无缝替换;
//   超 50MB / 解码失败 / 命中不了都静默停留在合成,详见 ./waveform 与设计 spec。
const MAX_DECODE_BYTES = 50 * 1024 * 1024
const waveBars = ref<number[]>(synthWaveform(props.item.name || 'audio', WAVE_N))
let waveAbort: AbortController | null = null

function startWaveDecode(): void {
  const key = waveCacheKey(props.item)
  const hit = getCachedWave(key)
  if (hit) {
    waveBars.value = hit
    return
  }
  waveAbort = new AbortController()
  void decodeWaveform(url, WAVE_N, { maxBytes: MAX_DECODE_BYTES, signal: waveAbort.signal }).then((bars) => {
    // 在途结果到达时组件可能已卸载(disposed)——丢弃,不写缓存也不触发渲染。
    if (!bars || disposed) return
    setCachedWave(key, bars)
    waveBars.value = bars
  })
}
```

保留紧随其后的 `playedBars`(90 行)原样不动。

- [ ] **Step 2: onMounted 音频分支启动解码、onBeforeUnmount 中止**

`onMounted` 的 `else if (kind === 'audio') {` 分支开头(343 行 `void audioMedia.value?.play?.()` 之前)加一行:

```ts
    startWaveDecode()
```

`onBeforeUnmount`(367-372 行)在 `disposed = true` 之后加一行:

```ts
  waveAbort?.abort()
```

- [ ] **Step 3: 竖条加高度过渡(仅换源时触发)**

604 行 `.np-wave-bar` 的 `transition: background 0.12s;` 改为:

```css
transition: background 0.12s, height 0.3s var(--ease);
```

(seek 只改染色不改高度,不会触发该过渡;高度仅在「合成 → 真波形」整体换源时变化,得到一次平滑变形。)

- [ ] **Step 4: 类型检查 + 全量测试**

Run: `pnpm exec vue-tsc --noEmit && pnpm test`
Expected: vue-tsc 通过;全量 vitest 绿(此前 626 个用例 + waveform 新增,0 失败)。

- [ ] **Step 5: Commit**

```bash
git add src/files/viewers/MediaViewer.vue
git commit -m "feat(files): audio wave bars use real decoded peaks with synth fallback

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: 部署 + 真机验收(spec §8)

**Files:** 无代码改动(部署与手动验证)。

**Interfaces:**
- Consumes: Task 1-3 全部产物(完整功能链)。
- Produces: 部署到 `/var/lib/nimoos/www/app/` 的产物 + 验收结论。

- [ ] **Step 1: 构建产物确认包含新模块**

Run: `./scripts/deploy.sh`
Expected: `pnpm build`(vue-tsc + vite)成功,rsync 到 `/var/lib/nimoos/www/app/`。随后确认产物含解码逻辑:

Run: `grep -rl "decodeAudioData" /var/lib/nimoos/www/app/assets/ | head -3`
Expected: 至少命中一个 MediaViewer/waveform chunk。

- [ ] **Step 2: 真机验收清单(浏览器打开 `http://<device>/app/#/files`)**

逐项核对(spec §8 原文):

1. 小音频(几 MB,如 `/DATA/Media/audio/` 下的样例):打开近乎立即出**真波形**,形状随内容变化;换不同文件波形不同且与响度对得上(静音段基线透出)。
2. ~40MB 讲座(`New recording 21.m4a`):打开先见合成波形,几秒后**无缝替换**为真波形(可观察到一次平滑变形)。
3. 重开同一文件:秒出真波形(命中内存缓存,无网络请求——DevTools Network 可证)。
4. >50MB 文件(可用 `dd`/大 FLAC 构造放入 `/DATA/Media/audio/`):始终保持合成波形,不卡、不报错。
5. 播放中 seek(点击/拖拽波形)、±5s/±30s 快进退、倍速:均正常,已播染色随进度更新。
6. 打开后立刻关闭/切下一个文件:DevTools Console 无报错(在途解码被中止)。

- [ ] **Step 3: 更新 spec 状态行**

`docs/superpowers/specs/2026-07-10-new-ui-audio-real-waveform-design.md` 第 4 行 `- 状态:设计已定,待实现` 改为 `- 状态:已实现(2026-07-13,commit 见 git log)`。

```bash
git add docs/superpowers/specs/2026-07-10-new-ui-audio-real-waveform-design.md
git commit -m "docs: mark audio real-waveform spec as implemented

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Self-Review 记录

- **Spec 覆盖**:§3 数据流(合成→缓存→解码→替换/终态)= Task 1+2+3;§4 模块划分与签名 = Task 1+2(签名逐字一致);§5 渲染过渡 = Task 3 Step 3;§6 缓存 = Task 1(mtime→date 的偏差已在 Global Constraints 声明);§7 测试 = Task 1 Step 1 + decodeWaveform 不单测;§8 验收 = Task 4。§9 是风险声明,无实现项。
- **偏差声明**:(1) spec 写 `${path}|${size}|${mtime}`,仓库 `FileEntry` 无 `mtime` 只有 `date?: string`,用 date 顶位,语义等价(内容变则 date 变);(2) spec 写「桶宽 `Math.floor(len/n)`」,实现用按比例索引的桶边界——覆盖 spec 自己要求的 `len < n` 不崩边界,行为在 len ≥ n 时一致;(3) spec 的 `waveState: 'synth' | 'real'` 状态机字段省略——`waveBars` ref 是否被替换本身就是状态,无任何消费方需要读它(YAGNI)。
- **占位符扫描**:无 TBD/TODO/「适当处理」;所有代码步骤均含完整代码。
- **类型一致性**:`synthWaveform(seed, n)`/`bucketPeaks(samples, n)`/`decodeWaveform(url, n, opts)`/`waveCacheKey(e)` 在 Task 1/2/3 中签名与调用一致;`waveBars: ref<number[]>` 与模板 `v-for="(a, i) in waveBars"` 兼容。
