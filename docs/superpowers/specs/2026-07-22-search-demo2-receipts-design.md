# SearchDialog 第二个 demo:搬家小票(AI 描述式搜索)

日期:2026-07-22 · 状态:已与用户确认

## 目标

在现有写死的 fish demo 之外增加第二个演示数据集,展示"自然语言描述 → OCR/RAG 统一召回"
的 AI 搜索:查询 **`receipts from when I moved house last winter`**(时间 + 事件式描述,
无任何文件名线索),命中 `/DATA/Documents/Recipes/` 下 5 张真实小票照片。

## 触发

- 空态建议词新增 chip:`receipts from when I moved house last winter`(放第一位)。
- 查询词匹配 `/\b(receipts?|move|moved|moving|winter)\b/i` → 走小票数据集;否则走 fish。

## 结果集与排序(顺序即排名,不设负样本)

| # | 文件(/DATA/Documents/Recipes/) | 内容 | 排序理由 |
|---|---|---|---|
| 1 | 20260722-031032.jpg | Home Depot 搬家箱×6 + 带轮垃圾桶 $55.72 · 2024-12-27 | "moving boxes" 字面直接命中 |
| 2 | 20260722-031024.jpg | Walmart 办公椅 $75×4 等 $389.87 · 2024-12-27 | 同日大额采购 |
| 3 | 20260722-031029.jpg | Staples 书桌+站立桌+鼠标 $124.19 · 2024-12-27 | 同日 home office |
| 4 | 20260722-031001.jpg | Walmart 床品+落地灯+枕头 $73.48 · 2025-01-12 | 新家置办(语义) |
| 5 | 20260722-030940.jpg | Home Depot Bosch 电锤+钻头 $217.22 · 2025-01-16 | 同店工具,弱相关垫底 |

## 展示(沿用 fish 的结构)

- **All 标签**:该 demo 无文档行,相册卡自然排第 1 —— 横排 5 张缩略图按名次排列,
  每张右下角 `OCR` 徽标(复用 fish 里 Nick's receipt 的样式)。卡片标题/按钮/点击
  行为与 fish **完全一致**(searchAlbumMatches + Open Album ›,点击进 AI 相册)——
  用户 07-22 修订:不要单独的小票文案,也不要跳文件夹。
- **Images 标签**:5 张拆单行按 1–5 排名(复用 media-row),显示与 fish 的 OCR 行
  完全一致:`OCR` + "text recognized"(用户 07-22 修订:曾加过每行店名+金额+日期
  描述小字 `Media.desc`,已移除,内容说明留在代码注释里)。
- 单行左键 = ViewerHost 就地预览原图(真实文件,直接可用)。

## 不改的东西

- fish demo 数据与行为原样保留;`displayList`/tabs 逻辑只把 `DOCS`/`ALBUM` 换成按
  demo 选择的 computed。
- 主题:新增样式只用现有 token,无新颜色语义。

## i18n

无新增键(复用 searchAlbumMatches / searchOpenAlbum;曾加过 searchReceiptMatches,
按用户修订已移除)。
