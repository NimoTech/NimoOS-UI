### Task 9: 集成 — Photos.vue 接线 + 挂载灯箱 + 删除 toast/刷新 + 验收

**Files:**
- Modify: `src/views/Photos.vue`(`onOpenTile` 实装、挂 `<PhotoLightbox>`、接 delete)
- Test: `src/views/__tests__/Photos.lightbox.test.ts`

**Interfaces:**
- Consumes:`useLightbox()`(T2/T3)、`PhotoLightbox`(T6)、`PhotoInfoPanel`(T7,由 T6 内部挂或此处传入——**T6 内部挂 PhotoInfoPanel 与 PhotoFilmstrip**,Photos.vue 只挂 `<PhotoLightbox>`)、`store`(P1 `photos-timeline`:`months`/`deleteAssets`/`refreshTimelineQuiet`)、`useToast`(P1 已用)、`matchesTab`(P1 `src/photos/util/tabFilter.ts`)。
- Produces:
  - `onOpenTile(photo, _list, startMs)` 实装:构造**当前 tab 过滤后**的翻页集 = `store.months.flatMap(m=>m.photos).filter(p=>matchesTab(p, tab.value))`,`useLightbox().openAt(photo, filtered, startMs)`(grid 传 `list=undefined`,由此处补齐——与用户所见一致)。
  - 模板末尾挂 `<PhotoLightbox @delete="onLightboxDelete" @toggle-fav="() => {}" />`(toggle-fav 广播 P3 接;P2 空接)。
  - `onLightboxDelete(id)`:`await store.deleteAssets([String(id)])` → `toast.show(t('photosDeletedToast',{count:1}), 4000)`(灯箱已在 T6 confirm 后 `close`;此处不再 close)。删除后 `store.deleteAssets` 内部已 `refreshTimelineQuiet`。
  - 移除 `onOpenTile` 的 `// TODO(SP7-P2)` 注释;头部注释更新为「灯箱已接入(P2)」。

- [ ] **Step 1: 写失败测试**
  - store 喂假 months → mount Photos.vue → 触发 `PhotosGrid` 的 `open`(emit)→ `useLightbox().open.value===true` 且翻页集为 tab 过滤后集合(断言 list 长度/首项)。
  - `PhotoLightbox` emit `delete(id)` → `store.deleteAssets` 被以 `[String(id)]` 调用(spy)+ `toast.show` 调用。
  - tab='video' 时打开某视频 → 翻页集只含 isVideo。
- [ ] **Step 2: RED**;**Step 3: 实现**;**Step 4: GREEN + 全量(1335+新增)+ tsc**。
- [ ] **Step 5: Commit** — `feat(photos): 灯箱集成(时间线点开/删除 toast/翻页集按 tab 过滤),P2 收官`
- [ ] **Step 6: 验收说明写进报告**(控制器转述用户):`cd /home/nimo/NimoTech/.sp7/NimoOS-New-UI && pnpm dev --host --port 5277`,浏览器 `http://192.168.1.143:5277/`(先登录)→ `http://192.168.1.143:5277/app/#/photos`。看点见文末验收清单。

---

## Self-Review 记录

- **Spec 覆盖**(§3 New-UI 侧架构「灯箱」+ §7 P2 行):缩放/平移/翻页/工具栏自隐 = T5+T6;OCR 高亮 = T1(算法)+T5(覆盖层)+T3(getAssetOcr,休眠至 P7);live photo = T6(net-new);OSM 小地图 = T1+T7;详情栏 = T7;inline 收藏/删除 = T3(逻辑)+T6(UI);返回键只关预览 = T2(pushState 手法);pointer-capture/clampPan 既有教训 = T5(照抄 files 守卫)。全覆盖。
- **范围收口**(Global Constraints 末段)逐项记台账:OCR 休眠至 P7、收藏 favIds 暂居 useLightbox(P3 提升)、加入相册(P4)/Ask Nimo(SP8)不渲染、深链(P8)。
- **类型一致性**:`Photo` 全程引 `assetToPhoto.ts`;`useLightbox` 的 open/current/list/index/isFav/prev/next/close/toggleFav 在 T2/T3 定义,T6/T9 消费同名;`photoIndexById`/`osmEmbedSrc`/`mapOcrBoxesToRects`/`browserCanDisplayImage` 签名 T1 定义,T2/T5/T7 引用同名。
- **P1 铁律落实**:T2 翻页集元素、T3 水合 seq 守卫、T8 缩略图 ref、T5 OCR/current 全部按 id 或 seq,无对象引用 `===`。
- **无占位**:纯函数(T1)给全码;大 .vue(T5/T6/T7/T8)按 P1 established「照抄源 file:line + delta 清单 + 接口签名 + 测试行为清单」模式,实现者可直读 Vue2/files 源。
- **Service 零改动假设**已在 Global Constraints 声明;若破,按 P0 约定补并记账。
- **待实现者决策(T6 delta-3)**:缩放钮归顶栏(跨组件 ref)还是归 PhotoImageViewer 底部工具栏(推荐)——二选一并在报告注明,相应微调 T5 delta-4。
