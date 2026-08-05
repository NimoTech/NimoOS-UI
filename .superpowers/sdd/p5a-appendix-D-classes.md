## 附录 D:CSS 类白名单(T4 / T11 的切档判据)

从蓝本 `KnowledgeLayout.vue` 与 `DashboardView.vue` 的 `<template>` 里程序化抽取(`class="…"` 与 `:class` 里的字面量),**共 98 个 `k*` 类 + 6 个修饰类**。这就是 P5a 需要的全部样式,一个不多一个不少。

### D.1 T4 负责(壳 + 通用原语,32 个)
```
knowledge-app
k-rail  k-rail-head  k-rail-title  k-rail-sub  k-rail-section  k-rail-nav
k-rail-item  k-rail-item-label  k-rail-item-cn  k-rail-item-en
k-rail-svc  k-rail-svc-row  k-rail-svc-dot  k-rail-svc-name  k-rail-svc-meta
k-rail-foot
k-main  k-topbar  k-topbar-title  k-topbar-sub  k-topbar-spacer
k-banner  k-banner-icon
k-mobile-tabs  k-mobile-tab
k-badge  k-badge-dot
k-btn
k-scroll  k-scroll-inner
k-skel
```
**不搬**:`k-toast`、`k-toast-ico`(偏离 K3,改走全局 toast)。

### D.2 T11 负责(仪表盘,65 个)
```
k-suggest-chip
k2-search  k2-search-dots  k2-suggest  k2-suggest-label
k2-sec-head  k2-sec-title  k2-sec-en  k2-sec-link
k2-onboard  k2-onboard-orb  k2-onboard-cta  k2-onboard-layers
k2-ob-layer  k2-ob-name  k2-ob-desc  k2-tag
k2-layers  k2-layer  k2-layer-top  k2-layer-name  k2-layer-name-en  k2-layer-chev
k2-layer-num  k2-layer-bar  k2-layer-sub  k2-layer-desc  k2-drafts
k2-glue  k2-glue-id
k2-roots  k2-root  k2-root-top  k2-root-ico  k2-root-path  k2-root-level
k2-root-badges  k2-root-meta  k2-root-add  k2-roots-off  k2-chip
k2-live  k2-live-top  k2-live-ico  k2-live-title  k2-live-sub
k2-live-grid  k2-live-cell  k2-cell-label
k2-prog  k2-prog-pct  k2-paused-note  k2-cc
k2-qrow  k2-qchip
k2-distill  k2-distill-sub
k2-entries  k2-entry  k2-entry-ico  k2-entry-cn  k2-entry-en  k2-entry-badge
k2-skel-card
```
(含 `k2-*` 64 个 + `k-suggest-chip`)

### D.3 修饰类(跟着各自的基类搬)
`k-btn` 的 `ghost` / `outline` / `primary`(T4)· `k2-layer-num` 里的 `second` / `suffix`(T11)· `k2-live-ico` 里的 `spin`(T11)。
另有一批**属性选择器态**,搬基类时必须一并搬:`[data-active]`(rail 项 / 移动端 tab / `k2-cc` 按钮 / `kw-node`)·`[data-tone]`(`k-badge` / `k-badge-dot` / `k-banner` / `k2-chip` / `k2-entry-ico` / `k2-entry-badge` / `k2-qchip`)·`[data-state]`(`k-rail-svc-dot` 的 error/paused/running 三态)·`[data-layer]`(`k2-layer` / `k2-ob-layer` 的 wiki/vec/note 三色)·`[data-disabled]`(`k2-entry`)·`[data-ok]`(`k2-live-ico`)。
**这些态是 1:1 的关键**:`data-state="paused"` 的橙点、`data-tone="warn"` 的橙徽标、`data-layer` 的三层配色,漏一个就是可见回归,而单测只查属性值不查颜色。

### D.4 自检命令(T4 / T11 各自跑一次,结果贴报告)
```bash
cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI
# ① 白名单里的类是否都已落地(应无输出)
for c in <把上面对应小节的类名粘进来>; do
  grep -q "\.$c\b" src/ai/styles/knowledge.scss || echo "MISSING .$c"
done
# ② 是否搬多了(白名单外的 k-/k2- 类)——人工看这份清单,凡不在 D.1/D.2 里的都要删回
grep -oE '\.k2?-[a-z0-9-]+' src/ai/styles/knowledge.scss | sort -u
```

