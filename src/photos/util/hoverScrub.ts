// Ported verbatim (logic unchanged, types added) from Vue2 NimoOS-UI
// src/views/Photos/hoverScrub.js (whole file, 36 lines).

// 把指针的横向位置映射到帧序号 [0, frameCount-1]
export function computeFrameFromX(clientX: number, rectLeft: number, rectWidth: number, frameCount: number): number {
  if (rectWidth <= 0 || frameCount <= 0) return 0
  const p = (clientX - rectLeft) / rectWidth
  const idx = Math.floor(p * frameCount)
  if (idx < 0) return 0
  if (idx > frameCount - 1) return frameCount - 1
  return idx
}

// 窗口（正好一帧）在正方形 tile 内的尺寸——不依赖像素测量。
//
// 关键：覆盖层（.sprite-window）按 contain 收窄到【正好一帧】并由父级居中，黑边由底层
// tile 的 #000 背景自然形成——而不是把整条 sprite 铺满 tile（那样竖屏帧很窄、窗口里会
// 塞进相邻帧，造成「邻帧穿帮」）。窗口宽=一帧 → 内部 <img> 位移只露当前帧，邻帧落在窗口外被裁。
//
// 在正方形 tile 内 contain：横向（ar≥1）铺满宽、高按比例；竖向（ar<1）铺满高、宽按比例。
export function computeWindowStyle(frameW: number, frameH: number): { width: string; height: string } {
  const ar = frameW / frameH
  return {
    width: ar >= 1 ? '100%' : `${100 * ar}%`,
    height: ar >= 1 ? `${100 / ar}%` : '100%',
  }
}

// 整条雪碧图 <img>：宽 = N×窗口宽（每帧恰占满窗口），用 translateX 位移到第 i 帧。
// transform 百分比相对元素自身宽度：第 i 帧 → -i/N。transform 是合成器属性，
// 换帧不触发重绘（background-position 是 paint 级，曾是悬浮卡顿主因）。
export function computeStripStyle(frameCount: number, currentFrame: number): { width: string; transform: string } {
  const N = Math.max(1, frameCount)
  return {
    width: `${N * 100}%`,
    transform: `translateX(${-(100 * currentFrame) / N}%)`,
  }
}
