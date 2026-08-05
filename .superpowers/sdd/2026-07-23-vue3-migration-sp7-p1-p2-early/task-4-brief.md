### Task 4: i18n 灯箱 P2 键(zh_cn + en_us,过 parity)

**Files:**
- Modify: `src/i18n/zh_cn.ts`、`src/i18n/en_us.ts`

**Interfaces:**
- Produces(T5/T6/T7/T8 模板用,key 名固定):
  `photosLightboxCounter` `{idx} / {total}`(两语言同格式,纯符号);`photosFavorite` 收藏/Favorite;`photosUnfavorite` 取消收藏/Unfavorite;`photosDownload` 下载/Download;`photosClose` 关闭/Close;`photosZoomIn` 放大/Zoom in;`photosZoomOut` 缩小/Zoom out;`photosRotate` 旋转/Rotate;`photosReset` 复位/Reset;`photosPrev` 上一张/Previous;`photosNext` 下一张/Next;`photosInfoToggle` 详情/Info;`photosLivePhoto` 实况/LIVE;`photosDeleteConfirmTitle` 删除这张?/Delete this item?;`photosDeleteConfirmBody` 将移入最近删除,可在回收站恢复。/It will be moved to Recently Deleted — you can restore it from Trash.;`photosConfirmDelete` 删除/Delete;`photosInfoCameraCapture` 相机与拍摄/Camera & Capture;`photosInfoVideo` 视频/Video;`photosInfoLocation` 位置/Location;`photosInfoPeople` 人物/People;`photosInfoNimoSees` Nimo 识别/Nimo sees;`photosInfoFile` NAS 上的文件/File on NAS;`photosFieldCamera` 相机/Camera;`photosFieldIso` ISO/ISO;`photosFieldShutter` 快门/Shutter;`photosFieldAperture` 光圈/Aperture;`photosFieldFocal` 焦距/Focal length;`photosFieldDimensions` 尺寸/Dimensions;`photosFieldFileSize` 文件大小/File size;`photosFieldDuration` 时长/Duration;`photosFieldResolution` 分辨率/Resolution;`photosFieldVideoCodec` 视频编码/Video codec;`photosFieldAudioCodec` 音频编码/Audio codec;`photosFieldFrameRate` 帧率/Frame rate;`photosFieldBitRate` 码率/Bit rate;`photosFieldRotation` 旋转/Rotation;`photosFieldCoordinates` 坐标/Coordinates;`photosFieldPlace` 地点/Place;`photosCopyPath` 复制路径/Copy path;`photosCopied` 已复制/Copied。
- 中文值参照 Vue2 `zh_CN.json` 相册段;语境不合的重给(报告里列出重给项)。
- **不新增** `photosDelete`/`photosCancel`(P1 已有,复用)。

- [ ] **Step 1: 双文件加 key**(parity 测试即门槛,无需临时断言)。
- [ ] **Step 2: GREEN** — `pnpm vitest run src/i18n` 全绿(parity + 非空);全量 + tsc。
- [ ] **Step 3: Commit** — `feat(photos): P2 灯箱 i18n 键(zh_cn/en_us)`

---

