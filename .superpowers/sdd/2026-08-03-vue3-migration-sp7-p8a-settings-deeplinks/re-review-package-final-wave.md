# Scoped re-review package — final fix wave (6c58488..3c8c0e7)

## Commits
3c8c0e7 fix(photos): P8a 整支终审修复波(2 Important + 5 Minor)

## Stat
 src/i18n/__tests__/p8aKeys.test.ts           |  4 +-
 src/i18n/en_us.ts                            |  6 +-
 src/i18n/zh_cn.ts                            |  6 +-
 src/photos/components/PhotosAiCard.vue       |  7 ++-
 src/photos/components/PhotosStorageCard.vue  |  8 +++
 src/photos/composables/usePhotosDeepLinks.ts | 38 ++++++++++--
 src/photos/stores/__tests__/timeline.test.ts | 13 +++++
 src/photos/stores/timeline.ts                | 15 ++++-
 src/views/PhotosAlbums.vue                   | 35 ++++++++++-
 src/views/__tests__/PhotosAlbums.test.ts     | 86 ++++++++++++++++++++++++++++
 10 files changed, 206 insertions(+), 12 deletions(-)

## Diff (-U14)
```diff
diff --git a/src/i18n/__tests__/p8aKeys.test.ts b/src/i18n/__tests__/p8aKeys.test.ts
index 7a606fc..16a8173 100644
--- a/src/i18n/__tests__/p8aKeys.test.ts
+++ b/src/i18n/__tests__/p8aKeys.test.ts
@@ -1,20 +1,22 @@
 import { describe, it, expect } from 'vitest'
 import zh from '../zh_cn'
 import en from '../en_us'
 
 const KEYS = [
-  'photosSettingsTitle', 'photosSettingsSubtitle', 'photosSettingsHeroDesc',
+  // 终审 Minor 4:photosSettingsSubtitle 已删(zh_cn.ts/en_us.ts 对应处有删除登记注释)——
+  // 全仓零引用死键,AreaShell.vue 只吃 title,没有承载副标题的位置。
+  'photosSettingsTitle', 'photosSettingsHeroDesc',
   'photosSettingsNavStorage', 'photosSettingsNavAi',
   'photosSettingsStorage', 'photosSettingsVolume', 'photosSettingsFree',
   'photosSettingsUsedOf', 'photosSettingsStorageUnavailable',
   'photosSettingsSegPhotos', 'photosSettingsSegVideos', 'photosSettingsSegRaw',
   'photosSettingsSegThumbs', 'photosSettingsSegAi', 'photosSettingsSegOther',
   'photosSettingsSegFree',
   'photosSettingsRetentionLabel', 'photosSettingsRetentionDesc',
   'photosSettingsRetentionDay', 'photosSettingsRetentionFailed',
   'photosSettingsRescanLabel', 'photosSettingsRescanDesc', 'photosSettingsRescanNow',
   'photosSettingsRescanning', 'photosSettingsRescanStarted',
   'photosSettingsScanIntervalLabel', 'photosSettingsScanIntervalDesc',
   'photosSettingsScanIntervalOff',
   'photosSettingsCacheLabel', 'photosSettingsCacheDesc', 'photosSettingsClearCache',
   'photosSettingsClearing', 'photosSettingsCleared', 'photosSettingsCacheClearedToast',
diff --git a/src/i18n/en_us.ts b/src/i18n/en_us.ts
index e1b84f1..ccba958 100644
--- a/src/i18n/en_us.ts
+++ b/src/i18n/en_us.ts
@@ -1571,30 +1571,32 @@ export default {
   tmEntry: 'Time Machine',
   tmViewingFolder: 'Browsing earlier versions of {path}',
   tmEnter: 'Enter this snapshot',
   tmSettings: 'Snapshot settings',
   tmNoFolderAtTime: 'This folder did not exist yet',
   tmItemCount: '{n} items',
   tmRailJumpTo: 'Jump to the snapshot from {time}',
 
   // ── SP7-P8a 相册设置页 + 深链 + 错误态 ──
   // zh 文案权威 = Vue2 src/assets/lang/zh_CN.json;json 里没有对应键的(Vue2
   // PhotosSettings.vue 内联硬编码英文)在该键上方单独注明「自拟」与 Vue2 行号。
   // 本期不迁:主题开关(台账第二笔)· AI 入口(D1)· Sign out(D22)· 上传整块(D21)。
   // 自拟(Vue2 PhotosSettings.vue:18 内联 "Settings")
   photosSettingsTitle: 'Settings',
-  // 自拟(Vue2 PhotosSettings.vue:19 内联 "Storage · AI behavior")
-  photosSettingsSubtitle: 'Storage · AI behavior',
+  // 终审 Minor 4:此处原有 photosSettingsSubtitle(Vue2 PhotosSettings.vue:19 顶栏
+  // 副标题 "Storage · AI behavior")已删 —— 全仓零引用。AreaShell.vue:6 的 props 只有
+  // `title`,没有承载副标题的位置,这行 Vue2 顶栏文案在 New-UI 里因此被刻意丢弃,不是漏迁。
+  // 同 photosSvSettingsPending 的删除先例(zh_cn.ts 对应处)。
   // 自拟(Vue2 PhotosSettings.vue:31 内联英文长句)
   photosSettingsHeroDesc: 'Everything Nimo does on your NAS — what runs, where it runs, and how much space it takes.',
   // 自拟(Vue2 PhotosSettings.vue:33 内联 "Storage")
   photosSettingsNavStorage: 'Storage',
   // 自拟(Vue2 PhotosSettings.vue:34 内联 "AI behavior")
   photosSettingsNavAi: 'AI behavior',
   // 自拟(Vue2 PhotosSettings.vue:46 内联 "Storage")
   photosSettingsStorage: 'Storage',
   photosSettingsVolume: 'volume',
   photosSettingsFree: 'free',
   photosSettingsUsedOf: 'used of',
   photosSettingsStorageUnavailable: 'Storage info unavailable',
   photosSettingsSegPhotos: 'Photos',
   photosSettingsSegVideos: 'Videos',
diff --git a/src/i18n/zh_cn.ts b/src/i18n/zh_cn.ts
index d7814fb..334e99e 100644
--- a/src/i18n/zh_cn.ts
+++ b/src/i18n/zh_cn.ts
@@ -1576,30 +1576,32 @@ export default {
   tmEntry: '时间机器',
   tmViewingFolder: '正在查看 {path} 的历史版本',
   tmEnter: '进入此快照',
   tmSettings: '快照设置',
   tmNoFolderAtTime: '此时还没有这个文件夹',
   tmItemCount: '{n} 项',
   tmRailJumpTo: '跳转到 {time} 的快照',
 
   // ── SP7-P8a 相册设置页 + 深链 + 错误态 ──
   // zh 文案权威 = Vue2 src/assets/lang/zh_CN.json;json 里没有对应键的(Vue2
   // PhotosSettings.vue 内联硬编码英文)在该键上方单独注明「自拟」与 Vue2 行号。
   // 本期不迁:主题开关(台账第二笔)· AI 入口(D1)· Sign out(D22)· 上传整块(D21)。
   // 自拟(Vue2 PhotosSettings.vue:18 内联 "Settings")
   photosSettingsTitle: '设置',
-  // 自拟(Vue2 PhotosSettings.vue:19 内联 "Storage · AI behavior")
-  photosSettingsSubtitle: '存储 · AI 行为',
+  // 终审 Minor 4:此处原有 photosSettingsSubtitle(「存储 · AI 行为」,对应 Vue2
+  // PhotosSettings.vue:19 顶栏副标题)已删 —— 全仓零引用。AreaShell.vue:6 的 props 只有
+  // `title`,没有承载副标题的位置,这行 Vue2 顶栏文案在 New-UI 里因此被刻意丢弃,不是漏迁。
+  // 同 :1256 处 photosSvSettingsPending 的删除先例。
   // 自拟(Vue2 PhotosSettings.vue:31 内联英文长句)
   photosSettingsHeroDesc: 'Nimo 在你的 NAS 上做的一切 —— 什么在跑、跑在哪、占多少空间。',
   // 自拟(Vue2 PhotosSettings.vue:33 内联 "Storage")
   photosSettingsNavStorage: '存储',
   // 自拟(Vue2 PhotosSettings.vue:34 内联 "AI behavior")
   photosSettingsNavAi: 'AI 行为',
   // 自拟(Vue2 PhotosSettings.vue:46 内联 "Storage")
   photosSettingsStorage: '存储',
   photosSettingsVolume: '容量',
   photosSettingsFree: '可用',
   photosSettingsUsedOf: '已用，共',
   photosSettingsStorageUnavailable: '存储信息不可用',
   photosSettingsSegPhotos: '照片',
   photosSettingsSegVideos: '视频',
diff --git a/src/photos/components/PhotosAiCard.vue b/src/photos/components/PhotosAiCard.vue
index a7df444..ee83b6d 100644
--- a/src/photos/components/PhotosAiCard.vue
+++ b/src/photos/components/PhotosAiCard.vue
@@ -158,31 +158,36 @@ async function doRecluster(): Promise<void> {
         <div class="aic-privacy-body">{{ t('photosSettingsPrivacyBody') }}</div>
       </div>
     </div>
 
     <div class="aic-divider"></div>
 
     <h3 class="aic-subhead">{{ t('photosSettingsFeaturesTitle') }}</h3>
     <p class="aic-subhead-desc">{{ t('photosSettingsFeaturesDesc') }}</p>
     <div class="aic-features">
       <label v-for="f in featureRows" :key="f.id" class="aic-feature">
         <div class="aic-feature-text">
           <div class="lbl">{{ f.label }}</div>
           <div class="desc">{{ f.desc }}</div>
         </div>
+        <!-- 终审 Minor 6:a11y 债务登记——这颗开关只吃鼠标 click,没有 tabindex/keydown,
+             键盘/AT 用户够不到。Vue2 PhotosSettings.vue:163 是裸 div,没有 role;之前这里加了
+             role="switch" 却没配套键盘可达性,等于向 AT 宣称"这是可操作控件"但操作不了,比
+             什么都不说更糟。按裁决去掉 role、不补键盘处理,先照 Vue2 1:1 恢复裸 div——把整个
+             设置页做成可键盘导航是本期范围之外的独立工作。 -->
         <div
           class="st-switch" :data-on="store.aiFeatures[f.id]" :data-test="`ai-switch-${f.id}`"
-          role="switch" :aria-checked="store.aiFeatures[f.id]" :aria-label="f.label"
+          :aria-checked="store.aiFeatures[f.id]" :aria-label="f.label"
           @click="toggleFeature(f.id)"
         ></div>
       </label>
     </div>
 
     <div class="aic-divider"></div>
 
     <h3 class="aic-subhead">{{ t('photosSettingsIndexTitle') }}</h3>
     <div class="aic-row" style="padding-top:6px">
       <div class="aic-row-text">
         <div class="aic-row-label" v-if="indexing">{{ t('photosSettingsIndexRebuilding') }}</div>
         <div class="aic-row-label" v-else>{{ t('photosSettingsIndexLastBuilt') }} {{ lastBuiltText }}</div>
         <div class="aic-row-desc">
           <template v-if="indexing">{{ t('photosSettingsIndexPct', { pct: indexedPct }) }}</template>
diff --git a/src/photos/components/PhotosStorageCard.vue b/src/photos/components/PhotosStorageCard.vue
index 9247070..172d0f9 100644
--- a/src/photos/components/PhotosStorageCard.vue
+++ b/src/photos/components/PhotosStorageCard.vue
@@ -44,28 +44,36 @@ const SEG_LABEL_KEYS: Record<StorageSegKey, string> = {
   photos: 'photosSettingsSegPhotos',
   videos: 'photosSettingsSegVideos',
   raw: 'photosSettingsSegRaw',
   thumbs: 'photosSettingsSegThumbs',
   ai: 'photosSettingsSegAi',
   other: 'photosSettingsSegOther',
 }
 
 const RETENTION_OPTIONS = [7, 15, 30, 60, 90] as const
 
 // Vue2 PhotosSettings.vue:304-311 的 scanIntervalOptions:6h/12h/24h/7d 这四个 label 在源里
 // 是裸字面量、从不过 $t(只有 off 那一档过 $t('scan_interval_off'))——它们是时长单位缩写
 // (小时/天),不是需要按语言翻译的自然语言句子,故照搬为字面量,不新增/复用 i18n key
 // (task-3-brief.md 的 ruling #1)。
+//
+// 终审 Minor 7(不改行为,仅登记):retention(:186,photosSettingsRetentionDay)译成了
+// 「{n} 天」,这里的扫描间隔挡位却保留 6h/12h/24h/7d 字面量——zh 下两组相邻分段控件因此
+// 一个读「7 天 | 15 天 | 30 天 …」、一个读「关闭 | 6h | 12h | 24h | 7d」,Vue2 原本两组
+// 内部风格一致(都是 7d…/Off 6h…字面量)。两种做法各自都说得通(retention 走 $t 是本期
+// 刻意登记的选择,见上一段注释链;scan 保留单位缩写也有它的理由),但相邻不一致本身没被
+// 登记过——写在这里存证,是决策而非疏漏。是否统一,留给机主上机验收时拍板(不在本波修复
+// 范围)。
 const scanIntervalOptions = computed(() => [
   { min: 0, label: t('photosSettingsScanIntervalOff') },
   { min: 360, label: '6h' },
   { min: 720, label: '12h' },
   { min: 1440, label: '24h' },
   { min: 10080, label: '7d' },
 ])
 
 async function selectRetention(d: number): Promise<void> {
   const ok = await store.setRetention(d)
   if (!ok) {
     // Vue2 :254-262 的 retention watcher 失败时走 $buefy.toast(与本卡 showToast 完全不同的
     // 提示组件,New-UI 没有等价物),不是 showToast(icon,...) 调用,所以源里没有一个可以照搬
     // 的 icon 名。按语义最接近的既有 showToast 调用类比——":274-279" features 保存失败同样是
diff --git a/src/photos/composables/usePhotosDeepLinks.ts b/src/photos/composables/usePhotosDeepLinks.ts
index 28b896d..d071894 100644
--- a/src/photos/composables/usePhotosDeepLinks.ts
+++ b/src/photos/composables/usePhotosDeepLinks.ts
@@ -1,31 +1,61 @@
 // SP7-P8a-T7/T8: 深链 ?asset / ?photoset / ?q / ?album / ?person ——
 // 回源:Vue2 NimoOS-UI src/views/Photos/PhotosTimeline.vue:364-377(mounted 里的分发)、
 // :431-440(_openAssetFromQuery)、:441-465(_openPhotoSetFromQuery)、:491-494(?q,
 // _applyUrlDeepLinks 内)、:509-523(?person,_applyPersonFromQuery)。
 // ?album 的 Vue2 出处不在这个文件——它是 PhotosAlbumsView.vue:264 自己 mounted() 里读的
 // (同页面切面板架构下,只有相册列表视图关心这个键)。New-UI 统一收进本组合式:三个键
 // 都是"/photos?xxx= 兼容入口 → 归一到真实路由"的入口归一,而不是"同页面内切换本地状态"。
 //
+// 范围清单(终审 Important 2,回源核实 Vue2 :364-374 的 mounted 分发 + :475-507 的
+// _applyUrlDeepLinks 完整键集 + 两个子视图各自的 mounted()):
+//   Vue2 `/photos` 全部支持的 query 键 = photoset, asset, active(:368-374,mounted 里
+//   分发)+ view, tab, settings, q, place, spot, person, photo(:475-507,
+//   _applyUrlDeepLinks 内)+ album(PhotosAlbumsView.vue:264,相册列表页自己 mounted() 读)
+//   + smartview(PhotosSmartViewsView.vue:340,智能视图页自己 mounted() 读)。
+//   本文件实现:asset / photoset / active / q / album / person —— 6 个。
+//   刻意不实现(留给下一期,由控制器决策,不是遗漏):
+//     - view、tab —— New-UI 用真实路由 path 区分导航目的地/子标签,不需要一个
+//       query 键来在同一页面内切面板;`/photos?view=albums` 这类旧书签本期静默无效。
+//     - settings —— New-UI 已有独立设置路由(`/photos/settings?section=ai`),是
+//       `?settings=1|ai` 的直接对应物,但接线是下一期的入口归一工作,本期未做——
+//       旧书签 `/photos?settings=ai` 本期静默无效,与 view 同一类。
+//     - place、spot —— 依赖后端 place 详情(城市名/spot 坐标)才能落地,New-UI 侧
+//       对应的地点详情路由本期未建。
+//     - photo —— Vue2 的灯箱回填键之一(与 photoset/asset 同类但走 _applyUrlDeepLinks
+//       而非 mounted 里的分发),本期没有实现对应入口。
+//     - smartview —— 智能视图页的深链键,本文件只统一了相册(album)那一个子视图键,
+//       智能视图这一个未纳入。
+//
 // 挂载约定:usePhotosDeepLinks() 在 /photos 的 setup 里调一次,内部自行 onMounted——
 // 不装路由 watcher。这是一次性交接(?photoset 的 handoff 读完即 removeItem),不是
 // "同路由改查询参数"的场景;装 watcher 会让已被消费掉的 handoff 在后续 query 变化时
 // 被误判成"缺失"而重复触发降级路径。保持"一个键一个小函数"的结构。
 //
-// 执行顺序(Vue2 :371-377 的先后手):photoset/asset(开灯箱,不改路由)必须先跑完,
-// q/album/person(改路由)才跑。灯箱那段是异步的(要等 fetchAssetDetail),路由改写
-// 本身是同步的——如果不显式 await 灯箱那段结束,同步的 router.replace 反而会抢在异步
-// 取图完成之前执行,顺序就会在真实时序上颠倒。onMounted 因此包一层 IIFE 顺序 await。
+// 执行顺序(偏离登记,按铁律修正,不照抄——回源核实见 :364-377):Vue2 mounted() 里
+// _openPhotoSetFromQuery(...)/_openAssetFromQuery(...) 是**不 await 的**调用(fire-and-
+// forget 的异步函数),紧接着同步调用 _applyUrlDeepLinks()。也就是说 Vue2 的真实时序是
+// q/place/person(路由改写那一路)先跑完,灯箱那段的 fetchAssetDetail 仍在飞行中、稍后
+// 才落定——这是 Vue2 从未刻意保证过顺序的竞态,不是"先灯箱后路由"的设计。
+// New-UI 这里改成显式 await 灯箱那段、再跑 q/album/person,是刻意串行化,不是"照抄
+// Vue2 时序"——两条腿都会改路由/开灯箱这类可观察副作用,串行让结果可预测(谁先完成
+// 不取决于网络时序),优于复刻一个从未被保证过、纯属实现细节的竞态。
+//
+// 范围声明:混合"灯箱开图 + 导航型 query"的组合输入不是本文件的支持形状——`?q` +
+// `?album` + `?person` 若同时到达,会在同一个 IIFE 里连续触发三次 router.replace(q 的
+// 结果先被 album 的 replace 覆盖导航,person 那条异步落地后又覆盖一次),没有互斥或
+// 排队。这是已知限制,不在本期修复范围(deep-link 组合从来不是产品设计要处理的入口
+// 形状,Vue2 也没有为这种组合定义过明确行为)。
 import { onMounted } from 'vue'
 import { useRoute, useRouter } from 'vue-router'
 import type { LocationQueryValue } from 'vue-router'
 import { useI18n } from 'vue-i18n'
 import { service } from '@nimotech/nimoos-service'
 import { useLightbox } from '../lightbox/useLightbox'
 import { usePhotosPeople } from '../stores/people'
 import { useToast } from '../../stores/toast'
 import { assetToPhoto, type Photo } from '../util/assetToPhoto'
 
 const PHOTOSET_KEY_PREFIX = 'nimo:photoset:'
 // 取不到明细时的 toast 停留时长,照 Vue2 :438 / :463 的 duration: 3000。
 const NOT_FOUND_TOAST_MS = 3000
 
diff --git a/src/photos/stores/__tests__/timeline.test.ts b/src/photos/stores/__tests__/timeline.test.ts
index 19c4999..bea7833 100644
--- a/src/photos/stores/__tests__/timeline.test.ts
+++ b/src/photos/stores/__tests__/timeline.test.ts
@@ -246,28 +246,41 @@ describe('photos-timeline store', () => {
   })
 
   // P8a-T10(P1 挂账):照 Vue2 scheduleTaskRemove(store/modules/photos.js:50-58,
   // _onTaskBus :1388-1402)——非 index 类型的 done 任务 5s 后自动从列表移除。
   it('ingestTaskBus: 非 index 类型 done 任务 5s 后从列表移除(边界:4999ms 仍在,+2ms 已移除)', () => {
     const s = useTimelineStore()
     s.ingestTaskBus({ id: 'ocr-1', type: 'ocr', status: 'done' })
     expect(s.tasks).toHaveLength(1)
     vi.advanceTimersByTime(4999)
     expect(s.tasks).toHaveLength(1)
     vi.advanceTimersByTime(2)
     expect(s.tasks).toHaveLength(0)
   })
 
+  // 终审 Minor 5:Vue2 :1403-1406 对 error 任务同样 scheduleTaskRemove,只是延迟 10s
+  // (不是 done 的 5s)。此前只搬了 running/done,error 任务永久留在列表——补上同款
+  // 边界用例(9999ms 仍在 / +2ms 已移除),复用同一张 _doneRemovalTimers 表。
+  it('ingestTaskBus: error 任务 10s 后从列表移除(边界:9999ms 仍在,+2ms 已移除)', () => {
+    const s = useTimelineStore()
+    s.ingestTaskBus({ id: 'ocr-err-1', type: 'ocr', status: 'error' })
+    expect(s.tasks).toHaveLength(1)
+    vi.advanceTimersByTime(9999)
+    expect(s.tasks).toHaveLength(1)
+    vi.advanceTimersByTime(2)
+    expect(s.tasks).toHaveLength(0)
+  })
+
   it('ingestTaskBus: index 类型的 done 任务不走 5s 过期(留给 fetchIndexStatus 的 idle 对账)', () => {
     const s = useTimelineStore()
     s.ingestTaskBus({ id: 'idx-1', type: 'index', status: 'done' })
     vi.advanceTimersByTime(5001)
     expect(s.tasks).toHaveLength(1) // 计时器不管 index,只有 idle 对账才会摘掉它
   })
 
   it('ingestTaskBus: done 任务的移除计时器在同 id 再次 running 时取消', () => {
     const s = useTimelineStore()
     s.ingestTaskBus({ id: 'ocr-1', type: 'ocr', status: 'done' })
     vi.advanceTimersByTime(3000)
     s.ingestTaskBus({ id: 'ocr-1', type: 'ocr', status: 'running', current: 1, total: 10 })
     vi.advanceTimersByTime(5000) // 若旧计时器没被取消,这里会把复活的任务错误摘掉
     expect(s.tasks).toHaveLength(1)
diff --git a/src/photos/stores/timeline.ts b/src/photos/stores/timeline.ts
index 6493680..43cfb95 100644
--- a/src/photos/stores/timeline.ts
+++ b/src/photos/stores/timeline.ts
@@ -160,45 +160,58 @@ export const useTimelineStore = defineStore('photos-timeline', () => {
       tasks.value = []
     }
   }
 
   function ingestTaskBus(evt: unknown) {
     const task = unwrapTaskBusPayload(evt)
     if (!task || !task.id) return
     const idx = tasks.value.findIndex(t => t.id === task.id)
     if (idx >= 0) {
       tasks.value.splice(idx, 1, { ...tasks.value[idx], ...task })
     } else {
       tasks.value.push(task)
     }
 
-    // P8a-T10(P1 挂账,照 Vue2 _onTaskBus store/modules/photos.js:1382-1402):非 index 类型
+    // P8a-T10(P1 挂账,照 Vue2 _onTaskBus store/modules/photos.js:1382-1406):非 index 类型
     // 的 done 任务 5s 后自动从列表移除;running 事件说明任务复活,取消挂起的移除计时器。
     // index 类型故意不接这套计时器——它由 fetchIndexStatus 的 idle 对账(:118-120,按后端
     // pending/queueLen 真实进度收尾)负责摘除,两套机制同时管一种任务类型会变成任务列表的
     // 第二个真相源(违反"不建第二个任务列表源"的约束)。Vue2 源里 index 其实也会走这个计时器
     // (只在 face 任务已存在时才改成立即摘除),但 New-UI 早在 timeline.ts 落地 fetchIndexStatus
     // 时就已经用 idle 对账取代了 index 的收尾路径,这里维持既有分工,不重新引入计时器竞争。
+    //
+    // 终审 Minor 5:Vue2 :1403-1406 对 status==='error' 的任务同样 scheduleTaskRemove,
+    // 只是延迟 10s(不是 done 的 5s)。此前这段只搬了 running/done 两支,error 任务因此永久
+    // 留在任务列表里——不是"考虑过 error 之后决定不做"的偏离,是遗漏,现补上,复用同一张
+    // _doneRemovalTimers 表(不新开第二张计时器 map)。
     if (task.status === 'running') {
       _cancelDoneRemoval(task.id)
     } else if (task.status === 'done' && task.type !== 'index') {
       _cancelDoneRemoval(task.id)
       const id = task.id
       const timer = setTimeout(() => {
         _doneRemovalTimers.delete(id)
         tasks.value = tasks.value.filter(t => t.id !== id)
       }, 5000)
       _doneRemovalTimers.set(id, timer)
+    } else if (task.status === 'error') {
+      _cancelDoneRemoval(task.id)
+      const id = task.id
+      const timer = setTimeout(() => {
+        _doneRemovalTimers.delete(id)
+        tasks.value = tasks.value.filter(t => t.id !== id)
+      }, 10000)
+      _doneRemovalTimers.set(id, timer)
     }
   }
 
   async function deleteAssets(ids: string[]): Promise<number> {
     let successCount = 0
     for (const id of ids) {
       try {
         await service.photos.deleteAsset(id)
         successCount++
       } catch (e) {
         console.error('[photos-timeline] deleteAsset', id, e)
       }
     }
     if (successCount > 0) {
diff --git a/src/views/PhotosAlbums.vue b/src/views/PhotosAlbums.vue
index cb8684e..0b5e8e6 100644
--- a/src/views/PhotosAlbums.vue
+++ b/src/views/PhotosAlbums.vue
@@ -144,28 +144,45 @@ async function confirmCreate(): Promise<void> {
     console.error('[albums] createAlbum', e)
     toast.show(isConflict(e) ? t('photosAlbumNameExists') : t('photosAlbumCreateFailed'))
   } finally {
     // Vue2 :354-357 是 finally 关模态(不是只成功才关)——select 分支的模态关闭不影响
     // 已经打开的 pickerOpen(两者是独立的 v-if 层)。
     createOpen.value = false
     creating.value = false
   }
 }
 
 function onPickerAdded(): void {
   void albums.fetchAlbums()
 }
 
+// 终审 Important 1(全支收尾):fetchAlbums 失败时 albumsLoaded 保持假(见 albums.ts 注释,
+// 刻意不变),旧实现下 `isEmpty = albums.albumsLoaded && albums.albums.length === 0` 因此恒假
+// → 落进网格分支,渲染"我的相册"分区头 + 光秃秃的新建卡片,没有任何失败提示/重试入口——与
+// PhotosFavorites.vue/PhotosAlbumDetail.vue 已经收口过的同一缺陷(P8a Task 9)是同一个 store、
+// 同一种符号(loadError),这里补第三处。写法照搬这两个姐妹页的既定形状:本地 retrying 守卫
+// (不进 store)+ disabled 反馈 + 复用同一个 fetchAlbums。
+const retryingAlbums = ref(false)
+async function retryAlbums(): Promise<void> {
+  if (retryingAlbums.value) return
+  retryingAlbums.value = true
+  try {
+    await albums.fetchAlbums()
+  } finally {
+    retryingAlbums.value = false
+  }
+}
+
 // 照 Vue2 :240-259 的两个全局监听,onUnmounted 摘干净。
 function onDocMousedown(e: MouseEvent): void {
   if (sortOpen.value && sortMenuRef.value && !sortMenuRef.value.contains(e.target as Node)) {
     sortOpen.value = false
   }
 }
 function onDocKeydown(e: KeyboardEvent): void {
   if (e.key !== 'Escape') return
   if (createOpen.value) {
     closeCreate()
     return
   }
   if (sortOpen.value) sortOpen.value = false
 }
@@ -210,29 +227,42 @@ onUnmounted(() => {
                   <span class="sort-check">{{ s.id === sort ? '✓' : '' }}</span>
                   <span class="sort-text">
                     <span class="lbl">{{ s.label }}</span>
                     <span class="hint">{{ s.hint }}</span>
                   </span>
                 </button>
               </div>
             </div>
             <button type="button" class="bar-btn btn-primary" data-test="albums-new-btn" @click="openCreate">
               {{ t('photosAlbumNew') }}
             </button>
           </div>
         </div>
 
-        <div v-if="isEmpty" class="empty-state" data-test="albums-empty">
+        <!-- 终审 Important 1:失败态优先级在空态之前——loadError 一旦为真,albumsLoaded 仍是
+             假(刻意,见 albums.ts 注释),不该再落进 isEmpty 分支渲染一个没有任何提示的空网格。
+             同 PhotosFavorites.vue/PhotosAlbumDetail.vue 已收口的两处一致形状。 -->
+        <div v-if="albums.loadError" class="empty-state" data-test="albums-load-error">
+          <div class="empty-state-title">{{ t('photosAlbumLoadFailed') }}</div>
+          <button
+            type="button"
+            class="bar-btn"
+            data-test="albums-retry"
+            :disabled="retryingAlbums"
+            @click="retryAlbums"
+          >{{ t('photosRetry') }}</button>
+        </div>
+        <div v-else-if="isEmpty" class="empty-state" data-test="albums-empty">
           <div class="empty-state-title">{{ t('photosAlbumsEmptyTitle') }}</div>
           <div class="empty-state-desc">{{ t('photosAlbumsEmptyHint') }}</div>
         </div>
 
         <!-- 终审必修 3:Vue2 PhotosAlbumsView.vue:52-58 在网格之上无条件渲染的分区头
              (「我的相册 / 你创建的相册」)——New-UI 曾直接从 banner 落到网格,漏渲染整段,
              连带两个专为它准备的 i18n 键(photosAlbumsMine/photosAlbumsMineHint)成了死码。
              滚动容器安置:Vue2 的滚动容器是外层 .albums-body(photos.scss:3202-3206),分区头
              和网格都是它内部一起滚动的静态内容,不是网格自己另开一层滚动区——这里同构,把
              flex:1+overflow-y:auto 从 .album-grid 挪到新包一层的 .albums-scroll 上,
              .album-grid 收窄回纯网格布局(display:grid + gap),分区头和卡片网格一起随
              .albums-scroll 滚动,不会分裂成两段独立滚动区。 -->
         <div class="albums-scroll scroll">
           <section class="albums-section">
@@ -338,28 +368,31 @@ onUnmounted(() => {
     :album-id="pickerAlbumId"
     :album-name="pickerAlbumName"
     @update:open="pickerOpen = $event"
     @added="onPickerAdded"
   />
 </template>
 
 <style scoped>
 .photos-layout { display: flex; gap: 16px; align-items: flex-start; min-height: 100%; }
 .photos-main { position: relative; flex: 1 1 auto; min-width: 0; align-self: stretch; display: flex; flex-direction: column; min-height: 0; }
 
 .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 60px 20px 20px; color: var(--fg-muted); text-align: center; }
 .empty-state-title { font-size: 16px; font-weight: 600; color: var(--fg); }
 .empty-state-desc { font-size: 13px; }
+/* 终审 Important 1:与 PhotosFavorites.vue/PhotosAlbumDetail.vue 的同款失败态间距对齐
+   (两处已有此规则),否则三个失败屏视觉不一致。 */
+.empty-state .bar-btn { margin-top: 10px; }
 
 /* ── Banner ── */
 .albums-banner { display: flex; align-items: flex-end; gap: 18px; padding: 4px 4px 16px; flex-wrap: wrap; }
 .albums-banner h1 { font-size: 22px; font-weight: 600; letter-spacing: -0.01em; margin: 0; color: var(--fg); }
 .albums-sub { color: var(--fg-muted); font-size: 12.5px; margin-top: 4px; }
 .albums-actions { margin-left: auto; display: inline-flex; gap: 8px; align-items: center; }
 .albums-sort-wrap { position: relative; }
 
 .albums-sort-menu {
   position: absolute; top: calc(100% + 6px); right: 0; min-width: 230px; z-index: 20;
   background: var(--popup-bg); border: 1px solid var(--card-border); border-radius: 12px;
   padding: 4px; box-shadow: var(--card-shadow-hi);
 }
 .albums-sort-item {
diff --git a/src/views/__tests__/PhotosAlbums.test.ts b/src/views/__tests__/PhotosAlbums.test.ts
index 7bcc41f..e014668 100644
--- a/src/views/__tests__/PhotosAlbums.test.ts
+++ b/src/views/__tests__/PhotosAlbums.test.ts
@@ -312,26 +312,112 @@ describe('PhotosAlbums.vue', () => {
     expect(w.find('[data-test="albums-create-modal"]').exists()).toBe(false)
   })
 
   // 终审必修 3:Vue2 PhotosAlbumsView.vue:52-58 在网格之上无条件渲染「我的相册 / 你创建的
   // 相册」分区头,New-UI 从 banner 直接落到 .album-grid,整段分区头丢失——两个专为它准备的
   // i18n 键(photosAlbumsMine/photosAlbumsMineHint)因此成了死码。界面严格 1:1 照 Vue2,这是
   // 纯视觉删减,必须补。
   it('必修3回归:网格之上渲染「我的相册 / 你创建的相册」分区标题(Vue2 :52-58 对应,New-UI 曾漏渲染)', async () => {
     svc.photos.listAlbums.mockResolvedValue([rawAlbum(1, { name: 'Tokyo' })])
     const { w } = await mountView()
     expect(w.text()).toContain(zh.photosAlbumsMine)
     expect(w.text()).toContain(zh.photosAlbumsMineHint)
   })
 
+  // 终审 Important 1(全支收尾):fetchAlbums 失败时 albumsLoaded 保持假(见 albums.ts
+  // 注释),旧实现下 isEmpty 因此恒假 → 落进网格分支渲染"我的相册"分区头 + 光秃秃的新建卡片,
+  // 没有任何失败提示。新增 loadError 分支必须拦在最前面——同 PhotosFavorites.test.ts 的三条
+  // 挡门用例(失败态渲染 / 重试成功 / 重试仍失败的 in-flight 与结束后都持续可见)+ 两条
+  // "仍能区分"的挡门用例(确认空 vs 还在加载中)。
+  it('加载失败时渲染失败态而非空网格(P4 遗留同款缺陷)', async () => {
+    svc.photos.listAlbums.mockRejectedValueOnce(new Error('network'))
+    const { w } = await mountView()
+    expect(w.find('[data-test="albums-load-error"]').exists()).toBe(true)
+    expect(w.text()).toContain('相册加载失败')
+    expect(w.find('[data-test="albums-empty"]').exists()).toBe(false)
+    expect(w.find('[data-test="album-card"]').exists()).toBe(false)
+  })
+
+  it('失败态的重试按钮重新调 fetchAlbums,成功后失败态消失', async () => {
+    svc.photos.listAlbums.mockRejectedValueOnce(new Error('network'))
+    const { w } = await mountView()
+    const albums = usePhotosAlbums()
+    expect(albums.loadError).toBe(true)
+    const fetchSpy = vi.spyOn(albums, 'fetchAlbums')
+
+    svc.photos.listAlbums.mockResolvedValueOnce([rawAlbum(1, { name: 'Tokyo' })])
+    await w.find('[data-test="albums-retry"]').trigger('click')
+    await flushPromises()
+    await w.vm.$nextTick()
+
+    expect(fetchSpy).toHaveBeenCalled()
+    expect(albums.loadError).toBe(false)
+    expect(w.find('[data-test="albums-load-error"]').exists()).toBe(false)
+    expect(w.find('[data-test="album-card"]').exists()).toBe(true)
+  })
+
+  it('失败态重试仍失败(reject→retry→reject)→ in-flight 期间与结束后失败态都持续可见,不出现网格分区头', async () => {
+    svc.photos.listAlbums.mockRejectedValueOnce(new Error('e1'))
+    const { w } = await mountView()
+    expect(w.find('[data-test="albums-load-error"]').exists()).toBe(true)
+
+    let rejectRetry: (e: Error) => void = () => {}
+    svc.photos.listAlbums.mockImplementationOnce(
+      () => new Promise((_resolve, reject) => { rejectRetry = reject }),
+    )
+    await w.find('[data-test="albums-retry"]').trigger('click')
+    await w.vm.$nextTick()
+
+    // in-flight:重试还没落定,失败态必须继续可见,不能落到空态分支。
+    expect(w.find('[data-test="albums-load-error"]').exists()).toBe(true)
+    expect(w.find('[data-test="albums-empty"]').exists()).toBe(false)
+
+    rejectRetry(new Error('e2'))
+    await flushPromises()
+    await w.vm.$nextTick()
+
+    // 落定后(仍失败):失败态持续可见。
+    expect(w.find('[data-test="albums-load-error"]').exists()).toBe(true)
+    expect(w.find('[data-test="albums-empty"]').exists()).toBe(false)
+  })
+
+  // 关键区分(挡门用例 1):成功但列表为空 —— 必须仍走空态,不能被 loadError 分支误吞。
+  it('确认为零相册(成功但列表空)仍走空态,不走失败态', async () => {
+    const { w } = await mountView()
+    const albums = usePhotosAlbums()
+    expect(albums.loadError).toBe(false)
+    expect(albums.albumsLoaded).toBe(true)
+    expect(w.find('[data-test="albums-empty"]').exists()).toBe(true)
+    expect(w.find('[data-test="albums-load-error"]').exists()).toBe(false)
+  })
+
+  // 关键区分(挡门用例 2):首次加载飞行中(既未失败也未加载完成)—— 不该出现失败态。
+  it('首次加载飞行中(未落定)→ 不出现失败态', async () => {
+    let resolveList: ((v: unknown[]) => void) | undefined
+    svc.photos.listAlbums.mockImplementationOnce(
+      () => new Promise((resolve) => { resolveList = resolve }),
+    )
+    const router = makeRouter()
+    router.push('/photos/albums')
+    await router.isReady()
+    const w = mount(PhotosAlbums, { global: { plugins: [i18n, router] } })
+    await w.vm.$nextTick()
+
+    expect(w.find('[data-test="albums-load-error"]').exists()).toBe(false)
+
+    resolveList?.([])
+    await flushPromises()
+    await w.vm.$nextTick()
+  })
+
   it('Esc(document 级)关闭新建模态', async () => {
     const { w } = await mountView()
 
     await w.find('[data-test="albums-new-btn"]').trigger('click')
     await w.vm.$nextTick()
     expect(w.find('[data-test="albums-create-modal"]').exists()).toBe(true)
 
     document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
     await w.vm.$nextTick()
     expect(w.find('[data-test="albums-create-modal"]').exists()).toBe(false)
   })
 })
```
