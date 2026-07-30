// 选盘卡片悬浮提示的展开方向。
//
// 为什么不是向上:Vue2 的提示向卡片上方展开(RaidDriveCard.vue:174 `bottom: calc(100% + 8px)`),
// 但新 UI 的选盘区在存储壳层里紧贴顶栏,第一行卡片的提示会被顶栏盖住(2026-07-30 用户实盘反馈)。
// 改为**向右展开、垂直居中**;右侧放不下时翻到左侧 —— 否则最右列会重演同一个"被边界裁掉"。
// (`.st-body` 的 overflow-y:auto 会让 overflow-x 也算成 auto,溢出会拽出横向滚动条。)

// 提示宽度的保留量(px)。提示 `white-space: nowrap` 且型号行 `max-width: 160px`,
// 加左右内边距与偏移,实测不超过这个数;取整数常量而不是实测 offsetWidth ——
// 提示 display:none 时量不到宽度,为了量而临时显形会闪一下。
export const TIP_RESERVE = 210

// 判定展开方向。rect 取卡片的 getBoundingClientRect(),viewportWidth 取 window.innerWidth。
// 两侧都放不下时返回 'right'(左翻只会更糟,右侧至少还有滚动条可达)。
export function tipSide(
  rect: { left: number; right: number },
  viewportWidth: number,
  reserve: number = TIP_RESERVE,
): 'left' | 'right' {
  const fitsRight = rect.right + reserve <= viewportWidth
  if (fitsRight) return 'right'
  const fitsLeft = rect.left - reserve >= 0
  return fitsLeft ? 'left' : 'right'
}
