// 相册区 `.photos-layout` 高度封顶的**双向**回归闸。
//
// 背景:全相册区 13 页各自复制粘贴同一条 `.photos-layout` 规则(当初有意「不抽公共」)。
// 移植期这条规则写的是 `min-height: 100%`(至少一屏、可无限长高)而不是 Vue2 的
// `height: 100vh; overflow: hidden`(photos.scss:109)—— 结果照片区把整页撑高,侧栏与
// 右侧月份刻度尺跟着照片一起滚走。实测 785 张时侧栏「设置」按钮落在距页顶 83580px 处、
// 刻度尺被拉成 83508px 高(刻度全挤在最顶端,滚下去就点不到)。
//
// 为什么这道闸是**双向**的:SP9-T9 那次只做「白名单里的都在」的单向检查,漏搬的整块
// CSS 三道门全绿照样溜过去。所以这里既查「该封顶的都封了」,也查「没有任何相册页还留着
// 旧的 min-height:100%」—— 后者才拦得住「以后新建相册页复制粘贴旧规则」这条真实路径。
//
// jsdom 测不到布局高度(getBoundingClientRect 恒 0),所以布局是否真的生效以真机验收为准;
// 这道闸只锁源文本,防复发。读盘一律 node:fs —— `?raw` 在本仓测试环境恒空(历史坑:
// color-guard 曾因此空转)。
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'

const VIEWS_DIR = 'src/views'

// 已封顶:内层滚动链完整(`.photos-main` flex:1 + min-height:0 → 自带 overflow-y:auto 的
// 滚动容器),封顶后由内层容器接管滚动。
const CAPPED = [
  // Task 3(壳 + 侧栏重刻)起,Photos.vue 不再有 `.photos-layout` 规则字符串——外壳换成了
  // Vue2 结构的 `.app` CSS Grid(`height: 100vh; overflow: hidden`,parity scss
  // photos.scss:116-128),高度封顶职责由那条规则接管,与本文件锁的 `.photos-layout` 规则
  // 字符串不再相关。反向检查(下面第二条 it)不会误报它:`allPhotosLayoutViews()` 只收录
  // 源码里还含 `.photos-layout {` 字面量的页面,Photos.vue 已经不含,自动被排除,不需要挪进
  // EXEMPT。Plan C Task 2(公共换壳)起,PhotosAlbums.vue / PhotosAlbumDetail.vue /
  // PhotosSmartViews.vue(见下方 EXEMPT 移除) / PhotosSmartViewDetail.vue /
  // PhotosMomentDetail.vue 五页同样换成 `.app` 网格壳,同样不再含 `.photos-layout {`
  // 字面量,同一条自动排除规则覆盖——已从下面的 CAPPED 名单摘掉(高度封顶职责转移给
  // `.app` 网格,不再是本文件锁的 `.photos-layout` 规则字符串)。
  // Fix-3 item 7(owner acceptance,2026-08-13,Plan F pull-forward)起,PhotosSearch.vue 同样
  // 换成 `.app` 网格壳,同理从下面摘掉——它已经不含 `.photos-layout {` 字面量,
  // `allPhotosLayoutViews()` 自动排除,不需要挪进 EXEMPT。
  // Plan D Task 2(人物换壳)起,PhotosPeople.vue 同样换成 `.app` 网格壳,同理从下面摘掉
  // (`.people-body` 接过内层滚动职责,不变)——它已经不含 `.photos-layout {` 字面量,
  // `allPhotosLayoutViews()` 自动排除,不需要挪进 EXEMPT。
  // Plan D Task 3(详情页换壳)起,PhotosPersonDetail.vue 同样换成 `.app` 网格壳,同理从下面
  // 摘掉(`.detail-body` 接过内层滚动职责,不变)——它已经不含 `.photos-layout {` 字面量,
  // `allPhotosLayoutViews()` 自动排除,不需要挪进 EXEMPT。
  'PhotosFavorites.vue',        // PhotosGrid 的 .photos-wrap
  'PhotosPlaceAssets.vue',      // PhotosGrid 的 .photos-wrap
  'PhotosTrash.vue',            // .trash-scroll
  'PhotosSettings.vue',         // .ps-scroll
]

// 豁免:这一页整页都没有内层滚动容器,封顶会把内容裁掉够不着 —— 必须先给它建滚动容器
// 才能封顶,已单独挂账。它留着 min-height:100% 是当前行为(侧栏会跟着滚),不算退步,
// 但**是已知缺陷**,补完滚动容器后应从本名单移到 CAPPED。
//
// PhotosSmartViews.vue 已于 Plan C Task 2 补建滚动容器(`.mo-section` 升格为
// flex:1+overflow-y:auto)并随换壳一起封顶,从本名单移除(它也不再含 `.photos-layout {`
// 字面量,`allPhotosLayoutViews()` 已自动排除它)。
const EXEMPT: Record<string, string> = {
  'PhotosPlaces.vue': '地点地图页无内层滚动容器且掏着地图画布尺寸,封顶风险高;待单独一票处理',
}

const CAPPED_RULE = '.photos-layout { display: flex; gap: 16px; align-items: flex-start; height: 100%; }'
const UNCAPPED_RULE = '.photos-layout { display: flex; gap: 16px; align-items: flex-start; min-height: 100%; }'

function read(name: string): string {
  return readFileSync(`${VIEWS_DIR}/${name}`, 'utf8')
}

/** 所有带 `.photos-layout` 外壳的相册区 view —— 用目录扫描而不是写死清单,新增页会自动进来。 */
function allPhotosLayoutViews(): string[] {
  return readdirSync(VIEWS_DIR)
    .filter((f) => f.endsWith('.vue'))
    .filter((f) => read(f).includes('.photos-layout {'))
    .sort()
}

describe('相册区 .photos-layout 高度封顶', () => {
  it('正向:CAPPED 名单里每一页都写着 height: 100%(而非 min-height)', () => {
    for (const name of CAPPED) {
      const src = read(name)
      expect(src, `${name} 缺少已封顶的 .photos-layout 规则`).toContain(CAPPED_RULE)
    }
  })

  it('反向:没有任何相册页还留着旧的 min-height: 100%(豁免名单除外)', () => {
    const offenders = allPhotosLayoutViews()
      .filter((name) => read(name).includes(UNCAPPED_RULE))
      .filter((name) => !(name in EXEMPT))
    expect(
      offenders,
      `这些相册页的 .photos-layout 仍是 min-height:100%,侧栏与月份刻度尺会跟着内容滚走。` +
        `要么改成 height:100%(内层滚动链已完整),要么加进本文件的 EXEMPT 并写明理由。`,
    ).toEqual([])
  })

  it('反向:目录里每一个带 .photos-layout 的页都被本文件覆盖(CAPPED ∪ EXEMPT,无漏网)', () => {
    const covered = new Set([...CAPPED, ...Object.keys(EXEMPT)])
    const uncovered = allPhotosLayoutViews().filter((name) => !covered.has(name))
    expect(
      uncovered,
      `新增的相册页未登记:请判断内层滚动链是否完整,完整则封顶后加进 CAPPED,否则加进 EXEMPT。`,
    ).toEqual([])
  })

  it('豁免名单每条都带理由,且确实还没封顶(封顶了就该移出豁免)', () => {
    for (const [name, reason] of Object.entries(EXEMPT)) {
      expect(reason.length, `${name} 的豁免理由不能为空`).toBeGreaterThan(10)
      expect(read(name), `${name} 已经封顶了,应从 EXEMPT 移到 CAPPED`).not.toContain(CAPPED_RULE)
    }
  })
})

describe('PhotosGrid 照片区滚动条不可见(Vue2 photos.scss:103 / :301 契约)', () => {
  // 不隐藏的话,theme.css:4-16 的全局 10px 滚动条会正好压在 .scrubber(right:0 的 56px 浮层,
  // 刻度文字贴 right:6px)的刻度文字上。
  const grid = readFileSync('src/photos/components/PhotosGrid.vue', 'utf8')

  it('.photos-wrap 关掉 Firefox 侧滚动条', () => {
    expect(grid).toContain('scrollbar-width: none')
  })

  it('.photos-wrap 关掉 WebKit 侧滚动条', () => {
    expect(grid).toContain('.photos-wrap::-webkit-scrollbar { display: none; }')
  })

  it('PhotosSearchGrid 同款(两个网格组件契约一致)', () => {
    const searchGrid = readFileSync('src/photos/components/PhotosSearchGrid.vue', 'utf8')
    expect(searchGrid).toContain('scrollbar-width: none')
  })
})
