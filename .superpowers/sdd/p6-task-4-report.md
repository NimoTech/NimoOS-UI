# P6-T4 报告:i18n 分片不相交守卫(常驻)

## 结论
状态:完成。新增 `src/i18n/__tests__/shardDisjoint.test.ts`,10 条断言,与既有 6 个 i18n
测试文件一起跑(189 例)全绿。两轮变异验证均**真报红**,验证方式符合 brief 要求(不是空壳)。

## 0. brief 与实测的偏差(已按实测改写)

brief 假设三片(base/photos/ai),实测是 **四片**:

| 分片 | zh 键数 | en 键数 |
|---|---|---|
| `zh_cn.base.ts` / `en_us.base.ts` | 757 | 757 |
| `zh_cn.photos.ts` / `en_us.photos.ts` | 702 | 702 |
| `zh_cn.ai.ts` / `en_us.ai.ts`(T3 新建) | 1207 | 1207 |
| `zh_cn.sp9.ts` / `en_us.sp9.ts` | 459 | 459 |
| **合计** | **3125** | **3125** |

装配路径也有两条:
- `zh_cn.ts` 出口 = `{...base, ...photos, ...ai}`(不含 sp9)
- `src/i18n/index.ts` = `createI18n({ messages: { zh_cn: {...zh, ...zhSp9}, en_us: {...en, ...enSp9} } })`
  —— **这才是真实装配路径**,`i18n.global.messages.value.zh_cn` 实测键数 = 3125,与四片之和
  完全对上(当前无撞车)。

以上数字全部现测(见下方复算命令),与 brief 给出的 757/702/1207/459/3125 一致,未发现出入。

## 1. 与 photosSlice.test.ts 的分工

先读了 `src/i18n/__tests__/photosSlice.test.ts`。它已经守住:
- 三片(base/photos/ai)两两不相交、`zh_cn.ts` 出口是纯合并(不含 sp9 装配路径)
- photos 分片:两语言键集一致、非空、`photos` 前缀、值非空字符串
- base 里不残留 `photos*` 键(正向)、分片键不被相册面之外引用(反向)

`shardDisjoint.test.ts` 补的是它没覆盖的三个缺口(不重复其已有断言):
1. **sp9 这第四片**与其余三片的不相交检查(base×sp9 / photos×sp9 / ai×sp9),以及
   「四片之和 == 真实装配路径(`i18n.global.messages.value`)键数」—— photosSlice 只验
   `zh_cn.ts` 出口,验不到 sp9 撞车。
2. **ai 分片前缀守卫**(该分片是 T3 新建,此前没有专属测试)。
3. **两语言分片结构对称**(base/ai/sp9 三片此前无人守;photos 一条与
   photosSlice 已有断言重复,保留是为了让本文件自身是「四片对称性」的完整清单,不必跳去
   另一文件确认覆盖 —— 代价极低,注释里已说明重复是有意的)。

未把新断言并入 photosSlice.test.ts:该文件的注释体系是围绕「相册文案分片」这个开源导出
场景组织的(正向/反向引用扫描等 photos 专属逻辑),混入 ai/sp9/跨语言对称会打乱其叙事;
新文件按「四片不相交」这个独立主题组织更清楚。

## 2. 变异验证(两轮,均真报红)

### 轮1:base×ai 真实重名键(`appTitle`,来自 `zh_cn.base.ts` 第 2 行)

临时改动:在 `zh_cn.ai.ts` 的 `export default {` 后插入
`appTitle: 'TEMP-MUTATION-DUPLICATE-KEY-FOR-T4-RED-CHECK',`

命令:
```
pnpm exec vitest run src/i18n/__tests__/shardDisjoint.test.ts --reporter=verbose
```

结果:**FAIL**,4 条断言报红(比 brief 预期的 2 条多,因为 `appTitle` 恰好同时踩中前缀检查
和对称检查,属于额外证据而非误报):

```
× zh 四片两两不相交(base / photos / ai / sp9) > 六对组合全部不相交
  → base × ai: expected [ 'appTitle' ] to deeply equal []
× 无损划分 · 真实装配路径 > zh_cn: base+photos+ai+sp9 键数之和 == messages.zh_cn 键数
  → expected 3126 to be 3125 // Object.is equality
× ai 分片前缀守卫 > zh_cn.ai.ts 键全部以 ai 开头
  → 非 ai 前缀键: appTitle: expected [ 'appTitle' ] to deeply equal []
× 两语言分片结构对称 > ai 分片: zh 与 en 键集完全一致
  → expected [...(1207)] to deeply equal [...(1206)]
```

「两两不相交」与「无损划分」两条 brief 点名的断言确认报红。改完立即撤销该行,`git diff
src/i18n/zh_cn.ai.ts` 确认无残留。

### 轮2:ai 前缀守卫的隔离验证(非重名、纯前缀违规)

为了单独验证前缀检查(轮1的 `appTitle` 同时踩中撞车,信号混在一起),先
`/usr/bin/grep -n "zzzNotAiPrefixed" src/i18n/*.ts` 确认这个名字在全部分片里都不存在,
再临时插入 `zzzNotAiPrefixed: 'TEMP-MUTATION-FOR-T4-PREFIX-RED-CHECK',`。

命令同上,结果:**FAIL**,只有 2 条报红(隔离效果符合预期 —— 不相交/无损两条保持绿,
因为这个键不撞任何分片):

```
× ai 分片前缀守卫 > zh_cn.ai.ts 键全部以 ai 开头
  → 非 ai 前缀键: zzzNotAiPrefixed: expected [ 'zzzNotAiPrefixed' ] to deeply equal []
× 两语言分片结构对称 > ai 分片: zh 与 en 键集完全一致
  → expected [...(1207)] to deeply equal [...(1206)]
```

改完撤销该行,`git diff --stat src/i18n/zh_cn.ai.ts` 确认无输出(干净)。

## 3. 复跑确认绿

```
pnpm exec vitest run src/i18n --reporter=verbose
```
`Test Files 7 passed (7)` / `Tests 189 passed (189)`。

## 4. 提交

`git add src/i18n/__tests__/shardDisjoint.test.ts`(带 pathspec,未触碰那 3 个既有的
`D design-export/...` 删除状态)。commit message 见 git log。

## Concern

- ai 分片前缀断言与「两两不相交」在实践中经常同时报红(重名的新键几乎必然也不带 `ai`
  前缀,因为其它三片没有 `ai` 前缀的键)。这不是缺陷,只是提醒:以后调试时看到多条同时红,
  先看「不相交」和「无损划分」两条是不是本体,其余是连带信号。
- `zh_cn.ts` 出口本身仍然不含 sp9(装配路径 ① 与 ②并存的历史包袱),`shardDisjoint.test.ts`
  刻意绕开这条出口、直接读 `index.ts` 的 `i18n` 实例,以后如果有人重构装配方式(比如把 sp9
  也并进 `zh_cn.ts` 出口),这里的断言仍然成立(仍然验证「四片之和 == 真实装配结果」),
  不需要跟着改。
