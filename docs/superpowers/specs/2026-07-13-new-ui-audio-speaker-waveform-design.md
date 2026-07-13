# NimoOS-New-UI 音频说话人:过滤 + 波形分段着色 + 高光去色 设计

- 日期：2026-07-13
- 状态：设计已定，待实现
- 范围仓库：`NimoOS-New-UI`（Vue 3 + TS + Vite，挂 `/app/`）
- 影响文件：`src/files/viewers/MediaViewer.vue`、`src/styles/theme.css`、`src/i18n/{zh_cn,en_us}.ts`、新增 `src/files/viewers/speakerWave.ts` + 测试
- 视觉来源：用户在 Claude Design 完成的设计稿 `design-export/design-final.html`（从 `Audio Speaker Segmentation.html` 解包）——本 spec 的 CSS 值以该文件为准

## 1. 背景与目标

音频预览的转录面板已有说话人分离（`segment.speaker` → 名字+彩色圆点）和重点高光（金色底+金星）。波形进度条（96 竖条）已接真实解码峰值，但只表达「已播/未播」。

新需求（全部来自用户，视觉方案用户已在设计稿中定稿）：

1. **说话人过滤**：chips 多选，过滤转录列表；
2. **波形按说话人分段着色**：每根竖条按该时段说话人取色，且与播放进度同时可读；
3. **转录说话人着色**与波形用同一套颜色（token 化，替换现有写死 hex）；
4. **星标重点去色**：重点句不再用金色底区分，星标图标保留（金色不变）；
5. **交互保证**：筛选状态下点击某段（seek）后，再点「全部」/增删说话人，该段仍保持播放高亮、进度条停在原点。

## 2. 主题 token（`theme.css`，两套主题都给值）

新增 8 个颜色 token（值抄设计稿）：

```css
/* :root（dark，亮版） */
--spk-1: oklch(0.74 0.13 250);   /* 蓝 */
--spk-2: oklch(0.72 0.13 305);   /* 紫 */
--spk-3: oklch(0.77 0.12 190);   /* 青 */
--spk-4: oklch(0.73 0.15 18);    /* 珊瑚 */
--spk-5: oklch(0.79 0.14 150);   /* 绿 */
--wave-none: var(--fg-subtle);   /* 静场 / 无人声 */
--wave-dim: var(--fg-faint);     /* 过滤时被弱化的竖条 */

/* :root[data-theme="light"]（暗版） */
--spk-1: oklch(0.52 0.15 255);
--spk-2: oklch(0.50 0.16 305);
--spk-3: oklch(0.53 0.12 200);
--spk-4: oklch(0.55 0.18 22);
--spk-5: oklch(0.52 0.15 150);
--wave-none: var(--fg-subtle);
--wave-dim: var(--fg-faint);
```

- MediaViewer 里写死的 `SPEAKER_COLORS` hex 数组**删除**；`speakerColor(id)` 改为按说话人在 `speakers` 列表中的序号返回 `var(--spk-N)`（N = idx % 5 + 1）。
- 说话人色经 CSS 自定义属性 `--c` / `--bar-c` 注入（见 §3/§5），`color-mix(in oklab, var(--c) …, transparent)` 属于 token 派生，不违反「禁止颜色字面量」约束。

## 3. 波形按说话人着色（仅当有说话人数据时启用）

**竖条 → 说话人归属**（纯函数，新文件 `speakerWave.ts`）：

```ts
/** 每根竖条的时间窗 [a,b) 内出现过的说话人里，取「全局分段数最少」的那位。
    理由:竖条约 25s 一根,学生几秒的插话按中点采样/时长占比都会被平均掉;
    少数说话人优先保证短插话在波形上留下有色竖条。窗口内无人 → null。 */
export function barSpeakers(
  segments: { t: string; speaker?: string }[],
  duration: number,
  n: number,
): (string | null)[]
```

- 输入用 `parseTimestamp`（已有）把 `t` 转秒；段结束时间 = 下一段起始（最后一段到 duration）。
- `duration` 用 `<audio>` 的 `durTime`（loadedmetadata 后才有；durTime 为 0 时先全 null，就绪后重算）。

**渲染与样式**（抄设计稿）：

```css
.np-wave-bar {
  background: var(--bar-c, var(--fg-subtle)); opacity: 0.30;
  transition: background 0.14s, opacity 0.14s, filter 0.14s, height 0.3s var(--ease);
}
.np-wave-bar.played { opacity: 1; }                    /* 进度 = 不透明度 */
.np-wave-bar.dim { --bar-c: var(--wave-dim); opacity: 0.12; }
.np-wave-bar.dim.played { opacity: 0.30; }             /* 过滤压暗未选中说话人 */
.np-wave:hover .np-wave-bar.played:not(.dim) { filter: brightness(1.12); }
```

- 每根竖条内联 `--bar-c: var(--spk-N)`（或 `--wave-none`）；`.dim` = 过滤集非空且该条说话人不在选中集。
- **无说话人数据的音频保持现状**（用户拍板）：未播 `--fg-subtle`、已播 `--accent`、hover `--accent2`，不透明度方案与 spk class 都不启用。实现上：`transcript?.speakers?.length` 为真才走新分支。
- seek/拖拽/点击交互、3px 圆头 × 96 根、虚线基线全部不变。

## 4. 说话人过滤 chips

- 位置：转录面板工具栏，「只看重点」旁；**「全部」chip + 每说话人一个 chip**。
- 行为：多选集合 `pickedSpeakers: Set<string>`；空集 =「全部」亮起、显示所有段；点「全部」清空集合；与 `highlightsOnly` **AND 叠加**。
- 过滤同时作用于转录列表（隐藏未选中说话人的段）与波形（`.dim` 压暗，见 §3）。
- 样式（抄设计稿）：chip 带说话人色圆点 + `color-mix` 光环；选中时边框/底色用该说话人色；「全部」选中用中性 `--accent-soft` 系。
- i18n 新键：`audioSpeakerAll`（zh「全部」/ en「All」），zh/en 两份都加（parity 测试强制）。

## 5. 转录样式变更

- `.ap-seg.hl { background: var(--hl-bg) }` 与 hover 金色底**删除**——重点句只保留星标（`--hl-star` 金色不变）；「只看重点」toggle 保留。
- `.ap-speaker` 颜色改为 `--c` 注入：`<span class="ap-speaker" :style="{ '--c': speakerColor(id) }">`，CSS `color: var(--c)`、圆点 `background: var(--c)`。

## 6. 交互保证（需求 5，测试锁定)

- 播放高亮 `activeSeg` 由 `curTime` 实时推导（现状），过滤操作不触碰 `<audio>` 与 `curTime` → 高亮与进度天然保持。
- 补充行为：过滤集或 `highlightsOnly` 变化后 `nextTick` 调用现有 `scrollActiveIntoView()`——若当前段仍在列表中，平滑滚动到可见。
- 测试锁定：对「rows 过滤逻辑 + activeSeg 与过滤无耦合」写单测（见 §7）；activeSeg 高亮定位继续用分段原始索引 `data-seg`，过滤只减行、不重排索引。

## 7. 模块与测试

- 新文件 `src/files/viewers/speakerWave.ts`：`barSpeakers()`（§3）+ `speakerToken(idx)`（返回 `var(--spk-N)`）+ `segMatches(seg, picked, highlightsOnly)`（单段过滤谓词，MediaViewer 的 `transcriptRows` 用它过滤，波形 `.dim` 判断复用同一 picked 集合）。
- `speakerWave.test.ts`（vitest）：
  - `barSpeakers`：双说话人构造数据——长段中插 3s 短段，短段所在竖条归短说话人（少数优先）；窗口无人 → null；duration=0 → 全 null；单说话人全程 → 全该人。
  - `speakerToken`：0→`var(--spk-1)`，5→`var(--spk-1)`（%5 循环）。
  - 过滤逻辑：picked 空=全显；picked={s2} 只剩 s2 段;与 highlightsOnly 叠加;**过滤前后同一原始索引的段仍是同一段**（锁需求 5 的索引不重排）。
- i18n parity、color-guard(无新字面量;oklch 值只进 theme.css) 既有测试自动覆盖。
- `pnpm exec vue-tsc --noEmit` + 全量 `pnpm test` 须绿。

## 8. 验收（真机 `/app/`，New recording 21.m4a）

1. 波形:讲师段蓝、学生插话紫(短插话可见)、静场灰;已播段满色、未播淡;dark/light 两主题下都成立。
2. chips:点「Student」→ 列表只剩学生段、波形只有学生竖条保持彩色其余压暗;再点「全部」→ 恢复。
3. 筛选中点击某段(seek)→ 点「全部」/再勾一人:该段仍高亮、进度条不动、自动滚回该段。
4. 重点句无金色底,星标仍金色;「只看重点」+ 说话人过滤可叠加。
5. 无转录的普通音乐:波形与改动前完全一致(未播灰/已播蓝紫)。
6. Console 无报错;主题切换即时生效。

## 9. 取舍与说明

- **少数说话人优先**而非时长占比:短插话可见性优先,是设计稿明确选择;若未来说话人多、误导明显,可加「窗口内时长 ≥ 15% 才参与」阈值,颜色/交互不变。
- 5 色循环:>5 说话人时颜色复用,可接受(现实场景少)。
- 设计稿中的滚动条样式、顶部说明卡**不落地**(用户明确)。
- `oklch()`/`color-mix()` 需较新浏览器(Chrome 111+/Safari 16.4+),与本项目既有基线一致。
